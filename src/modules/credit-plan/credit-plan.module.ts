import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CreditPlanController } from './credit-plan.controller';
import { CreditPlanService } from './credit-plan.service';
import { CreditPlan, CreditPlanSchema } from './schemas/credit-plan.schema';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { CreditTransaction, CreditTransactionSchema } from '../credit-purchase/schemas/credit-transaction.schema';
@Module({
   imports: [
    MongooseModule.forFeature([
      { name: CreditPlan.name, schema: CreditPlanSchema },
      { name: CreditTransaction.name, schema: CreditTransactionSchema },
    ]),
    AuthModule,
    AiModule,
  ],
  controllers: [CreditPlanController],
    providers: [CreditPlanService],
  exports: [CreditPlanService],
})
export class CreditPlanModule {}