import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../auth/schemas/user.schema';
import {
  CreditTransaction,
  CreditTransactionDocument,
} from '../credit-purchase/schemas/credit-transaction.schema';
import { RoleType } from '../../common/enums/role.enum';

const MEMBER_ROLES = { $in: [RoleType.LANDLORD, RoleType.TENANT] };
const pct = (current: number, previous: number) =>
  previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 1000) / 10;

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(CreditTransaction.name)
    private readonly txModel: Model<CreditTransactionDocument>,
  ) {}

  // ─── API 1: cards ───────────────────────────────────────
  async getCards() {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [totalUsers, newThisMonth, newLastMonth] = await Promise.all([
      this.userModel.countDocuments({ role: MEMBER_ROLES }),
      this.userModel.countDocuments({ role: MEMBER_ROLES, createdAt: { $gte: thisMonth } }),
      this.userModel.countDocuments({ role: MEMBER_ROLES, createdAt: { $gte: lastMonth, $lt: thisMonth } }),
    ]);

    const [subscribers, newSubscribers] = await Promise.all([
      this.txModel.distinct('user', { status: 'completed' }),
      this.txModel.distinct('user', { status: 'completed', createdAt: { $gte: thisMonth } }),
    ]);

    const revenueOf = async (from: Date, to?: Date) => {
      const [r] = await this.txModel.aggregate([
        { $match: { status: 'completed', createdAt: to ? { $gte: from, $lt: to } : { $gte: from } } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } },
      ]);
      return r?.total || 0;
    };
    const [revThis, revLast] = await Promise.all([revenueOf(thisMonth), revenueOf(lastMonth, thisMonth)]);

    return {
      message: 'Dashboard cards fetched successfully',
      data: {
        totalUsers: { value: totalUsers, newThisMonth, momPercent: pct(newThisMonth, newLastMonth) },
        activeSubscribers: { value: subscribers.length, newThisMonth: newSubscribers.length },
        monthlyRevenue: { value: revThis, momPercent: pct(revThis, revLast) },
        creditsConsumed: { value: 0 }, // TODO: wire when credits can be spent
      },
    };
  }

  // ─── API 2: charts + recent users ───────────────────────
  async getCharts(range: '7d' | '30d' | '12m' = '12m') {
    const now = new Date();
    const monthly = range === '12m';
    const from = monthly
      ? new Date(now.getFullYear(), now.getMonth() - 11, 1)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - (range === '7d' ? 6 : 29));
    const format = monthly ? '%Y-%m' : '%Y-%m-%d';

    const [revenueRaw, usersRaw, recent, baseActive] = await Promise.all([
      this.txModel.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: from } } },
        { $group: { _id: { $dateToString: { format, date: '$createdAt' } }, revenue: { $sum: '$amountPaid' } } },
      ]),
      this.userModel.aggregate([
        { $match: { role: MEMBER_ROLES, isSuspended: { $ne: true }, createdAt: { $gte: from } } },
        { $group: { _id: { $dateToString: { format, date: '$createdAt' } }, count: { $sum: 1 } } },
      ]),
      this.userModel
        .find({ role: MEMBER_ROLES })
        .select('name email role creditBalance isSuspended createdAt')
        .sort({ createdAt: -1 })
        .limit(5),
      this.userModel.countDocuments({
        role: MEMBER_ROLES,
        isSuspended: { $ne: true },
        createdAt: { $lt: from },
      }),
    ]);

    // fill empty buckets so the chart has no gaps
    const buckets: string[] = [];
    const cursor = new Date(from);
    while (cursor <= now) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      buckets.push(monthly ? `${y}-${m}` : `${y}-${m}-${d}`);
      monthly ? cursor.setMonth(cursor.getMonth() + 1) : cursor.setDate(cursor.getDate() + 1);
    }
    const rev = new Map(revenueRaw.map((r) => [r._id, r.revenue]));
    const usr = new Map(usersRaw.map((r) => [r._id, r.count]));

    // plan column = last completed purchase per recent user
    const purchases = await this.txModel
      .find({ user: { $in: recent.map((u) => u._id) }, status: 'completed' })
      .populate('plan', 'title')
      .sort({ createdAt: -1 });
    const lastPlan = new Map<string, string>();
    purchases.forEach((p: any) => {
      const key = p.user.toString();
      if (!lastPlan.has(key)) lastPlan.set(key, p.plan?.title || null);
    });

    let running = baseActive;
    const activeUsersChart = buckets.map((b) => {
      running += usr.get(b) || 0;
      return { label: b, activeUsers: running };
    });

    return {
      message: 'Dashboard charts fetched successfully',
      data: {
        range,
        revenueChart: buckets.map((b) => ({
          label: b,
          revenue: rev.get(b) || 0,
          profit: rev.get(b) || 0,
        })),
        activeUsersChart,
        recentUsers: recent.map((u) => ({
          _id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          plan: lastPlan.get(u._id.toString()) || null,
          credits: u.creditBalance,
          status: u.isSuspended ? 'SUSPENDED' : 'ACTIVE',
        })),
      },
    };
  }
}