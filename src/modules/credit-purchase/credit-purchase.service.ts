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
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../common/enums/notification-type.enum';

@Injectable()
export class CreditPurchaseService {
  private stripe: Stripe;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(CreditTransaction.name)
    private readonly transactionModel: Model<CreditTransactionDocument>,
    private readonly configService: ConfigService,
    private readonly creditPlanService: CreditPlanService,
    private readonly notifications: NotificationService,
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
      if (transaction.status === 'completed') return { received: true };   // ← add here

      transaction.status = 'completed';
      transaction.stripePaymentIntentId = session.payment_intent;
      await transaction.save();

      // ── Add credits to the buyer's account ──
      await this.userModel.findByIdAndUpdate(userId, {
        $inc: { creditBalance: Number(creditVolume) },
      });

      await this.notifications.create({
        user: userId,
        refId: transaction._id,
        type: NotificationType.CREDITS_ADDED,
        title: 'Credits Added',
        message: `${creditVolume} credits have been added to your account balance.`,
      });

      const buyer = await this.userModel.findById(userId).select('name email');
      await this.notifications.notifyAdmins({
        refId: transaction._id,
        type: NotificationType.NEW_PURCHASE,
        title: 'New Credit Purchase',
        message: `${creditVolume} credits added to ${buyer?.name || buyer?.email || 'a user'}'s account ($${transaction.amountPaid} paid).`,
      });
    }

    return { received: true };
  }

  // ─── Admin: All purchases (name, date, amount, plan) ──
  async getAllPurchases(query: GetCreditPurchasesQueryDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const filter = { ...createFilter(undefined, query.date), status: 'completed' };

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

    async getMemberDetail(userId: string) {
    const user = await this.userModel.findById(userId).select('-password -refreshToken -__v');
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    const purchases = await this.transactionModel
      .find({ user: userId, status: 'completed' })
      .populate('plan', 'title discountedPrice creditVolume')
      .sort({ createdAt: -1 });

    return {
      message: 'Member details fetched successfully',
      data: { user, purchases },
    };
  }

}