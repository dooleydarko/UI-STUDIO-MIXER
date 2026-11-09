import { useCallback, useEffect, useRef, useState } from 'react';
import { micAccess, transcribeAudio } from './aiClient';
import { transcribeLocally } from './localWhisper';

export type DictationState = 'idle' | 'recording' | 'transcribing';

/** 'local' runs Whisper on this Mac; 'gemini' sends the audio to Google for transcription. */
export type DictationEngine = 'local' | 'gemini';

const MAX_SECONDS = 60;

/**
 * Push-to-dictate: start() records from the microphone, stop() transcribes the audio
 * (locally or with Gemini) and hands the text to onText.
 */
export function useDictation(onText: (text: string) => void, engine: DictationEngine) {
  const [state, setState] = useState<DictationState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const engineRef = useRef(engine);
  engineRef.current = engine;

  const releaseMic = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      if (!(await micAccess())) throw new Error('Microphone access is blocked. Allow it in System Settings > Privacy & Security > Microphone.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        releaseMic();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        if (blob.size < 1500) {
          setState('idle');
          return; // too short to contain speech
        }
        setState('transcribing');
        setStatus(engineRef.current === 'local' ? 'Transcribing...' : 'Sending to Gemini...');
        try {
          const text =
            engineRef.current === 'local' ? await transcribeLocally(blob, setStatus) : await transcribeAudio(blob);
          if (text) onTextRef.current(text);
          else setError('Did not catch anything. Try again a little closer to the mic.');
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Transcription failed.');
        } finally {
          setState('idle');
          setStatus('');
        }
      };

      recorder.start();
      setState('recording');
      timerRef.current = window.setTimeout(stop, MAX_SECONDS * 1000);
    } catch (e) {
      releaseMic();
      setState('idle');
      setError(e instanceof Error ? e.message : 'Could not start recording.');
    }
  }, [stop]);

  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
      }
      releaseMic();
    },
    []
  );

  return { state, error, status, start, stop, clearError: () => setError(null) };
}
