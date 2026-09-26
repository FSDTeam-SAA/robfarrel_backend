import { Injectable, HttpException, HttpStatus, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HelpSupport, HelpSupportDocument } from './schemas/help-support.schema';
import { CreateTicketDto, AddReplyDto, UpdateTicketStatusDto, GetTicketsQueryDto } from './dto/help-support.dto';
import { CloudinaryService } from '../../infrastructure/cloudinary/cloudinary.service';
import { generateTicketNumber } from '../../common/utils/ticket.util';
import { createFilter, createMeta, createPaginationInfo } from '../../common/utils/pagination.util';
import { SupportStatus } from '../../common/enums/support-status.enum';
import { RoleType } from '../../common/enums/role.enum';

@Injectable()
export class HelpSupportService {
  constructor(
    @InjectModel(HelpSupport.name)
    private readonly helpSupportModel: Model<HelpSupportDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ─── Landlord/Tenant: Create ticket ────────────────────
  async create(userId: string, dto: CreateTicketDto, file?: Express.Multer.File) {
    let attachmentUrl = '';
    if (file) {
      const result = await this.cloudinaryService.upload(
        file.path,
        `${userId}-${Date.now()}`,
        'help-support',
      );
      attachmentUrl = result.url;
    }

    let ticketNumber = generateTicketNumber();
    // retry on the rare chance of a collision (unique index on ticketNumber)
    while (await this.helpSupportModel.exists({ ticketNumber })) {
      ticketNumber = generateTicketNumber();
    }

    const ticket = await this.helpSupportModel.create({
      ...dto,
      user: userId,
      ticketNumber,
      attachmentUrl,
    });

    return { message: 'Support ticket created successfully', data: ticket };
  }

  // ─── Landlord/Tenant: My tickets ────────────────────────
  async getMyTickets(userId: string) {
    const tickets = await this.helpSupportModel
      .find({ user: userId })
      .sort({ createdAt: -1 });
    return { message: 'Your tickets fetched successfully', data: tickets };
  }

  // ─── Admin: All tickets ─────────────────────────────────
  async getAllTickets(query: GetTicketsQueryDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const filter = createFilter(query.search, query.date, { searchField: 'subject' });
    if (query.status) filter.status = query.status;

    const total = await this.helpSupportModel.countDocuments(filter);
    const tickets = await this.helpSupportModel
      .find(filter)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      message: 'Tickets fetched successfully',
      meta: createMeta(page, limit, total),
      data: { tickets, paginationInfo: createPaginationInfo(page, limit, total) },
    };
  }

  // ─── Shared: Get single ticket (owner or admin) ────────
  async getById(ticketId: string, userId: string, role: RoleType) {
    const ticket = await this.helpSupportModel
      .findById(ticketId)
      .populate('user', 'name email role')
      .populate('replies.sender', 'name email role');

    if (!ticket) throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);

    if (role !== RoleType.ADMIN && ticket.user._id.toString() !== userId) {
      throw new ForbiddenException('You cannot access this ticket');
    }

    return { message: 'Ticket fetched successfully', data: ticket };
  }

  // ─── Admin only: Change status ──────────────────────────
  async updateStatus(ticketId: string, dto: UpdateTicketStatusDto) {
    const ticket = await this.helpSupportModel.findById(ticketId);
    if (!ticket) throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);

    ticket.status = dto.status;
    await ticket.save();

    return { message: 'Ticket status updated successfully', data: ticket };
  }

  // ─── Shared: Add reply (owner or admin, blocked if closed) ──
  async addReply(ticketId: string, userId: string, role: RoleType, dto: AddReplyDto) {
    const ticket = await this.helpSupportModel.findById(ticketId);
    if (!ticket) throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);

    if (role !== RoleType.ADMIN && ticket.user.toString() !== userId) {
      throw new ForbiddenException('You cannot reply to this ticket');
    }

    if (ticket.status === SupportStatus.CLOSED) {
      throw new HttpException('This ticket is closed', HttpStatus.FORBIDDEN);
    }

    ticket.replies.push({ sender: userId as any, senderRole: role, message: dto.message } as any);
    await ticket.save();

    return { message: 'Reply added successfully', data: ticket };
  }
}