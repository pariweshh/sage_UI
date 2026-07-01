// In-browser voice-activity detection for hands-free "Conversation mode". Wraps the Silero VAD
// (@ricky0123/vad-web, lazy-loaded, self-hosted model + wasm) behind one thin seam so the rest of
// the app never imports the dependency directly. It only DETECTS speech start/end on a shared mic
// stream; transcription still goes through the existing Deepgram seam (server-side), and every turn
// still runs through the same runTurn + confirmation gate. No brain, no gate, no new tool route.

// --- Tuning (edit these to adjust the endpointing feel) ----------------------------------------
// Endpointing is the thing most likely to need adjustment; END_OF_SPEECH_SILENCE_MS is the main dial.
export const VAD_TUNING = {
  /** Silero speech-start probability 0..1. Higher = less likely noise starts a turn. */
  SPEECH_START_THRESHOLD: 0.6,
  /** Silero speech-continue probability; below this counts toward end-of-speech. */
  SPEECH_END_THRESHOLD: 0.4,
  /** Silence held this long ends the turn (endpointing). Raise if it cuts you off mid-sentence. */
  END_OF_SPEECH_SILENCE_MS: 900,
  /** Audio kept before detected speech so word onsets are not clipped. */
  PRE_SPEECH_PAD_MS: 200,
  /** Utterances shorter than this are treated as noise, not a turn. */
  MIN_SPEECH_MS: 250,
  /** After Sage's reply finishes playing, wait this long before re-arming (debounce). */
  REARM_DEBOUNCE_MS: 500,
} as const;

// Self-hosted asset locations (served from sage-ui/public). No runtime external calls.
const VAD_BASE_ASSET_PATH = '/vad/';
const ONNX_WASM_BASE_PATH = '/onnx-wasm/';

export interface VadController {
  /** Arm: resume detecting speech. */
  start(): void;
  /** Disarm: stop detecting. The mic stream stays open (we own it) — that is what makes it half-duplex. */
  pause(): void;
  destroy(): Promise<void>;
}

export interface VadCallbacks {
  onSpeechStart: () => void;
  /** A complete utterance as a 16 kHz mono PCM16 WAV (Deepgram auto-detects it). */
  onSpeechEnd: (wav: ArrayBuffer) => void;
}

/**
 * Build a VAD on an existing mic stream. Lazy-imports the dependency so it stays out of the base
 * bundle. Returns a controller that starts PAUSED — the caller arms it via start(). Speech end
 * yields a WAV, so the existing server-side Deepgram seam needs no change.
 */
export async function createVad(stream: MediaStream, cb: VadCallbacks): Promise<VadController> {
  const { MicVAD } = await import('@ricky0123/vad-web');
  const vad = await MicVAD.new({
    model: 'v5',
    baseAssetPath: VAD_BASE_ASSET_PATH,
    onnxWASMBasePath: ONNX_WASM_BASE_PATH,
    // Share the caller's stream and keep it across pause/resume (the caller owns its lifecycle),
    // so pausing during Sage's reply is half-duplex without re-prompting for the mic.
    getStream: async () => stream,
    pauseStream: async () => {},
    resumeStream: async () => stream,
    // Single-threaded ORT: no SharedArrayBuffer, so no COOP/COEP headers needed on the dev server.
    ortConfig: (ort: typeof import('onnxruntime-web')) => {
      ort.env.wasm.numThreads = 1;
    },
    positiveSpeechThreshold: VAD_TUNING.SPEECH_START_THRESHOLD,
    negativeSpeechThreshold: VAD_TUNING.SPEECH_END_THRESHOLD,
    redemptionMs: VAD_TUNING.END_OF_SPEECH_SILENCE_MS,
    preSpeechPadMs: VAD_TUNING.PRE_SPEECH_PAD_MS,
    minSpeechMs: VAD_TUNING.MIN_SPEECH_MS,
    onSpeechStart: cb.onSpeechStart,
    onSpeechEnd: (audio: Float32Array) => cb.onSpeechEnd(floatToWav(audio, 16_000)),
  });
  vad.pause(); // start disarmed regardless of the library's start-on-load default
  return {
    start: () => void vad.start(),
    pause: () => void vad.pause(),
    destroy: () => vad.destroy(),
  };
}

// Encode mono Float32 [-1,1] as a 16-bit PCM WAV. Deepgram auto-detects WAV, so the server STT
// seam is unchanged.
function floatToWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // format = PCM
  view.setUint16(22, 1, true); // channels = mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}
