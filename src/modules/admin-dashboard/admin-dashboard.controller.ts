import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service';
import { DashboardChartQueryDto } from './dto/admin-dashboard.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleType } from '../../common/enums/role.enum';

@Controller('admin-dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.ADMIN)
export class AdminDashboardController {
  constructor(private readonly service: AdminDashboardService) {}

  @Get('cards')
  getCards() {
    return this.service.getCards();
  }

  @Get('charts')
  getCharts(@Query() query: DashboardChartQueryDto) {
    return this.service.getCharts(query.range);
  }
}