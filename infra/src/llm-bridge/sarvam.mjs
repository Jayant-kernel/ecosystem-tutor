import { BadRequestError, ConfigError, TimeoutError, UpstreamError } from './errors.mjs';

const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech';

export const DEFAULT_SARVAM_TTS_MODEL = 'bulbul:v3';
export const DEFAULT_SARVAM_TTS_SPEAKER = 'shubh';
export const DEFAULT_SARVAM_TTS_LANGUAGE_CODE = 'en-IN';
export const DEFAULT_SARVAM_TTS_OUTPUT_AUDIO_CODEC = 'mp3';
export const DEFAULT_SARVAM_TTS_SAMPLE_RATE = 24000;

const MIME_TYPES = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  linear16: 'audio/L16',
  mulaw: 'audio/basic',
  alaw: 'audio/basic',
  opus: 'audio/opus',
  flac: 'audio/flac',
  aac: 'audio/aac',
};

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new TimeoutError('Sarvam TTS request timed out');
    }
    throw new UpstreamError('Sarvam TTS', 0, error?.message);
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

function numberInRange(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function intFrom(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

function sarvamPayload(text, env) {
  const outputAudioCodec =
    env.SARVAM_TTS_OUTPUT_AUDIO_CODEC ||
    env.TTS_OUTPUT_AUDIO_CODEC ||
    DEFAULT_SARVAM_TTS_OUTPUT_AUDIO_CODEC;

  return {
    text,
    language_code: env.SARVAM_TTS_LANGUAGE_CODE || DEFAULT_SARVAM_TTS_LANGUAGE_CODE,
    speaker: (env.SARVAM_TTS_SPEAKER || DEFAULT_SARVAM_TTS_SPEAKER).toLowerCase(),
    model: env.SARVAM_TTS_MODEL || DEFAULT_SARVAM_TTS_MODEL,
    pace: numberInRange(env.SARVAM_TTS_PACE || env.TTS_SPEED, 0.88, 0.5, 2.0),
    speech_sample_rate: intFrom(env.SARVAM_TTS_SAMPLE_RATE, DEFAULT_SARVAM_TTS_SAMPLE_RATE),
    output_audio_codec: outputAudioCodec,
    temperature: numberInRange(env.SARVAM_TTS_TEMPERATURE, 0.6, 0.01, 2.0),
  };
}

/**
 * Sarvam text -> audio bytes.
 *
 * Sarvam returns JSON with base64 audio chunks, so this adapter decodes those
 * chunks into the same shape the existing frontend already consumes.
 */
export async function textToSpeech(text, options = {}) {
  const {
    apiKey = process.env.SARVAM_API_KEY,
    env = process.env,
    fetchImpl = fetch,
    timeoutMs = 30000,
  } = options;

  if (!apiKey) throw new ConfigError('SARVAM_API_KEY is not set');
  if (!text || !text.trim()) throw new BadRequestError('Cannot synthesize empty text');

  const body = sarvamPayload(text, env);
  const response = await fetchWithTimeout(
    fetchImpl,
    SARVAM_TTS_URL,
    {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );

  if (!response.ok) {
    throw new UpstreamError('Sarvam TTS', response.status, await readErrorDetail(response));
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new UpstreamError('Sarvam TTS', response.status, 'malformed JSON response');
  }

  if (!Array.isArray(data?.audios) || data.audios.some((part) => typeof part !== 'string')) {
    throw new UpstreamError('Sarvam TTS', response.status, 'missing audios field');
  }

  const buffer = Buffer.from(data.audios.join(''), 'base64');
  if (!buffer.length) {
    throw new UpstreamError('Sarvam TTS', response.status, 'empty audio response');
  }

  return {
    buffer,
    mimeType: MIME_TYPES[body.output_audio_codec] || 'audio/wav',
  };
}
