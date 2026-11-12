import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { AiRun, AiRunDocument } from './schemas/ai-run.schema';
import {
  CreditUsage,
  CreditUsageDocument,
} from './schemas/credit-usage.schema';
import { applyBurn, creditsForTokens, isChargeable } from './credit-burn.util';
import {
  createFilter,
  createMeta,
  createPaginationInfo,
} from '../../common/utils/pagination.util';
import { CreditUsageQueryDto } from './dto/ai.dto';

/** Converts AI tokens into credits and deducts them exactly once per run. */
@Injectable()
export class CreditBurnService {
  private readonly logger = new Logger(CreditBurnService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(AiRun.name) private readonly aiRunModel: Model<AiRunDocument>,
    @InjectModel(CreditUsage.name)
    private readonly usageModel: Model<CreditUsageDocument>,
    private readonly configService: ConfigService,
  ) {}

  get tokensPerCredit(): number {
    return this.configService.get<number>('ai.tokensPerCredit');
  }

  /** 402 before any AI spend when the balance is below AI_MIN_CREDITS_TO_RUN. */
  async assertCanRun(userId: string | Types.ObjectId) {
    const user = await this.userModel.findById(userId).select('creditBalance');
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    const required = this.configService.get<number>('ai.minCreditsToRun');
    if ((user.creditBalance || 0) < required) {
      throw new HttpException(
        `Insufficient credits: at least ${required} credit(s) are required to run AI analysis`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  /**
   * Burn credits for a finished run. Idempotent: the run is claimed atomically, so a retried
   * callback or a duplicate call never charges twice. Failed runs are claimed with 0 credits.
   */
  async chargeRun(run: AiRunDocument): Promise<CreditUsageDocument | null> {
    const claimed = await this.aiRunModel.findOneAndUpdate(
      {
        _id: run._id,
        creditsCharged: null,
        status: { $in: ['completed', 'partial', 'failed'] },
      },
      { $set: { creditsCharged: 0 } },
      { new: true },
    );
    if (!claimed) return null;
    run.creditsCharged = 0;
    if (!isChargeable(claimed.status)) return null;

    const tokensPerCredit = this.tokensPerCredit;
    const creditsBurned = creditsForTokens(
      claimed.totalTokens,
      tokensPerCredit,
    );
    if (creditsBurned === 0) return null;

    // Deduct atomically and never below zero; `before` is the pre-update document.
    const before = await this.userModel.findOneAndUpdate(
      { _id: claimed.user },
      [
        {
          $set: {
            creditBalance: {
              $max: [
                0,
                {
                  $subtract: [
                    { $ifNull: ['$creditBalance', 0] },
                    creditsBurned,
                  ],
                },
              ],
            },
          },
        },
      ],
      { new: false, projection: { creditBalance: 1 } },
    );
    const { creditsDeducted, balanceAfter } = applyBurn(
      before?.creditBalance ?? 0,
      creditsBurned,
    );
    if (creditsDeducted < creditsBurned) {
      this.logger.warn(
        `Run ${claimed._id}: burned ${creditsBurned} credits but only ${creditsDeducted} were available`,
      );
    }

    await this.aiRunModel.updateOne(
      { _id: claimed._id },
      { $set: { creditsCharged: creditsDeducted } },
    );
    run.creditsCharged = creditsDeducted;
    return this.usageModel.create({
      user: claimed.user,
      aiRun: claimed._id,
      module: claimed.module,
      totalTokens: claimed.totalTokens,
      tokensPerCredit,
      creditsBurned,
      creditsDeducted,
      balanceBefore: before?.creditBalance ?? 0,
      balanceAfter,
    });
  }

  // ─── User: own credit burn history ─────────────────────
  async getMyUsage(userId: string, query: CreditUsageQueryDto) {
    const result = await this.list({ ...query, userId });
    const user = await this.userModel.findById(userId).select('creditBalance');
    const [totals] = await this.usageModel.aggregate([
      { $match: { user: new Types.ObjectId(userId) } },
      this.totalsStage(),
    ]);
    return {
      message: 'Credit usage fetched successfully',
      meta: result.meta,
      data: {
        creditBalance: user?.creditBalance ?? 0,
        tokensPerCredit: this.tokensPerCredit,
        totals: this.totalsOf(totals),
        usage: result.usage,
        paginationInfo: result.paginationInfo,
      },
    };
  }

  // ─── Admin: every user's credit burn ───────────────────
  async getAllUsage(query: CreditUsageQueryDto) {
    const result = await this.list(query, true);
    const [totals] = await this.usageModel.aggregate([
      { $match: result.filter },
      this.totalsStage(),
    ]);
    return {
      message: 'Credit usage fetched successfully',
      meta: result.meta,
      data: {
        tokensPerCredit: this.tokensPerCredit,
        totals: this.totalsOf(totals),
        usage: result.usage,
        paginationInfo: result.paginationInfo,
      },
    };
  }

  /** Credits actually deducted in [from, to); used by the admin dashboard. */
  async creditsConsumed(from?: Date, to?: Date): Promise<number> {
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.$gte = from;
    if (to) createdAt.$lt = to;
    const [row] = await this.usageModel.aggregate([
      { $match: Object.keys(createdAt).length ? { createdAt } : {} },
      { $group: { _id: null, credits: { $sum: '$creditsDeducted' } } },
    ]);
    return row?.credits || 0;
  }

  private async list(
    query: CreditUsageQueryDto & { userId?: string },
    withUser = false,
  ) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const filter: Record<string, any> = createFilter(undefined, query.date);
    if (query.userId) {
      if (!Types.ObjectId.isValid(query.userId)) {
        throw new HttpException('Invalid user id', HttpStatus.BAD_REQUEST);
      }
      filter.user = new Types.ObjectId(query.userId);
    }
    if (query.module) filter.module = query.module;

    const find = this.usageModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    if (withUser) find.populate('user', 'name email role');
    const [usage, total] = await Promise.all([
      find,
      this.usageModel.countDocuments(filter),
    ]);
    return {
      filter,
      usage,
      meta: createMeta(page, limit, total),
      paginationInfo: createPaginationInfo(page, limit, total),
    };
  }

  private totalsStage() {
    return {
      $group: {
        _id: null,
        runs: { $sum: 1 },
        totalTokens: { $sum: '$totalTokens' },
        creditsBurned: { $sum: '$creditsBurned' },
        creditsDeducted: { $sum: '$creditsDeducted' },
      },
    };
  }

  private totalsOf(row?: any) {
    return {
      runs: row?.runs || 0,
      totalTokens: row?.totalTokens || 0,
      creditsBurned: row?.creditsBurned || 0,
      creditsDeducted: row?.creditsDeducted || 0,
    };
  }
}
