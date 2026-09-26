import { IsOptional, IsString } from 'class-validator';

export class GetCreditPurchasesQueryDto {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() date?: string;
}