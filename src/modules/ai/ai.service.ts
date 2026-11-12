import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserDocument } from '../auth/schemas/user.schema';
import {
  PropertyAnalysis,
  PropertyAnalysisDocument,
} from '../property-analysis/schemas/property-analysis.schema';
import { CloudinaryService } from '../../infrastructure/cloudinary/cloudinary.service';
import { RoleType } from '../../common/enums/role.enum';
import {
  createMeta,
  createPaginationInfo,
} from '../../common/utils/pagination.util';
import { AI_MODULES, AiModuleKey } from './ai-modules';
import { AiClientService, AiEnvelope } from './ai-client.service';
import { CreditBurnService } from './credit-burn.service';
import { verifyCallbackSignature } from './credit-burn.util';
import {
  mapPropertyAnalysisToProject,
  mergeProject,
} from './project-mapper.util';
import { AiRun, AiRunDocument } from './schemas/ai-run.schema';
import { AiRunsQueryDto } from './dto/ai.dto';

const FINAL_STATUSES = ['completed', 'partial', 'failed'];

/**
 * Frontend → backend → AI service → backend (store + burn credits) → frontend.
 * Sync modules finish in one request; async modules (visualize, analysis_run) finish when the
 * AI service posts its signed callback, and the frontend polls GET /ai/runs/:id.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectModel(AiRun.name) private readonly aiRunModel: Model<AiRunDocument>,
    @InjectModel(PropertyAnalysis.name)
    private readonly propertyAnalysisModel: Model<PropertyAnalysisDocument>,
    private readonly aiClient: AiClientService,
    private readonly creditBurn: CreditBurnService,
    private readonly cloudinary: CloudinaryService,
    private readonly configService: ConfigService,
  ) {}

  async run(user: UserDocument, key: AiModuleKey, dto: Record<string, any>) {
    const definition = AI_MODULES[key];
    const isAsync = definition.mode === 'async';
    if (!this.aiClient.isConfigured) {
      throw new HttpException(
        'AI service is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (isAsync && !this.callbackUrl()) {
      throw new HttpException(
        'Async AI jobs need BACKEND_PUBLIC_URL and AI_CALLBACK_SIGNING_SECRET',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    await this.creditBurn.assertCanRun(user._id);

    const runId = new Types.ObjectId();
    const request: Record<string, any> = { request_id: runId.toString() };
    let propertyAnalysisId: Types.ObjectId | null = null;
    if (definition.usesProject) {
      const resolved = await this.resolveProject(
        dto.propertyAnalysisId,
        dto.project,
      );
      propertyAnalysisId = resolved.propertyAnalysisId;
      request.run_type = user.role === RoleType.TENANT ? 'tenant' : 'landlord';
      request.project = resolved.project;
    }
    for (const field of definition.fields) {
      if (dto[field] !== undefined) request[field] = dto[field];
    }
    if (dto.config_overrides) request.config_overrides = dto.config_overrides;
    if (isAsync) request.callback_url = this.callbackUrl();

    const run = await this.aiRunModel.create({
      _id: runId,
      user: user._id,
      module: key,
      status: 'pending',
      propertyAnalysis: propertyAnalysisId,
      request,
    });

    let envelope: AiEnvelope;
    try {
      envelope = await this.aiClient.post(definition.path, request);
    } catch (err) {
      run.status = 'failed';
      run.aiErrors = [
        { module: key, code: 'ai_request_failed', message: errorMessage(err) },
      ];
      run.completedAt = new Date();
      await run.save();
      throw err;
    }

    if (isAsync) {
      // Conditional: a fast callback may already have finished the run.
      await this.aiRunModel.updateOne(
        { _id: run._id, status: 'pending' },
        { $set: { status: 'running', jobId: envelope.job_id ?? null } },
      );
      const current = (await this.aiRunModel.findById(run._id)) ?? run;
      return {
        message: 'AI job accepted; poll the run for the result',
        data: this.summary(current),
      };
    }

    await this.applyEnvelope(run, envelope);
    await this.creditBurn.chargeRun(run);
    return { message: `AI ${key} completed`, data: this.summary(run, true) };
  }

  /** Signed result of an async job. Retried deliveries are acknowledged without re-charging. */
  async handleCallback(
    rawBody: Buffer,
    timestamp?: string,
    signature?: string,
  ) {
    const valid = verifyCallbackSignature({
      secret: this.configService.get<string>('ai.callbackSigningSecret'),
      rawBody,
      timestamp,
      signature,
      maxAgeSeconds: this.configService.get<number>('ai.callbackMaxAgeSeconds'),
    });
    if (!valid)
      throw new HttpException(
        'Invalid callback signature',
        HttpStatus.UNAUTHORIZED,
      );

    let envelope: AiEnvelope;
    try {
      envelope = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new HttpException(
        'Callback body is not JSON',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!Types.ObjectId.isValid(envelope?.request_id)) {
      throw new HttpException('Unknown request_id', HttpStatus.NOT_FOUND);
    }
    const run = await this.aiRunModel.findById(envelope.request_id);
    if (!run)
      throw new HttpException('Unknown request_id', HttpStatus.NOT_FOUND);

    if (!(FINAL_STATUSES.includes(run.status) && run.creditsCharged !== null)) {
      if (run.module === 'visualize')
        await this.storeVisualizations(run, envelope);
      await this.applyEnvelope(run, envelope);
      await this.creditBurn.chargeRun(run);
    }
    return {
      message: 'Callback received',
      data: { received: true, runId: run._id },
    };
  }

  async getRun(user: UserDocument, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException('Invalid run id', HttpStatus.BAD_REQUEST);
    }
    const filter: Record<string, any> = { _id: id };
    if (user.role !== RoleType.ADMIN) filter.user = user._id;
    const run = await this.aiRunModel.findOne(filter);
    if (!run) throw new HttpException('AI run not found', HttpStatus.NOT_FOUND);
    return {
      message: 'AI run fetched successfully',
      data: this.summary(run, true),
    };
  }

  async listRuns(user: UserDocument, query: AiRunsQueryDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const filter: Record<string, any> = { user: user._id };
    if (query.module) filter.module = query.module;
    if (query.status) filter.status = query.status;
    const [runs, total] = await Promise.all([
      this.aiRunModel
        .find(filter)
        .select('-request -results -usage')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.aiRunModel.countDocuments(filter),
    ]);
    return {
      message: 'AI runs fetched successfully',
      meta: createMeta(page, limit, total),
      data: { runs, paginationInfo: createPaginationInfo(page, limit, total) },
    };
  }

  private async resolveProject(
    propertyAnalysisId?: string,
    project?: Record<string, any>,
  ) {
    let base: Record<string, any> = {};
    let analysisId: Types.ObjectId | null = null;
    if (propertyAnalysisId) {
      const analysis = await this.propertyAnalysisModel
        .findById(propertyAnalysisId)
        .lean();
      if (!analysis)
        throw new HttpException(
          'Property analysis not found',
          HttpStatus.NOT_FOUND,
        );
      base = mapPropertyAnalysisToProject(analysis);
      analysisId = analysis._id as Types.ObjectId;
    } else if (!project) {
      throw new HttpException(
        'propertyAnalysisId or project is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    return {
      project: mergeProject(base, project),
      propertyAnalysisId: analysisId,
    };
  }

  private async applyEnvelope(run: AiRunDocument, envelope: AiEnvelope) {
    const status = FINAL_STATUSES.includes(envelope.status)
      ? envelope.status
      : 'failed';
    const usage = Array.isArray(envelope.usage) ? envelope.usage : [];
    run.status = status as AiRunDocument['status'];
    run.results = envelope.results ?? null;
    run.aiErrors = [...(run.aiErrors ?? []), ...(envelope.errors ?? [])];
    run.usage = usage;
    // Older AI builds omit total_tokens; fall back to summing usage[].
    run.totalTokens = Number.isFinite(envelope.total_tokens)
      ? envelope.total_tokens
      : usage.reduce(
          (sum, item) =>
            sum + (item.input_tokens || 0) + (item.output_tokens || 0),
          0,
        );
    run.jobId = envelope.job_id ?? run.jobId ?? null;
    run.configVersion = envelope.config_version ?? null;
    run.promptVersion = envelope.prompt_version ?? null;
    run.completedAt = new Date();
    run.markModified('results');
    run.markModified('usage');
    await run.save();
  }

  /** Move base64 renders to Cloudinary so MongoDB stores URLs, not megabytes of image data. */
  private async storeVisualizations(run: AiRunDocument, envelope: AiEnvelope) {
    const images: string[] = envelope.results?.images_base64 ?? [];
    if (!images.length) return;
    try {
      const uploaded = await Promise.all(
        images.map((data, index) =>
          this.cloudinary.upload(
            `data:image/png;base64,${data}`,
            `${run._id}-${index + 1}`,
            'ai-visualizations',
          ),
        ),
      );
      envelope.results = {
        ...envelope.results,
        images_base64: [],
        image_urls: uploaded.map((item) => item.url),
      };
    } catch (err) {
      this.logger.error(
        `Visualization upload failed for run ${run._id}: ${errorMessage(err)}`,
      );
      envelope.errors = [
        ...(envelope.errors ?? []),
        {
          module: 'visualize_storage',
          code: 'upload_failed',
          message:
            'Rendered images could not be stored; base64 images were kept.',
          retryable: true,
        },
      ];
    }
  }

  private callbackUrl(): string | null {
    const publicUrl = this.configService.get<string>('ai.publicUrl');
    const secret = this.configService.get<string>('ai.callbackSigningSecret');
    return publicUrl && secret ? `${publicUrl}/api/v1/ai/callback` : null;
  }

  private summary(run: AiRunDocument, withResults = false) {
    return {
      runId: run._id,
      module: run.module,
      status: run.status,
      jobId: run.jobId ?? null,
      propertyAnalysis: run.propertyAnalysis ?? null,
      totalTokens: run.totalTokens,
      creditsCharged: run.creditsCharged ?? null,
      ...(withResults && {
        results: run.results ?? null,
        errors: run.aiErrors ?? [],
        usage: run.usage ?? [],
        configVersion: run.configVersion ?? null,
        promptVersion: run.promptVersion ?? null,
        completedAt: run.completedAt ?? null,
      }),
      createdAt: (run as any).createdAt,
    };
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof HttpException) return String(err.message);
  return err instanceof Error ? err.message : String(err);
}
