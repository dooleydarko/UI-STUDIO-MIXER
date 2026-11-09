/**
 * Offline speech-to-text using Whisper (base, English) through transformers.js.
 * The library and model are loaded on first use, so they cost nothing until you dictate.
 * The first run downloads the model (about 75 MB) and then it is cached on this Mac.
 */

type Transcriber = (audio: Float32Array) => Promise<{ text: string } | { text: string }[]>;

let transcriberPromise: Promise<Transcriber> | null = null;

function loadTranscriber(onStatus: (message: string) => void): Promise<Transcriber> {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      onStatus('Loading the speech model...');
      const { pipeline } = await import('@huggingface/transformers');
      const asr = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base.en', {
        progress_callback: (p: { status?: string; progress?: number }) => {
          if (p.status === 'progress' && typeof p.progress === 'number') {
            onStatus(`Downloading the speech model (first time only): ${Math.round(p.progress)}%`);
          }
        },
      });
      return asr as unknown as Transcriber;
    })().catch((e) => {
      transcriberPromise = null; // allow a retry after a failed download
      throw e;
    });
  }
  return transcriberPromise;
}

/** Decodes a recording to the 16 kHz mono samples Whisper expects. */
async function toWhisperAudio(blob: Blob): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate: 16000 });
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    return new Float32Array(decoded.getChannelData(0));
  } finally {
    void ctx.close();
  }
}

export async function transcribeLocally(blob: Blob, onStatus: (message: string) => void): Promise<string> {
  const transcriber = await loadTranscriber(onStatus);
  onStatus('Transcribing...');
  const audio = await toWhisperAudio(blob);
  const result = await transcriber(audio);
  const text = Array.isArray(result) ? result.map((r) => r.text).join(' ') : result.text;
  return text.trim();
}
