import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HelpSupportController } from './help-support.controller';
import { HelpSupportService } from './help-support.service';
import { HelpSupport, HelpSupportSchema } from './schemas/help-support.schema';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../../infrastructure/cloudinary/cloudinary.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: HelpSupport.name, schema: HelpSupportSchema }]),
    AuthModule,
    CloudinaryModule,
    NotificationModule,
  ],
  controllers: [HelpSupportController],
  providers: [HelpSupportService],
})
export class HelpSupportModule {}