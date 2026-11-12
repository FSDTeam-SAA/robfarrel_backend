import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { CreditTransaction, CreditTransactionSchema } from '../credit-purchase/schemas/credit-transaction.schema';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: CreditTransaction.name, schema: CreditTransactionSchema },
    ]),
    AuthModule,
    AiModule,
  ],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
})
export class AdminDashboardModule {}