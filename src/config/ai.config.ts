import { registerAs } from '@nestjs/config';

const int = (value: string | undefined, fallback: number) => {
  const parsed = parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export default registerAs('ai', () => ({
  /** Base URL of the AI microservice, e.g. https://visionitforme-ai.onrender.com */
  serviceUrl: (process.env.AI_SERVICE_URL || '').replace(/\/+$/, ''),
  /** Sent as X-Internal-Secret on every call; must equal the AI service's value */
  internalSecret: process.env.AI_SERVICE_INTERNAL_SECRET || '',
  /** Verifies X-Signature on async-job callbacks; must equal the AI service's value */
  callbackSigningSecret: process.env.AI_CALLBACK_SIGNING_SECRET || '',
  /** Public URL of this backend (no /api/v1); the AI service posts callbacks here */
  publicUrl: (process.env.BACKEND_PUBLIC_URL || '').replace(/\/+$/, ''),
  /** Credit burn rate: 1 credit per this many AI tokens (rounded up per run) */
  tokensPerCredit: int(process.env.AI_TOKENS_PER_CREDIT, 1000),
  /** Minimum balance a user needs before an AI run is started */
  minCreditsToRun: int(process.env.AI_MIN_CREDITS_TO_RUN, 1),
  /** Timeout for synchronous AI calls */
  requestTimeoutMs: int(process.env.AI_REQUEST_TIMEOUT_MS, 180000),
  /** Callbacks with an older X-Signature-Timestamp are rejected */
  callbackMaxAgeSeconds: int(process.env.AI_CALLBACK_MAX_AGE_SECONDS, 300),
}));
