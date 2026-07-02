import { useCallback, useEffect, useRef, useState } from 'react';
import { createVoiceClient, type VoiceClient, type VoiceState, type TranscriptLine, type ConvoStatus, type WakeState, type SkillStatus } from './voiceClient';
import { WAKE_TUNING } from './conversation';

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
  /** Enable/disable hands-free Conversation mode (open-mic). Enabling forces speak-replies on. */
  setConversationMode: (on: boolean) => void;
  /** Whether Conversation mode is on (the toggle's pressed state). */
  conversationMode: boolean;
  /** Fine-grained mic status (off | armed | capturing | blocked): drives the hot-mic indicator + orb. */
  convoStatus: ConvoStatus;
  /** The configured assistant name (from the backend); drives the HUD + the default wake word. */
  assistantName: string;
  /** Wake-word gating on/off for conversation mode (on by default). */
  wakeGating: boolean;
  setWakeGating: (on: boolean) => void;
  /** Dormant (say the wake word) vs engaged (active window; follow-ups need no wake word). */
  wakeState: WakeState;
  /** Increments on each silent typed reply -> the core fires a brief non-audio pulse. */
  replyPulse: number;
  /** Run a skill by name over the conversation channel (the command deck's click). */
  runSkill: (name: string) => void;
  /** Live per-skill run status (running/ok/error) for the deck's status dots. */
  skillStatus: Record<string, SkillStatus>;
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
  const [conversationMode, setConversationModeState] = useState(false); // hands-free open-mic toggle
  const [convoStatus, setConvoStatus] = useState<ConvoStatus>('off');
  const [assistantName, setAssistantName] = useState(''); // from the backend identity message
  const [wakeGating, setWakeGatingState] = useState<boolean>(WAKE_TUNING.WAKE_GATING_DEFAULT);
  const [wakeState, setWakeState] = useState<WakeState>('dormant');
  const [skillStatus, setSkillStatus] = useState<Record<string, SkillStatus>>({});
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
      onConvoStatus: (s) => {
        setConvoStatus(s);
        if (s === 'off') setConversationModeState(false); // client dropped the mic (e.g. denied/failed)
      },
      onIdentity: (name) => setAssistantName(name),
      onWakeState: (s) => setWakeState(s),
      onSkillStatus: (name, status) => setSkillStatus((prev) => ({ ...prev, [name]: status })),
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
  const setConversationMode = useCallback(
    (on: boolean) => {
      setConversationModeState(on);
      if (on) setSpeak(true); // hands-free implies spoken replies (updates the sticky toggle + backend)
      clientRef.current?.setConversationMode(on);
    },
    [setSpeak],
  );
  const setWakeGating = useCallback((on: boolean) => {
    setWakeGatingState(on);
    clientRef.current?.setWakeGating(on);
  }, []);
  const getAmplitude = useCallback(() => clientRef.current?.getAmplitude() ?? 0, []);
  const runSkill = useCallback((name: string) => clientRef.current?.runSkill(name), []);

  return {
    state, connected, lines, partial, pttStart, pttEnd, sendTyped,
    setSpeak, speakReplies, playGreeting, greeting,
    setConversationMode, conversationMode, convoStatus,
    assistantName, wakeGating, setWakeGating, wakeState, replyPulse, getAmplitude,
    runSkill, skillStatus,
  };
}
