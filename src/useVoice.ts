import { useCallback, useEffect, useRef, useState } from 'react';
import { createVoiceClient, type VoiceClient, type VoiceState, type TranscriptLine } from './voiceClient';

export interface UseVoice {
  state: VoiceState;
  connected: boolean;
  lines: TranscriptLine[];
  partial: string;
  pttStart: () => void;
  pttEnd: () => void;
  /** Send a typed turn (or, while the gate waits, a typed yes/no) into the same brain. */
  sendTyped: (text: string) => void;
  /** Toggle whether replies are spoken (default on). Sticky for the session. */
  setSpeak: (on: boolean) => void;
  /** Whether replies are spoken; drives the toggle's label/pressed state. */
  speakReplies: boolean;
  /** Speak the canned greeting once; call from the first user gesture (browser autoplay). */
  playGreeting: () => void;
  /** The canned welcome line shown under the orb (separate from the conversation transcript). */
  greeting: string;
  /** Increments on each silent typed reply -> the core fires a brief non-audio pulse. */
  replyPulse: number;
  /** Stable getter the core reads each frame; 0 when no client/amplitude. */
  getAmplitude: () => number;
}

// React wrapper around the voice client. One client per mount; state, transcript, and
// the streaming partial reply are surfaced for the UI (and the reactive core).
export function useVoice(): UseVoice {
  const [state, setState] = useState<VoiceState>('idle');
  const [connected, setConnected] = useState(false);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [partial, setPartial] = useState('');
  const [replyPulse, setReplyPulse] = useState(0);
  const [speakReplies, setSpeakState] = useState(true); // replies speak by default
  const [greeting, setGreeting] = useState(''); // shown under the orb, not in the transcript
  const clientRef = useRef<VoiceClient | null>(null);
  const speakRef = useRef(true); // latest toggle value; re-sent on each (re)connect so it stays sticky
  const greetedRef = useRef(false); // the welcome line is shown once per session

  useEffect(() => {
    const client = createVoiceClient({
      onState: setState,
      onConnected: (c) => {
        setConnected(c);
        if (c) clientRef.current?.setSpeak(speakRef.current); // re-sync the server after a (re)connect
      },
      onTranscript: (line) => {
        setLines((prev) => [...prev, line]);
        setPartial(''); // a finalized line supersedes the streaming partial
      },
      onReplyDelta: (text) => setPartial((p) => p + text),
      onError: (msg) => setLines((prev) => [...prev, { role: 'sage', text: `(${msg})` }]),
      onReplyPulse: () => setReplyPulse((n) => n + 1),
      onGreeting: (text) => {
        if (greetedRef.current || !text) return; // once per session; ignore a re-greet on reconnect
        greetedRef.current = true;
        setGreeting(text); // shown under the orb, not pushed into the conversation transcript
      },
    });
    clientRef.current = client;
    return () => client.dispose();
  }, []);

  const pttStart = useCallback(() => clientRef.current?.pttStart(), []);
  const pttEnd = useCallback(() => clientRef.current?.pttEnd(), []);
  const sendTyped = useCallback((text: string) => clientRef.current?.sendTyped(text), []);
  const setSpeak = useCallback((on: boolean) => {
    speakRef.current = on;
    setSpeakState(on);
    clientRef.current?.setSpeak(on);
  }, []);
  const playGreeting = useCallback(() => clientRef.current?.playGreeting(), []);
  const getAmplitude = useCallback(() => clientRef.current?.getAmplitude() ?? 0, []);

  return {
    state, connected, lines, partial, pttStart, pttEnd, sendTyped,
    setSpeak, speakReplies, playGreeting, greeting, replyPulse, getAmplitude,
  };
}
