import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Req,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { CreditPurchaseService } from './credit-purchase.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RoleType } from '../../common/enums/role.enum';
import { GetCreditPurchasesQueryDto } from './dto/credit-purchase.dto';

@Controller('credit-plan')
export class CreditPurchaseController {
  constructor(private readonly creditPurchaseService: CreditPurchaseService) {}

  // ─── Landlord/Tenant: Buy a credit plan ───────────────
  @Post('buy/:planId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.LANDLORD, RoleType.TENANT)
  @HttpCode(HttpStatus.OK)
  buy(@CurrentUser('_id') userId: string, @Param('planId') planId: string) {
    return this.creditPurchaseService.createCheckout(userId, planId);
  }

  // ─── Stripe Webhook ────────────────────────────────────
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.creditPurchaseService.handleWebhook(req.rawBody, signature);
  }

  // ─── Admin: All purchases ──────────────────────────────
  @Get('purchases/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  getAllPurchases(@Query() query: GetCreditPurchasesQueryDto) {
    return this.creditPurchaseService.getAllPurchases(query);
  }

}