import { IsIn, IsOptional } from 'class-validator';

export class DashboardChartQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', '12m'])
  range?: '7d' | '30d' | '12m';
}