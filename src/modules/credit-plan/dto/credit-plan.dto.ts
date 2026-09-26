import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCreditPlanDto {
  @IsString() @IsNotEmpty() title: string;

  @IsNumber() @Min(0) actualPrice: number;

  @IsNumber() @Min(0) discountedPrice: number;

  @IsNumber() @Min(0) creditVolume: number;

  @IsOptional() @IsString() description?: string;

  @IsOptional() @IsString() promoLabel?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isFeatured?: boolean;
}

export class UpdateCreditPlanDto {
  @IsOptional() @IsString() title?: string;

  @IsOptional() @IsNumber() @Min(0) actualPrice?: number;

  @IsOptional() @IsNumber() @Min(0) discountedPrice?: number;

  @IsOptional() @IsNumber() @Min(0) creditVolume?: number;

  @IsOptional() @IsString() description?: string;

  @IsOptional() @IsString() promoLabel?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isFeatured?: boolean;
}