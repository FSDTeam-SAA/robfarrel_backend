import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Envelope every AI module returns (sync response, async callback, job status). */
export interface AiEnvelope {
  request_id: string;
  status: 'completed' | 'partial' | 'failed' | 'accepted' | 'running';
  job_id?: string;
  results?: any;
  errors?: {
    module: string;
    code: string;
    message: string;
    retryable: boolean;
  }[];
  usage?: any[];
  total_tokens?: number;
  config_version?: string;
  prompt_version?: string;
}

/** Thin HTTP client for the AI microservice; credits and persistence live in AiService. */
@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);

  constructor(private readonly configService: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('ai.serviceUrl') &&
      this.configService.get<string>('ai.internalSecret'),
    );
  }

  async post(path: string, body: Record<string, any>): Promise<AiEnvelope> {
    if (!this.isConfigured) {
      throw new HttpException(
        'AI service is not configured (AI_SERVICE_URL / AI_SERVICE_INTERNAL_SECRET)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const url = `${this.configService.get<string>('ai.serviceUrl')}${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Internal-Secret':
            this.configService.get<string>('ai.internalSecret'),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(
          this.configService.get<number>('ai.requestTimeoutMs'),
        ),
      });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === 'TimeoutError';
      this.logger.error(
        `AI call ${path} failed: ${err instanceof Error ? err.message : err}`,
      );
      throw new HttpException(
        timedOut ? 'AI service timed out' : 'AI service is unreachable',
        timedOut ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.BAD_GATEWAY,
      );
    }

    const payload: any = await response.json().catch(() => null);
    if (!response.ok) {
      throw new HttpException(
        aiErrorMessage(payload, response.status),
        mapAiStatus(response.status),
      );
    }
    if (!payload || typeof payload !== 'object') {
      throw new HttpException(
        'AI service returned an invalid body',
        HttpStatus.BAD_GATEWAY,
      );
    }
    return payload as AiEnvelope;
  }
}

/** First AI error message (FastAPI 422 uses `detail`). */
function aiErrorMessage(payload: any, status: number): string {
  const first = payload?.errors?.[0]?.message;
  if (first) return `AI service: ${first}`;
  const detail = payload?.detail?.[0];
  if (detail?.msg)
    return `AI service: ${[...(detail.loc ?? [])].join('.')} ${detail.msg}`.trim();
  return `AI service returned HTTP ${status}`;
}

/** Caller mistakes stay 4xx; AI auth/config problems are our fault, so 502/503. */
function mapAiStatus(status: number): number {
  if (status === 401 || status === 403) return HttpStatus.BAD_GATEWAY;
  if (status === 422 || status === 400) return HttpStatus.BAD_REQUEST;
  if (status === 404) return HttpStatus.NOT_FOUND;
  if (status === 503) return HttpStatus.SERVICE_UNAVAILABLE;
  return HttpStatus.BAD_GATEWAY;
}
