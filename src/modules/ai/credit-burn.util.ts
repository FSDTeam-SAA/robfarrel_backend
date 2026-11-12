import { createHmac, timingSafeEqual } from 'crypto';

/** Credits burned for a run: 1 credit per `tokensPerCredit` tokens, rounded up. */
export function creditsForTokens(
  totalTokens: number,
  tokensPerCredit: number,
): number {
  if (!Number.isFinite(totalTokens) || totalTokens <= 0) return 0;
  if (!Number.isFinite(tokensPerCredit) || tokensPerCredit <= 0) {
    throw new Error('tokensPerCredit must be a positive number');
  }
  return Math.ceil(totalTokens / tokensPerCredit);
}

/** Only completed/partial runs burn credits; a failed run is free. */
export function isChargeable(status: string): boolean {
  return status === 'completed' || status === 'partial';
}

/** Deduct up to the available balance; the balance never goes negative. */
export function applyBurn(balanceBefore: number, creditsBurned: number) {
  const before = Math.max(0, balanceBefore || 0);
  const deducted = Math.min(before, creditsBurned);
  return { creditsDeducted: deducted, balanceAfter: before - deducted };
}

/** `sha256=<hex HMAC-SHA256(secret, "{timestamp}.{rawBody}")>` — the AI service's callback signature. */
export function signCallback(
  secret: string,
  timestamp: string,
  rawBody: Buffer,
): string {
  const digest = createHmac('sha256', secret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`), rawBody]))
    .digest('hex');
  return `sha256=${digest}`;
}

/** Constant-time signature check plus a freshness window against replays. */
export function verifyCallbackSignature(params: {
  secret: string;
  rawBody: Buffer;
  timestamp?: string;
  signature?: string;
  maxAgeSeconds: number;
  nowSeconds?: number;
}): boolean {
  const { secret, rawBody, timestamp, signature, maxAgeSeconds } = params;
  if (
    !secret ||
    !rawBody ||
    !timestamp ||
    !signature ||
    !/^\d+$/.test(timestamp)
  )
    return false;
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > maxAgeSeconds) return false;
  const expected = Buffer.from(signCallback(secret, timestamp, rawBody));
  const supplied = Buffer.from(signature);
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}
