import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { User, UserDocument } from '../auth/schemas/user.schema';
import {
  CreditTransaction,
  CreditTransactionDocument,
} from './schemas/credit-transaction.schema';
import { CreditPlanService } from '../credit-plan/credit-plan.service';import { RoleType } from '../../common/enums/role.enum';
import {
  createFilter,
  createMeta,
  createPaginationInfo,
} from '../../common/utils/pagination.util';
import { GetCreditPurchasesQueryDto } from './dto/credit-purchase.dto';

@Injectable()
export class CreditPurchaseService {
  private stripe: Stripe;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(CreditTransaction.name)
    private readonly transactionModel: Model<CreditTransactionDocument>,
    private readonly configService: ConfigService,
    private readonly creditPlanService: CreditPlanService,
  ) {
    this.stripe = new Stripe(this.configService.get<string>('stripe.secretKey'));
  }

  // ─── User: Buy Plan → get Stripe checkout URL ─────────
  async createCheckout(userId: string, planId: string) {
        const { data: plan } = await this.creditPlanService.getById(planId);
    if (!plan) throw new HttpException('Credit plan not found', HttpStatus.NOT_FOUND);

    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    const priceInCents = Math.round(plan.discountedPrice * 100);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: plan.title, description: plan.description },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId.toString(),
        planId: planId.toString(),
        creditVolume: plan.creditVolume.toString(),
        amountPaid: plan.discountedPrice.toString(),
      },
      success_url: `${this.configService.get('app.frontendUrl')}/payment-success`,
      cancel_url: `${this.configService.get('app.frontendUrl')}/payment-cancel`,
    });

    await this.transactionModel.create({
      user: user._id,
      plan: plan._id,
      amountPaid: plan.discountedPrice,
      creditsAdded: plan.creditVolume,
      status: 'pending',
      stripeSessionId: session.id,
    });

    return { message: 'Checkout session created', data: { url: session.url } };
  }

  // ─── Stripe Webhook ────────────────────────────────────
  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: any;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.configService.get<string>('stripe.webhookSecret'),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(`Webhook Error: ${message}`, HttpStatus.BAD_REQUEST);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const { userId, creditVolume } = session.metadata;

      const transaction = await this.transactionModel.findOne({
        stripeSessionId: session.id,
      });
      if (!transaction) return { received: true };

      transaction.status = 'completed';
      await transaction.save();

      // ── Add credits to the buyer's account ──
      await this.userModel.findByIdAndUpdate(userId, {
        $inc: { creditBalance: Number(creditVolume) },
      });
    }

    return { received: true };
  }

  // ─── Admin: All purchases (name, date, amount, plan) ──
  async getAllPurchases(query: GetCreditPurchasesQueryDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const filter = { ...createFilter(query.search, query.date), status: 'completed' };

    const total = await this.transactionModel.countDocuments(filter);
    const purchases = await this.transactionModel
      .find(filter)
      .populate('user', 'name email')
      .populate('plan', 'title')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      message: 'Purchases fetched successfully',
      meta: createMeta(page, limit, total),
      data: { purchases, paginationInfo: createPaginationInfo(page, limit, total) },
    };
  }

}