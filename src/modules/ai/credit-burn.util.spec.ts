import {
  applyBurn,
  creditsForTokens,
  isChargeable,
  signCallback,
  verifyCallbackSignature,
} from './credit-burn.util';

describe('creditsForTokens', () => {
  it('charges 1 credit per tokensPerCredit, rounded up', () => {
    expect(creditsForTokens(0, 1000)).toBe(0);
    expect(creditsForTokens(1, 1000)).toBe(1);
    expect(creditsForTokens(1000, 1000)).toBe(1);
    expect(creditsForTokens(1001, 1000)).toBe(2);
    expect(creditsForTokens(2500, 500)).toBe(5);
  });

  it('treats missing or negative tokens as free and rejects a bad rate', () => {
    expect(creditsForTokens(NaN, 1000)).toBe(0);
    expect(creditsForTokens(-5, 1000)).toBe(0);
    expect(() => creditsForTokens(10, 0)).toThrow();
  });
});

describe('isChargeable / applyBurn', () => {
  it('charges completed and partial runs only', () => {
    expect(isChargeable('completed')).toBe(true);
    expect(isChargeable('partial')).toBe(true);
    expect(isChargeable('failed')).toBe(false);
    expect(isChargeable('running')).toBe(false);
  });

  it('never takes the balance below zero', () => {
    expect(applyBurn(10, 3)).toEqual({ creditsDeducted: 3, balanceAfter: 7 });
    expect(applyBurn(2, 5)).toEqual({ creditsDeducted: 2, balanceAfter: 0 });
    expect(applyBurn(0, 5)).toEqual({ creditsDeducted: 0, balanceAfter: 0 });
  });
});

describe('callback signature', () => {
  // Produced by the AI service: src/utils/signing.py sign_payload("cb-secret", 1700000000, body)
  const body = Buffer.from(
    '{"request_id":"6adae5831332136ef3506aac","status":"completed","total_tokens":2500}',
  );
  const pythonSignature =
    'sha256=3a694fcceb8af00730ab292bdaeaac04b7023f34de9c063f54aed048b41638cd';

  it('matches the AI service signer byte for byte', () => {
    expect(signCallback('cb-secret', '1700000000', body)).toBe(pythonSignature);
  });

  const base = {
    secret: 'cb-secret',
    rawBody: body,
    timestamp: '1700000000',
    signature: pythonSignature,
    maxAgeSeconds: 300,
    nowSeconds: 1700000100,
  };

  it('accepts a fresh, correctly signed callback', () => {
    expect(verifyCallbackSignature(base)).toBe(true);
  });

  it('rejects tampering, wrong secrets, stale timestamps and missing headers', () => {
    expect(
      verifyCallbackSignature({ ...base, rawBody: Buffer.from(`${body} `) }),
    ).toBe(false);
    expect(verifyCallbackSignature({ ...base, secret: 'other' })).toBe(false);
    expect(verifyCallbackSignature({ ...base, nowSeconds: 1700000301 })).toBe(
      false,
    );
    expect(verifyCallbackSignature({ ...base, signature: undefined })).toBe(
      false,
    );
    expect(verifyCallbackSignature({ ...base, timestamp: 'abc' })).toBe(false);
    expect(verifyCallbackSignature({ ...base, secret: '' })).toBe(false);
  });
});
