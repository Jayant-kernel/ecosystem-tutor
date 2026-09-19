import { ConfigError, TimeoutError, UpstreamError, BadRequestError } from './errors.mjs';

const STT_URL = 'https://api.elevenlabs.io/v1/speech-to-text';
const TTS_BASE_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

const MIME_EXTENSIONS = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/flac': 'flac',
};

const SUPPORTED_MIME_PREFIXES = ['audio/'];
const SUPPORTED_MIME_EXACT = ['video/webm', 'application/octet-stream'];

export function assertSupportedAudio(mimeType, byteLength) {
  if (!byteLength) throw new BadRequestError('Audio payload is empty');
  const type = (mimeType || '').split(';')[0].trim().toLowerCase();
  const supported =
    SUPPORTED_MIME_PREFIXES.some((p) => type.startsWith(p)) ||
    SUPPORTED_MIME_EXACT.includes(type);
  if (type && !supported) {
    throw new BadRequestError(`Unsupported audio format: ${type}`);
  }
}

export function extensionFor(mimeType) {
  const type = (mimeType || '').split(';')[0].trim().toLowerCase();
  return MIME_EXTENSIONS[type] || 'webm';
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new TimeoutError('ElevenLabs request timed out');
    }
    throw new UpstreamError('ElevenLabs', 0, error?.message);
  } finally {
    clearTimeout(timer);
  }
}

async function readErrorDetail(response) {
  try {
    const body = await response.text();
    return body.slice(0, 500);
  } catch {
    return '';
  }
}

/**
 * audio bytes -> transcript text.
 * Returns '' for silent/unintelligible audio (caller decides how to respond).
 */
export async function speechToText(audioBuffer, mimeType, options = {}) {
  const {
    apiKey = process.env.ELEVENLABS_API_KEY,
    modelId = process.env.STT_MODEL_ID || 'scribe_v2',
    fetchImpl = fetch,
    timeoutMs = 30000,
  } = options;

  if (!apiKey) throw new ConfigError('ELEVENLABS_API_KEY is not set');
  assertSupportedAudio(mimeType, audioBuffer?.length);

  const form = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType || 'audio/webm' });
  form.append('file', blob, `audio.${extensionFor(mimeType)}`);
  form.append('model_id', modelId);

  const response = await fetchWithTimeout(
    fetchImpl,
    STT_URL,
    { method: 'POST', headers: { 'xi-api-key': apiKey }, body: form },
    timeoutMs,
  );

  if (!response.ok) {
    throw new UpstreamError('ElevenLabs STT', response.status, await readErrorDetail(response));
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new UpstreamError('ElevenLabs STT', response.status, 'malformed JSON response');
  }

  if (typeof data?.text !== 'string') {
    throw new UpstreamError('ElevenLabs STT', response.status, 'missing text field');
  }

  return data.text.trim();
}

const clamp01 = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
};

const clampSpeed = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1.2, Math.max(0.7, n)) : fallback;
};

export const DEFAULT_TTS_MODEL = 'eleven_turbo_v2_5';
export const DEFAULT_TTS_OUTPUT_FORMAT = 'mp3_44100_64';

/**
 * Delivery settings, all env-tunable.
 *
 * Low `stability` + some `style` is what produces the rise and fall of real
 * speech instead of a flat read; `use_speaker_boost` keeps quiet syllables
 * audible; `speed` is nudged below 1 so the tutor does not race the learner.
 */
function voiceSettingsFor(env) {
  return {
    stability: clamp01(env.TTS_STABILITY, 0.3),
    similarity_boost: clamp01(env.TTS_SIMILARITY, 0.75),
    style: clamp01(env.TTS_STYLE, 0.45),
    use_speaker_boost: true,
    speed: clampSpeed(env.TTS_SPEED, 0.88),
  };
}

/** The universally supported pair, used if a model rejects style/speed. */
const SAFE_VOICE_SETTINGS = { stability: 0.4, similarity_boost: 0.75 };

/**
 * response text -> audio bytes.
 */
export async function textToSpeech(text, options = {}) {
  const {
    apiKey = process.env.ELEVENLABS_API_KEY,
    voiceId = process.env.ELEVENLABS_VOICE_ID,
    modelId = process.env.TTS_MODEL_ID || DEFAULT_TTS_MODEL,
    outputFormat = process.env.TTS_OUTPUT_FORMAT || DEFAULT_TTS_OUTPUT_FORMAT,
    settings = null,
    fetchImpl = fetch,
    timeoutMs = 30000,
  } = options;

  if (!apiKey) throw new ConfigError('ELEVENLABS_API_KEY is not set');
  if (!voiceId) throw new ConfigError('ELEVENLABS_VOICE_ID is not set');
  if (!text || !text.trim()) throw new BadRequestError('Cannot synthesize empty text');

  const url = `${TTS_BASE_URL}/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`;

  const send = (voiceSettings) =>
    fetchWithTimeout(
      fetchImpl,
      url,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'content-type': 'application/json',
          accept: 'audio/mpeg',
        },
        body: JSON.stringify({ text, model_id: modelId, voice_settings: voiceSettings }),
      },
      timeoutMs,
    );

  let response = await send(settings || voiceSettingsFor(process.env));

  // Not every model accepts style/speed. Fall back to the safe pair rather than
  // failing the whole turn on a settings mismatch.
  if (!response.ok && (response.status === 400 || response.status === 422)) {
    const detail = await readErrorDetail(response);
    response = await send(SAFE_VOICE_SETTINGS);
    if (!response.ok) {
      throw new UpstreamError('ElevenLabs TTS', response.status, detail || (await readErrorDetail(response)));
    }
  } else if (!response.ok) {
    throw new UpstreamError('ElevenLabs TTS', response.status, await readErrorDetail(response));
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) {
    throw new UpstreamError('ElevenLabs TTS', response.status, 'empty audio response');
  }

  return {
    buffer,
    mimeType: response.headers?.get?.('content-type') || 'audio/mpeg',
  };
}
