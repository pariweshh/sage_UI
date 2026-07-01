// Browser voice client: one WebSocket to the loopback backend, push-to-talk mic
// capture, and Web Audio playback of Sage's PCM reply. No API keys, no provider
// SDK here; all of that stays server-side. The mic is live only while held, so
// the browser never captures Sage's own speech.

import { createVad, VAD_TUNING, type VadController } from './conversation';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';
/** Conversation-mode status: off, armed (waiting for you), capturing (you speak), blocked (Sage responds). */
export type ConvoStatus = 'off' | 'armed' | 'capturing' | 'blocked';
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
  /** A silent typed reply landed: fire a brief non-audio pulse on the core. */
  onReplyPulse: () => void;
  /** The canned welcome line, sent once on connect, to show immediately in the transcript. */
  onGreeting: (text: string) => void;
  /** Conversation-mode status changed (drives the hot-mic indicator + the orb's armed cue). */
  onConvoStatus: (status: ConvoStatus) => void;
}

export interface VoiceClient {
  pttStart: () => void;
  pttEnd: () => void;
  /** Send a typed turn (or, while the gate waits, a typed yes/no) into the same brain. */
  sendTyped: (text: string) => void;
  /** Toggle whether replies are spoken (default on). */
  setSpeak: (on: boolean) => void;
  /** Ask the server to speak the canned greeting once; call inside a user gesture (autoplay). */
  playGreeting: () => void;
  /** Enable/disable hands-free Conversation mode (opt-in open-mic layer over PTT). */
  setConversationMode: (on: boolean) => void;
  /** 0..1 analyser amplitude: mic while listening, TTS playback while speaking, else 0. */
  getAmplitude: () => number;
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

  // --- playback + analysers. PCM plays through a TTS analyser (speaking
  // amplitude); the mic is tapped by a separate analyser (listening amplitude).
  // The blob reads these via getAmplitude().
  let audioCtx: AudioContext | null = null;
  let playhead = 0;
  let speakRate = 24000;
  let ttsAnalyser: AnalyserNode | null = null;
  let micAnalyser: AnalyserNode | null = null;
  let micSource: MediaStreamAudioSourceNode | null = null;

  // Conversation-mode (open-mic) state; kept separate from PTT so PTT stays untouched.
  let convoStatus: ConvoStatus = 'off';
  let convoStream: MediaStream | null = null;
  let convoSource: MediaStreamAudioSourceNode | null = null;
  let convoAnalyser: AnalyserNode | null = null;
  let vad: VadController | null = null;
  let rearmTimer: ReturnType<typeof setTimeout> | null = null;
  const ctx = (): AudioContext => {
    if (!audioCtx) audioCtx = new AudioContext();
    return audioCtx;
  };
  const ttsTap = (): AnalyserNode => {
    const c = ctx();
    if (!ttsAnalyser) {
      ttsAnalyser = c.createAnalyser();
      ttsAnalyser.fftSize = 256;
      ttsAnalyser.smoothingTimeConstant = 0.6;
      ttsAnalyser.connect(c.destination); // analyser -> speakers
    }
    return ttsAnalyser;
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
    src.connect(ttsTap());
    const startAt = Math.max(c.currentTime, playhead);
    src.start(startAt);
    playhead = startAt + ab.duration;
  };
  const rms = (an: AnalyserNode): number => {
    const buf = new Uint8Array(an.fftSize);
    an.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const x = (buf[i] - 128) / 128;
      sum += x * x;
    }
    return Math.min(1, Math.sqrt(sum / buf.length) * 4); // scale speech RMS into 0..1
  };
  const getAmplitude = (): number => {
    if (state === 'listening') {
      const a = micAnalyser ?? convoAnalyser; // PTT mic, or the conversation-mode mic
      if (a) return rms(a);
    }
    if (state === 'speaking' && ttsAnalyser) return rms(ttsAnalyser);
    return 0;
  };

  // --- Conversation mode (hands-free): an opt-in open-mic layer OVER push-to-talk. It reuses the
  // exact PTT protocol (ptt_start / binary / ptt_end) driven by VAD instead of a key, plus the same
  // gate. Half-duplex: the VAD is paused while Sage thinks/speaks and re-armed after playback drains.
  const setConvoStatus = (s: ConvoStatus): void => {
    convoStatus = s;
    handlers.onConvoStatus(s);
  };

  // Re-arm the VAD once Sage's reply has finished PLAYING (playhead), plus a debounce so the tail of
  // playback or room noise does not instantly re-trigger. Called on every state=idle while in mode.
  const scheduleRearm = (): void => {
    if (convoStatus === 'off' || convoStatus === 'capturing') return;
    if (rearmTimer !== null) return;
    const drainMs = audioCtx ? Math.max(0, (playhead - audioCtx.currentTime) * 1000) : 0;
    rearmTimer = setTimeout(() => {
      rearmTimer = null;
      if (convoStatus === 'off' || convoStatus === 'capturing') return;
      if (state !== 'idle') return; // Sage started speaking again; the next idle will re-arm
      vad?.start();
      setConvoStatus('armed');
    }, drainMs + VAD_TUNING.REARM_DEBOUNCE_MS);
  };

  // VAD detected the start of my turn: behave exactly like pttStart (same WS message, same backend).
  const onConvoSpeechStart = (): void => {
    if (convoStatus !== 'armed' || state !== 'idle') return;
    setConvoStatus('capturing');
    void ctx().resume();
    send({ type: 'ptt_start' });
  };

  // VAD detected the end of my turn: send the utterance as one WAV chunk, then ptt_end (mirrors PTT
  // end), and go half-duplex (pause the VAD) until Sage's reply finishes and we re-arm.
  const onConvoSpeechEnd = (wav: ArrayBuffer): void => {
    if (convoStatus !== 'capturing') return;
    setConvoStatus('blocked');
    vad?.pause();
    if (ws.readyState === WebSocket.OPEN) ws.send(wav);
    send({ type: 'ptt_end' });
  };

  const stopConversation = async (): Promise<void> => {
    if (rearmTimer !== null) {
      clearTimeout(rearmTimer);
      rearmTimer = null;
    }
    const v = vad;
    vad = null;
    await v?.destroy().catch(() => undefined);
    try {
      convoSource?.disconnect();
    } catch {
      /* ignore */
    }
    convoSource = null;
    convoAnalyser = null;
    convoStream?.getTracks().forEach((t) => t.stop()); // release the mic immediately
    convoStream = null;
    setConvoStatus('off');
  };

  const startConversation = async (): Promise<void> => {
    if (convoStatus !== 'off' || disposed) return;
    setConvoStatus('blocked'); // not armed until any greeting/settle finishes
    try {
      convoStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setConvoStatus('off');
      handlers.onError('microphone permission denied');
      return;
    }
    if (disposed) {
      convoStream.getTracks().forEach((t) => t.stop());
      convoStream = null;
      setConvoStatus('off');
      return;
    }
    const c = ctx();
    void c.resume();
    convoSource = c.createMediaStreamSource(convoStream);
    convoAnalyser = c.createAnalyser();
    convoAnalyser.fftSize = 256;
    convoAnalyser.smoothingTimeConstant = 0.6;
    convoSource.connect(convoAnalyser); // analyser only -> feeds the listening-state orb amplitude
    try {
      vad = await createVad(convoStream, { onSpeechStart: onConvoSpeechStart, onSpeechEnd: onConvoSpeechEnd });
    } catch {
      handlers.onError('conversation mode unavailable (voice detector failed to load)');
      void stopConversation();
      return;
    }
    playGreeting(); // enable is a user gesture -> unlock audio + greet
    scheduleRearm(); // arm after any greeting settles (or after the debounce if none)
  };

  const setConversationMode = (on: boolean): void => {
    if (on) void startConversation();
    else void stopConversation();
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
        if (convoStatus !== 'off' && state === 'idle') scheduleRearm(); // half-duplex: re-arm after Sage rests
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
      case 'reply_pulse':
        handlers.onReplyPulse();
        break;
      case 'greeting':
        handlers.onGreeting(typeof msg.text === 'string' ? msg.text : '');
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
    try {
      micSource?.disconnect();
    } catch {
      /* ignore */
    }
    micSource = null;
    micAnalyser = null;
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
    // tap the mic for the listening-state amplitude (analyser only, never to speakers)
    const c = ctx();
    micSource = c.createMediaStreamSource(stream);
    micAnalyser = c.createAnalyser();
    micAnalyser.fftSize = 256;
    micAnalyser.smoothingTimeConstant = 0.6;
    micSource.connect(micAnalyser);
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
    void stopConversation();
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

  const sendTyped = (text: string): void => send({ type: 'typed_turn', text });
  const setSpeak = (on: boolean): void => send({ type: 'set_speak', on });

  // Browsers block audio before a user gesture. Call this from the first interaction:
  // resume the AudioContext (unlock) inside the gesture, then ask the server to speak the
  // greeting. Fires at most once; the server also only ever speaks the greeting once.
  let greetingRequested = false;
  const playGreeting = (): void => {
    if (greetingRequested) return;
    greetingRequested = true;
    void ctx().resume();
    send({ type: 'play_greeting' });
  };

  return { pttStart, pttEnd, sendTyped, setSpeak, playGreeting, setConversationMode, getAmplitude, dispose };
}
