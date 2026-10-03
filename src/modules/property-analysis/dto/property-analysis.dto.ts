import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PropertyInfoDto {
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() suite_name?: string;
  @IsOptional() @IsString() state_county?: string;
  @IsOptional() @IsString() property_type?: string;
  @IsOptional() @IsNumber() square_footage_sf?: number;
  @IsOptional() @IsString() previous_tenant?: string | null;
  @IsOptional() @IsString() previous_use?: string;
}

export class SpaceConditionDto {
  @IsOptional() @IsString() current_condition?: string;
  @IsOptional() @IsNumber() ceiling_height_ft?: number;
  @IsOptional() @IsString() parking_availability?: string;
  @IsOptional() @IsString() signage_availability?: string;
  @IsOptional() @IsString() zoning_permitted_use?: string;
}

export class PlumbingSystemDto {
  @IsOptional() @IsString() condition?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) work_needed?: string[];
  @IsOptional() @IsString() requires_additional_plumbing?: string;
}

export class HvacSystemDto {
  @IsOptional() @IsString() responsibility?: string;
  @IsOptional() @IsString() condition?: string;
  @IsOptional() @IsNumber() existing_units?: number;
  @IsOptional() @IsString() additional_capacity_required?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) work_needed?: string[];
}

export class ElectricalSystemDto {
  @IsOptional() @IsString() responsibility?: string;
  @IsOptional() @IsString() existing_service?: string;
  @IsOptional() @IsString() condition?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) work_needed?: string[];
  @IsOptional() @IsString() preferred_upgrade?: string;
}

export class FireProtectionSystemDto {
  @IsOptional() @IsString() responsibility?: string;
  @IsOptional() @IsString() condition?: string;
  @IsOptional() @IsString() sprinkler_status?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) work_needed?: string[];
}

export class GasSystemDto {
  @IsOptional() @IsString() condition?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) work_needed?: string[];
  @IsOptional() @IsString() requires_natural_gas?: string;
}

export class SystemsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PlumbingSystemDto)
  plumbing?: PlumbingSystemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => HvacSystemDto)
  hvac?: HvacSystemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ElectricalSystemDto)
  electrical?: ElectricalSystemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FireProtectionSystemDto)
  fire_protection?: FireProtectionSystemDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GasSystemDto)
  gas?: GasSystemDto;
}

export class LeaseTermsDto {
  @IsOptional() @IsNumber() asking_base_rent?: number;
  @IsOptional() @IsString() rent_calculation_unit?: string;
  @IsOptional() @IsString() lease_type?: string;
  @IsOptional() @IsString() tenant_improvement_level?: string;
  @IsOptional() @IsNumber() landlord_work_contribution?: number;
  @IsOptional() @IsNumber() rentable_square_footage?: number;
  @IsOptional() @IsString() desired_lease_term?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) preferred_categories?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) excluded_categories?: string[];
  @IsOptional() @IsString() landlord_notes?: string;
}

export class AnalysisPreferencesDto {
  @IsOptional() @IsString() opening_timeline?: string;
  @IsOptional() @IsString() preferred_tenant_quality?: string;
  @IsOptional() @IsString() business_categories?: string;
  @IsOptional() @IsString() ai_instructions?: string;
}

export class CreatePropertyAnalysisDto {
  @IsOptional()
  @IsString()
  user?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PropertyInfoDto)
  property?: PropertyInfoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SpaceConditionDto)
  space_condition?: SpaceConditionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SystemsDto)
  systems?: SystemsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LeaseTermsDto)
  lease_terms?: LeaseTermsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnalysisPreferencesDto)
  analysis_preferences?: AnalysisPreferencesDto;
}

export class UpdatePropertyAnalysisDto {
  @IsOptional()
  @IsString()
  user?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PropertyInfoDto)
  property?: PropertyInfoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SpaceConditionDto)
  space_condition?: SpaceConditionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SystemsDto)
  systems?: SystemsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LeaseTermsDto)
  lease_terms?: LeaseTermsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnalysisPreferencesDto)
  analysis_preferences?: AnalysisPreferencesDto;
}
