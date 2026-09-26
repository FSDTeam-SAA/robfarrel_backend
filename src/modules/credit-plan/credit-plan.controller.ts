import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CreditPlanService } from './credit-plan.service';
import { CreateCreditPlanDto, UpdateCreditPlanDto } from './dto/credit-plan.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RoleType } from '../../common/enums/role.enum';

@Controller('credit-plan')
export class CreditPlanController {
  constructor(private readonly creditPlanService: CreditPlanService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCreditPlanDto) {
    return this.creditPlanService.create(dto);
  }

  @Public()
  @Get()
  getAll() {
    return this.creditPlanService.getAll();
  }

  @Get('admin/overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  getAdminOverview() {
    return this.creditPlanService.getAdminOverview();
  }

  @Public()
  @Get(':id')
  getSingle(@Param('id') id: string) {
    return this.creditPlanService.getById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateCreditPlanDto) {
    return this.creditPlanService.update(id, dto);
  }

  

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @HttpCode(HttpStatus.OK)
  delete(@Param('id') id: string) {
    return this.creditPlanService.delete(id);
  }


}