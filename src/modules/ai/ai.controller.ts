import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { AiService } from './ai.service';
import { CreditBurnService } from './credit-burn.service';
import {
  AiConceptRequestDto,
  AiConceptsDto,
  AiFitScoreDto,
  AiPropertyMatchDto,
  AiReportDto,
  AiRunsQueryDto,
  AiSpacePlanDto,
  AiVisualizeDto,
  CreditUsageQueryDto,
} from './dto/ai.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RoleType } from '../../common/enums/role.enum';
import type { UserDocument } from '../auth/schemas/user.schema';

/** Frontend-facing AI routes. Each run checks credits first and burns them from total_tokens. */
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.LANDLORD, RoleType.TENANT)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('market/analyze')
  @HttpCode(HttpStatus.OK)
  market(@CurrentUser() user: UserDocument, @Body() dto: AiConceptRequestDto) {
    return this.aiService.run(user, 'market', dto);
  }

  @Post('fit-score')
  @HttpCode(HttpStatus.OK)
  fitScore(@CurrentUser() user: UserDocument, @Body() dto: AiFitScoreDto) {
    return this.aiService.run(user, 'fit_score', dto);
  }

  @Post('concepts/generate')
  @HttpCode(HttpStatus.OK)
  concepts(@CurrentUser() user: UserDocument, @Body() dto: AiConceptsDto) {
    return this.aiService.run(user, 'concepts', dto);
  }

  @Post('cost/estimate')
  @HttpCode(HttpStatus.OK)
  cost(@CurrentUser() user: UserDocument, @Body() dto: AiConceptRequestDto) {
    return this.aiService.run(user, 'cost', dto);
  }

  @Post('space-plan')
  @HttpCode(HttpStatus.OK)
  spacePlan(@CurrentUser() user: UserDocument, @Body() dto: AiSpacePlanDto) {
    return this.aiService.run(user, 'space_plan', dto);
  }

  @Post('report/narrative')
  @HttpCode(HttpStatus.OK)
  report(@CurrentUser() user: UserDocument, @Body() dto: AiReportDto) {
    return this.aiService.run(user, 'report', dto);
  }

  @Post('property-match')
  @HttpCode(HttpStatus.OK)
  propertyMatch(
    @CurrentUser() user: UserDocument,
    @Body() dto: AiPropertyMatchDto,
  ) {
    return this.aiService.run(user, 'property_match', dto);
  }

  @Post('visualize')
  @HttpCode(HttpStatus.ACCEPTED)
  visualize(@CurrentUser() user: UserDocument, @Body() dto: AiVisualizeDto) {
    return this.aiService.run(user, 'visualize', dto);
  }

  @Post('analysis/run')
  @HttpCode(HttpStatus.ACCEPTED)
  analysisRun(
    @CurrentUser() user: UserDocument,
    @Body() dto: AiConceptRequestDto,
  ) {
    return this.aiService.run(user, 'analysis_run', dto);
  }

  @Get('runs')
  listRuns(@CurrentUser() user: UserDocument, @Query() query: AiRunsQueryDto) {
    return this.aiService.listRuns(user, query);
  }

  @Get('runs/:id')
  @Roles(RoleType.LANDLORD, RoleType.TENANT, RoleType.ADMIN)
  getRun(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.aiService.getRun(user, id);
  }
}

/** The AI service posts async results here; authenticated by HMAC signature, not JWT. */
@Controller('ai')
export class AiCallbackController {
  constructor(private readonly aiService: AiService) {}

  @Public()
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  callback(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-signature-timestamp') timestamp: string,
    @Headers('x-signature') signature: string,
  ) {
    return this.aiService.handleCallback(req.rawBody, timestamp, signature);
  }
}

/** Credit burn: how many credits each AI run consumed, derived from its tokens. */
@Controller('credit-usage')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CreditUsageController {
  constructor(private readonly creditBurn: CreditBurnService) {}

  @Get('me')
  @Roles(RoleType.LANDLORD, RoleType.TENANT)
  getMine(
    @CurrentUser('_id') userId: string,
    @Query() query: CreditUsageQueryDto,
  ) {
    return this.creditBurn.getMyUsage(String(userId), query);
  }

  @Get()
  @Roles(RoleType.ADMIN)
  getAll(@Query() query: CreditUsageQueryDto) {
    return this.creditBurn.getAllUsage(query);
  }
}
