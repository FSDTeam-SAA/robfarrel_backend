import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Every project-based AI module: send `propertyAnalysisId` (mapped to the AI project),
 * `project` (raw AI project fields), or both — `project` values override the mapped ones.
 */
export class AiProjectRequestDto {
  @IsOptional() @IsMongoId() propertyAnalysisId?: string;
  @IsOptional() @IsObject() project?: Record<string, any>;
  @IsOptional() @IsObject() config_overrides?: Record<string, any>;
}

export class AiConceptRequestDto extends AiProjectRequestDto {
  @IsOptional() @IsString() @MaxLength(64) concept_id?: string;
}

export class AiFitScoreDto extends AiConceptRequestDto {
  @IsOptional() @IsObject() market_snapshot?: Record<string, any>;
}

export class AiConceptsDto extends AiProjectRequestDto {
  @IsOptional() @IsObject() market_snapshot?: Record<string, any>;
}

export class AiImageDto {
  @IsUrl({ protocols: ['https'], require_protocol: true }) url: string;
  @IsOptional() @IsIn(['space_photo', 'floor_plan', 'other']) kind?: string;
  @IsOptional() @IsString() @MaxLength(128) image_id?: string;
}

export class AiSpacePlanDto extends AiConceptRequestDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AiImageDto)
  images?: AiImageDto[];
}

export class AiReportDto extends AiProjectRequestDto {
  @IsObject() report_inputs: Record<string, any>;
}

export class AiVisualizeDto extends AiConceptRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AiImageDto)
  images: AiImageDto[];
}

export class AiPropertyMatchDto {
  /** Tenant requirements; see the AI service's /v1/property-match contract */
  @IsOptional() @IsObject() requirements?: Record<string, any>;
  @IsOptional() @IsMongoId() reference_analysis_id?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) statuses?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
  @IsOptional() @IsBoolean() explain?: boolean;
  @IsOptional() @IsObject() config_overrides?: Record<string, any>;
}

export class AiRunsQueryDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number = 1;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;
  @IsOptional() @IsString() module?: string;
  @IsOptional() @IsString() status?: string;
}

export class CreditUsageQueryDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number = 1;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;
  @IsOptional() @IsMongoId() userId?: string;
  @IsOptional() @IsString() module?: string;
  @IsOptional() @IsString() date?: string;
}
