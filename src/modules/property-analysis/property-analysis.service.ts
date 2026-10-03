import {
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PropertyAnalysis,
  PropertyAnalysisDocument,
} from './schemas/property-analysis.schema';
import {
  CreatePropertyAnalysisDto,
  UpdatePropertyAnalysisDto,
} from './dto/property-analysis.dto';
import { QueryPropertyAnalysisDto } from './dto/query-property-analysis.dto';

@Injectable()
export class PropertyAnalysisService {
  constructor(
    @InjectModel(PropertyAnalysis.name)
    private readonly propertyAnalysisModel: Model<PropertyAnalysisDocument>,
  ) {}

  async create(dto: CreatePropertyAnalysisDto, authUserId?: string) {
    const payload: any = { ...dto };

    // Set user if provided in payload or from authenticated user
    const userIdToSet = dto.user || authUserId;
    if (userIdToSet && Types.ObjectId.isValid(userIdToSet)) {
      payload.user = new Types.ObjectId(userIdToSet);
    }

    const created = await this.propertyAnalysisModel.create(payload);
    return {
      message: 'Property analysis created successfully',
      data: created,
    };
  }

  async findAll(query: QueryPropertyAnalysisDto) {
    const { page = 1, limit = 10, userId, status, search } = query;
    const filter: Record<string, any> = {};

    if (userId && Types.ObjectId.isValid(userId)) {
      filter.user = new Types.ObjectId(userId);
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { 'property.address': { $regex: search, $options: 'i' } },
        { 'property.suite_name': { $regex: search, $options: 'i' } },
        { 'property.state_county': { $regex: search, $options: 'i' } },
        { 'property.property_type': { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      this.propertyAnalysisModel
        .find(filter)
        .populate('user', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      this.propertyAnalysisModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / Number(limit)) || 1;

    return {
      message: 'Property analyses fetched successfully',
      data,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages,
      },
    };
  }

  async findByUserId(userId: string, query: QueryPropertyAnalysisDto = {}) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (Types.ObjectId.isValid(userId)) {
      filter.user = new Types.ObjectId(userId);
    } else {
      filter.user = userId;
    }

    if (query.status) {
      filter.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.propertyAnalysisModel
        .find(filter)
        .populate('user', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.propertyAnalysisModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      message: 'User property analyses fetched successfully',
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException('Invalid property analysis ID', HttpStatus.BAD_REQUEST);
    }

    const analysis = await this.propertyAnalysisModel
      .findById(id)
      .populate('user', 'name email role');

    if (!analysis) {
      throw new HttpException('Property analysis not found', HttpStatus.NOT_FOUND);
    }

    return {
      message: 'Property analysis fetched successfully',
      data: analysis,
    };
  }

  async update(id: string, dto: UpdatePropertyAnalysisDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException('Invalid property analysis ID', HttpStatus.BAD_REQUEST);
    }

    const updatePayload: any = { ...dto };
    if (dto.user) {
      if (Types.ObjectId.isValid(dto.user)) {
        updatePayload.user = new Types.ObjectId(dto.user);
      }
    }

    const updated = await this.propertyAnalysisModel.findByIdAndUpdate(
      id,
      updatePayload,
      {
        new: true,
        runValidators: false,
      },
    );

    if (!updated) {
      throw new HttpException('Property analysis not found', HttpStatus.NOT_FOUND);
    }

    return {
      message: 'Property analysis updated successfully',
      data: updated,
    };
  }

  async delete(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException('Invalid property analysis ID', HttpStatus.BAD_REQUEST);
    }

    const deleted = await this.propertyAnalysisModel.findByIdAndDelete(id);
    if (!deleted) {
      throw new HttpException('Property analysis not found', HttpStatus.NOT_FOUND);
    }

    return {
      message: 'Property analysis deleted successfully',
      data: null,
    };
  }
}
