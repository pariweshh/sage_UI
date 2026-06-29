// Browser voice client: one WebSocket to the loopback backend, push-to-talk mic
// capture, and Web Audio playback of Sage's PCM reply. No API keys, no provider
// SDK here; all of that stays server-side. The mic is live only while held, so
// the browser never captures Sage's own speech.

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';
export interface TranscriptLine {
  role: 'you' | 'sage';
  text: string;
}

export interface VoiceHandlers {
  onState: (s: VoiceState) => void;
  onConnected: (c: boolean) => void;
  onTranscript: (line: TranscriptLine) => void;
  onReplyDelta: (text: string) => void;
  onError: (msg: string) => void;
}

export interface VoiceClient {
  pttStart: () => void;
  pttEnd: () => void;
  dispose: () => void;
}

function pickMime(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

export function createVoiceClient(handlers: VoiceHandlers): VoiceClient {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';

  let state: VoiceState = 'idle';
  let holding = false;
  let disposed = false; // a disposed client (e.g. StrictMode remount) stays silent
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;

  // --- playback: schedule incoming PCM back-to-back via Web Audio.
  // The source -> destination graph is where Phase 3 will tap an AnalyserNode.
  let audioCtx: AudioContext | null = null;
  let playhead = 0;
  let speakRate = 24000;
  const ctx = (): AudioContext => {
    if (!audioCtx) audioCtx = new AudioContext();
    return audioCtx;
  };
  const playPcm = (buf: ArrayBuffer): void => {
    const i16 = new Int16Array(buf);
    if (i16.length === 0) return;
    const f32 = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768;
    const c = ctx();
    const ab = c.createBuffer(1, f32.length, speakRate);
    ab.copyToChannel(f32, 0);
    const src = c.createBufferSource();
    src.buffer = ab;
    src.connect(c.destination);
    const startAt = Math.max(c.currentTime, playhead);
    src.start(startAt);
    playhead = startAt + ab.duration;
  };

  ws.addEventListener('open', () => {
    if (!disposed) handlers.onConnected(true);
  });
  ws.addEventListener('close', () => {
    if (!disposed) handlers.onConnected(false);
  });
  ws.addEventListener('error', () => {
    if (!disposed) handlers.onError('voice connection error');
  });
  ws.addEventListener('message', (ev) => {
    if (disposed) return;
    if (typeof ev.data !== 'string') {
      playPcm(ev.data as ArrayBuffer);
      return;
    }
    const msg = JSON.parse(ev.data);
    switch (msg.type) {
      case 'state':
        state = msg.state;
        handlers.onState(state);
        break;
      case 'transcript':
        handlers.onTranscript({ role: msg.role === 'sage' ? 'sage' : 'you', text: msg.text });
        break;
      case 'reply_delta':
        handlers.onReplyDelta(msg.text);
        break;
      case 'audio_start':
        speakRate = msg.sampleRate ?? 24000;
        playhead = ctx().currentTime;
        break;
      case 'error':
        handlers.onError(msg.message);
        break;
      // 'audio_end': nothing to do; chunks are already scheduled
    }
  });

  const send = (o: object): void => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(o));
  };

  const stopStream = (): void => {
    stream?.getTracks().forEach((t) => t.stop()); // release the mic between presses
    stream = null;
  };

  const startMic = async (): Promise<void> => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      holding = false;
      handlers.onError('microphone permission denied');
      return;
    }
    if (!holding) {
      stopStream(); // released before the mic finished opening
      return;
    }
    const mime = pickMime();
    recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
    };
    recorder.onstop = () => {
      send({ type: 'ptt_end' }); // after the final chunk
      stopStream();
    };
    send({ type: 'ptt_start' });
    recorder.start(250); // stream ~4 chunks/sec while held
  };

  const pttStart = (): void => {
    if (holding || ws.readyState !== WebSocket.OPEN) return;
    if (state !== 'idle') return; // mic opens only when Sage is at rest (covers gate answers)
    holding = true;
    void ctx().resume(); // unlock playback inside the user gesture
    void startMic();
  };

  const pttEnd = (): void => {
    if (!holding) return;
    holding = false;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop(); // fires a final dataavailable, then onstop sends ptt_end
    } else {
      stopStream();
    }
  };

  const dispose = (): void => {
    disposed = true;
    holding = false;
    try {
      recorder?.stop();
    } catch {
      /* ignore */
    }
    stopStream();
    try {
      ws.close();
    } catch {
      /* ignore */
    }
    void audioCtx?.close();
  };

  return { pttStart, pttEnd, dispose };
}
