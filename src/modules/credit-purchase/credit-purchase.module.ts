import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CreditPurchaseController } from './credit-purchase.controller';
import { CreditPurchaseService } from './credit-purchase.service';
import { CreditTransaction, CreditTransactionSchema } from './schemas/credit-transaction.schema';
import { AuthModule } from '../auth/auth.module';
import { CreditPlanModule } from '../credit-plan/credit-plan.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CreditTransaction.name, schema: CreditTransactionSchema },
    ]),
    AuthModule,
    CreditPlanModule,
  ],
  controllers: [CreditPurchaseController],
  providers: [CreditPurchaseService],
})
export class CreditPurchaseModule {}