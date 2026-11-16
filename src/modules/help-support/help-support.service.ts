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

// last reply on the ticket was written by an admin = customer has to answer
const lastReplyIsAdmin = {
  $eq: [{ $arrayElemAt: ['$replies.senderRole', -1] }, RoleType.ADMIN],
};

const isWaitingOnUser = (status: SupportStatus, replies: any[] = []) =>
  [SupportStatus.OPEN, SupportStatus.IN_REVIEW].includes(status) &&
  replies.length > 0 &&
  replies[replies.length - 1].senderRole === RoleType.ADMIN;

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
  async getAllTickets(query: GetTicketsQueryDto): Promise<any> {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const filter: Record<string, any> = createFilter(query.search, query.date, {
      searchField: 'subject',
    });
    if (query.priority) filter.priority = query.priority;

    if (query.status === 'WAITING_ON_USER') {
      filter.status = { $in: [SupportStatus.OPEN, SupportStatus.IN_REVIEW] };
      filter.$expr = lastReplyIsAdmin;
    } else if (query.status) {
      filter.status = query.status;
      // OPEN / IN_REVIEW exclude the tickets shown as "Waiting for User"
      if ([SupportStatus.OPEN, SupportStatus.IN_REVIEW].includes(query.status as SupportStatus)) {
        filter.$expr = { $not: [lastReplyIsAdmin] };
      }
    }

    const total = await this.helpSupportModel.countDocuments(filter);
    const rows = await this.helpSupportModel
      .find(filter)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const tickets = rows.map(({ replies, ...ticket }) => {
      const waitingOnUser = isWaitingOnUser(ticket.status, replies);
      return {
        ...ticket,
        repliesCount: replies?.length || 0,
        waitingOnUser,
        displayStatus: waitingOnUser ? 'WAITING_ON_USER' : ticket.status,
      };
    });

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

        if (role !== RoleType.ADMIN && ticket.user._id.toString() !== userId.toString()) {
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

        if (role !== RoleType.ADMIN && ticket.user.toString() !== userId.toString()) {
      throw new ForbiddenException('You cannot reply to this ticket');
    }

    if (ticket.status === SupportStatus.CLOSED) {
      throw new HttpException('This ticket is closed', HttpStatus.FORBIDDEN);
    }

    ticket.replies.push({ sender: userId as any, senderRole: role, message: dto.message } as any);
    await ticket.save();

    return { message: 'Reply added successfully', data: ticket };
  }

  // ─── Admin: Summary cards ───────────────────────────────
  async getAdminCards() {
    const openOrReview = { status: { $in: [SupportStatus.OPEN, SupportStatus.IN_REVIEW] } };
    const [totalRequests, openReviewCount, waitingOnUser, resolvedClosed] = await Promise.all([
      this.helpSupportModel.countDocuments(),
      this.helpSupportModel.countDocuments(openOrReview),
      this.helpSupportModel.countDocuments({ ...openOrReview, $expr: lastReplyIsAdmin }),
      this.helpSupportModel.countDocuments({
        status: { $in: [SupportStatus.RESOLVED, SupportStatus.CLOSED] },
      }),
    ]);

    return {
      message: 'Support cards fetched successfully',
      data: {
        totalRequests,
        activeQueue: openReviewCount - waitingOnUser,
        waitingOnUser,
        resolvedClosed,
      },
    };
  }
}