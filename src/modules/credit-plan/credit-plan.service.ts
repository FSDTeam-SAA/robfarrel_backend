import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreditPlan, CreditPlanDocument } from './schemas/credit-plan.schema';
import { CreateCreditPlanDto, UpdateCreditPlanDto } from './dto/credit-plan.dto';
import { CreditTransaction, CreditTransactionDocument } from '../credit-purchase/schemas/credit-transaction.schema';
import { RoleType } from '../../common/enums/role.enum';
import { User, UserDocument } from '../auth/schemas/user.schema';
@Injectable()
export class CreditPlanService {
  constructor(
    @InjectModel(CreditPlan.name)
    private readonly creditPlanModel: Model<CreditPlanDocument>,
    @InjectModel(CreditTransaction.name)
    private readonly transactionModel: Model<CreditTransactionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async create(dto: CreateCreditPlanDto) {
    const plan = await this.creditPlanModel.create(dto);
    return { message: 'Credit plan created successfully', data: plan };
  }

  async getAll() {
    const plans = await this.creditPlanModel.find().sort({ createdAt: -1 });
    return { message: 'Credit plans fetched successfully', data: plans };
  }

  async getById(id: string) {
    const plan = await this.creditPlanModel.findById(id);
    if (!plan) throw new HttpException('Credit plan not found', HttpStatus.NOT_FOUND);
    return { message: 'Credit plan fetched successfully', data: plan };
  }

  

  async update(id: string, dto: UpdateCreditPlanDto) {
    const updated = await this.creditPlanModel.findByIdAndUpdate(id, dto, {
      new: true,
      runValidators: true,
    });
    if (!updated) throw new HttpException('Credit plan not found', HttpStatus.NOT_FOUND);
    return { message: 'Credit plan updated successfully', data: updated };
  }

  async delete(id: string) {
    const deleted = await this.creditPlanModel.findByIdAndDelete(id);
    if (!deleted) throw new HttpException('Credit plan not found', HttpStatus.NOT_FOUND);
    return { message: 'Credit plan deleted successfully', data: null };
  }

    private async getStats() {
    const [earnings] = await this.transactionModel.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$amountPaid' },
          totalCreditsSold: { $sum: '$creditsAdded' },
        },
      },
    ]);

    const [circulation] = await this.userModel.aggregate([
      { $match: { role: { $in: [RoleType.LANDLORD, RoleType.TENANT] } } },
      { $group: { _id: null, activeCredits: { $sum: '$creditBalance' } } },
    ]);

    return {
      totalCreditPackEarnings: earnings?.totalEarnings || 0,
      totalCreditsSold: earnings?.totalCreditsSold || 0,
      totalCreditsUsed: 0,
      activeCreditsInCirculation: circulation?.activeCredits || 0,
    };
  }

  async getAdminOverview() {
    const [plans, cards] = await Promise.all([
      this.creditPlanModel.find().sort({ createdAt: -1 }),
      this.getStats(),
    ]);

    return { message: 'Credit overview fetched successfully', data: { cards, plans } };
  }
}