import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import {
  PropertyAnalysis,
  PropertyAnalysisSchema,
} from '../property-analysis/schemas/property-analysis.schema';
import { CloudinaryModule } from '../../infrastructure/cloudinary/cloudinary.module';
import {
  AiCallbackController,
  AiController,
  CreditUsageController,
} from './ai.controller';
import { AiClientService } from './ai-client.service';
import { AiService } from './ai.service';
import { CreditBurnService } from './credit-burn.service';
import { AiRun, AiRunSchema } from './schemas/ai-run.schema';
import { CreditUsage, CreditUsageSchema } from './schemas/credit-usage.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiRun.name, schema: AiRunSchema },
      { name: CreditUsage.name, schema: CreditUsageSchema },
      { name: PropertyAnalysis.name, schema: PropertyAnalysisSchema },
    ]),
    AuthModule,
    CloudinaryModule,
  ],
  controllers: [AiController, AiCallbackController, CreditUsageController],
  providers: [AiClientService, AiService, CreditBurnService],
  exports: [CreditBurnService],
})
export class AiModule {}
