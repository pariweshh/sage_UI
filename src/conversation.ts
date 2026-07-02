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

// --- Wake-word gating (conversation mode only) -------------------------------------------------
// Turns are gated behind a wake word, conversationally: dormant until the wake phrase, then an
// active window where follow-ups need no wake word, closing after a lull. PTT + typed are explicit
// and never gated. The wake phrase defaults to the assistant name (sent from the backend); set
// WAKE_PHRASE to make the wake word differ from the display name.
export const WAKE_TUNING = {
  /** Wake word, if it should differ from the assistant name. Empty -> use ASSISTANT_NAME. */
  WAKE_PHRASE: '',
  /** Extra accepted spellings/mishears (case-insensitive), e.g. ['sage', 'sange'], for robustness. */
  WAKE_VARIANTS: [] as string[],
  /** After a wake, the window stays open this long of inactivity before you must say the word again. */
  WAKE_WINDOW_TIMEOUT_MS: 20_000,
  /** Wake gating on by default in conversation mode; off -> every utterance is a turn (as before). */
  WAKE_GATING_DEFAULT: true,
} as const;

export interface WakeMatch {
  hit: boolean;
  /** Text after the wake word (stripped of a leading comma/space); '' when only the wake word. */
  remainder: string;
}

// Find `needle` as a whole word within the first `maxStart` characters of `hay` (already lowercased).
function findWordNearStart(hay: string, needle: string, maxStart: number): number {
  const isWordChar = (c: string): boolean => /[a-z0-9]/i.test(c);
  for (let from = 0; ; ) {
    const i = hay.indexOf(needle, from);
    if (i === -1 || i > maxStart) return -1;
    const before = i === 0 ? ' ' : hay[i - 1];
    const after = hay[i + needle.length] ?? ' ';
    if (!isWordChar(before) && !isWordChar(after)) return i;
    from = i + 1;
  }
}

/**
 * Transcript-based wake detection. Case-insensitive; tolerant of a leading comma/punctuation and of
 * the wake word appearing at or near the start (e.g. "hey sage, what's up"). On a hit, `remainder` is
 * the text after the wake word ('' if the utterance is only the wake word).
 */
export function matchWake(transcript: string, wakeWords: string[]): WakeMatch {
  const raw = transcript.trim();
  const lower = raw.toLowerCase();
  const NEAR_START = 24; // allow a short lead-in like "hey " / "ok " before the wake word
  let best = -1;
  let bestEnd = 0;
  for (const w of wakeWords) {
    const word = w.trim().toLowerCase();
    if (!word) continue;
    const idx = findWordNearStart(lower, word, NEAR_START);
    if (idx !== -1 && (best === -1 || idx < best)) {
      best = idx;
      bestEnd = idx + word.length;
    }
  }
  if (best === -1) return { hit: false, remainder: '' };
  const remainder = raw.slice(bestEnd).replace(/^[\s,.:;!?-]+/, '').trim();
  return { hit: true, remainder };
}

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
