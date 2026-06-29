import { useCallback, useEffect, useRef, useState } from 'react';
import { createVoiceClient, type VoiceClient, type VoiceState, type TranscriptLine } from './voiceClient';

export interface UseVoice {
  state: VoiceState;
  connected: boolean;
  lines: TranscriptLine[];
  partial: string;
  pttStart: () => void;
  pttEnd: () => void;
}

// React wrapper around the voice client. One client per mount; state, transcript,
// and the streaming partial reply are surfaced for the UI (and Phase 3 blob).
export function useVoice(): UseVoice {
  const [state, setState] = useState<VoiceState>('idle');
  const [connected, setConnected] = useState(false);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [partial, setPartial] = useState('');
  const clientRef = useRef<VoiceClient | null>(null);

  useEffect(() => {
    const client = createVoiceClient({
      onState: setState,
      onConnected: setConnected,
      onTranscript: (line) => {
        setLines((prev) => [...prev, line]);
        setPartial(''); // a finalized line supersedes the streaming partial
      },
      onReplyDelta: (text) => setPartial((p) => p + text),
      onError: (msg) => setLines((prev) => [...prev, { role: 'sage', text: `(${msg})` }]),
    });
    clientRef.current = client;
    return () => client.dispose();
  }, []);

  const pttStart = useCallback(() => clientRef.current?.pttStart(), []);
  const pttEnd = useCallback(() => clientRef.current?.pttEnd(), []);

  return { state, connected, lines, partial, pttStart, pttEnd };
}
