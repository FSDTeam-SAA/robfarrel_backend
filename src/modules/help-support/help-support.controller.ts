import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { HelpSupportService } from './help-support.service';
import {
  CreateTicketDto,
  AddReplyDto,
  UpdateTicketStatusDto,
  GetTicketsQueryDto,
} from './dto/help-support.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RoleType } from '../../common/enums/role.enum';

const multerStorage = diskStorage({
  destination: (_req, _file, cb) => {
    const folder = 'uploads/files';
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});

@Controller('help-support')
@UseGuards(JwtAuthGuard)
export class HelpSupportController {
  constructor(private readonly helpSupportService: HelpSupportService) {}

  // ─── Landlord/Tenant: Create ticket ────────────────────
  @Post()
  @UseGuards(RolesGuard)
  @Roles(RoleType.LANDLORD, RoleType.TENANT)
  @UseInterceptors(FileInterceptor('attachment', { storage: multerStorage }))
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser('_id') userId: string,
    @Body() dto: CreateTicketDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.helpSupportService.create(userId, dto, file);
  }

  // ─── Landlord/Tenant: My tickets ────────────────────────
  @Get('my-tickets')
  @UseGuards(RolesGuard)
  @Roles(RoleType.LANDLORD, RoleType.TENANT)
  getMyTickets(@CurrentUser('_id') userId: string) {
    return this.helpSupportService.getMyTickets(userId);
  }

  // ─── Admin: All tickets ─────────────────────────────────
  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN)
  getAllTickets(@Query() query: GetTicketsQueryDto) {
    return this.helpSupportService.getAllTickets(query);
  }

  // ─── Admin only: Change status ──────────────────────────
  @Put(':id/status')
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateTicketStatusDto) {
    return this.helpSupportService.updateStatus(id, dto);
  }

  // ─── Shared: Add reply ───────────────────────────────────
  @Post(':id/reply')
  addReply(
    @Param('id') id: string,
    @CurrentUser('_id') userId: string,
    @CurrentUser('role') role: RoleType,
    @Body() dto: AddReplyDto,
  ) {
    return this.helpSupportService.addReply(id, userId, role, dto);
  }

  // ─── Shared: Single ticket detail (owner or admin) ─────
  // MUST be last — otherwise it would swallow /my-tickets and /admin/all
  @Get(':id')
  getById(@CurrentUser('_id') userId: string, @CurrentUser('role') role: RoleType, @Param('id') id: string) {
    return this.helpSupportService.getById(id, userId, role);
  }
}