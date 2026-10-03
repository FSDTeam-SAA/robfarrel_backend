import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PropertyAnalysisService } from './property-analysis.service';
import {
  CreatePropertyAnalysisDto,
  UpdatePropertyAnalysisDto,
} from './dto/property-analysis.dto';
import { QueryPropertyAnalysisDto } from './dto/query-property-analysis.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('property-analyses')
export class PropertyAnalysisController {
  constructor(
    private readonly propertyAnalysisService: PropertyAnalysisService,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePropertyAnalysisDto) {
    return this.propertyAnalysisService.create(dto);
  }

  @Public()
  @Get()
  findAll(@Query() query: QueryPropertyAnalysisDto) {
    return this.propertyAnalysisService.findAll(query);
  }

  @Public()
  @Get('user/:userId')
  findByUserId(
    @Param('userId') userId: string,
    @Query() query: QueryPropertyAnalysisDto,
  ) {
    return this.propertyAnalysisService.findByUserId(userId, query);
  }

  @Public()
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.propertyAnalysisService.findById(id);
  }

  @Public()
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyAnalysisDto,
  ) {
    return this.propertyAnalysisService.update(id, dto);
  }

  @Public()
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.propertyAnalysisService.delete(id);
  }
}
