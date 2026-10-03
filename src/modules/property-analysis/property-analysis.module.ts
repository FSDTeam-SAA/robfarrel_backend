import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PropertyAnalysisController } from './property-analysis.controller';
import { PropertyAnalysisService } from './property-analysis.service';
import {
  PropertyAnalysis,
  PropertyAnalysisSchema,
} from './schemas/property-analysis.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PropertyAnalysis.name, schema: PropertyAnalysisSchema },
    ]),
  ],
  controllers: [PropertyAnalysisController],
  providers: [PropertyAnalysisService],
  exports: [PropertyAnalysisService],
})
export class PropertyAnalysisModule {}
