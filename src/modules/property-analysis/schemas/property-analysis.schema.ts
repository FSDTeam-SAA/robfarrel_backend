import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class PropertyInfo {
  @Prop({ default: null }) address?: string;
  @Prop({ default: null }) suite_name?: string;
  @Prop({ default: null }) state_county?: string;
  @Prop({ default: null }) property_type?: string;
  @Prop({ default: null }) square_footage_sf?: number;
  @Prop({ default: null }) previous_tenant?: string;
  @Prop({ default: null }) previous_use?: string;
}

@Schema({ _id: false })
export class SpaceCondition {
  @Prop({ default: null }) current_condition?: string;
  @Prop({ default: null }) ceiling_height_ft?: number;
  @Prop({ default: null }) parking_availability?: string;
  @Prop({ default: null }) signage_availability?: string;
  @Prop({ default: null }) zoning_permitted_use?: string;
}

@Schema({ _id: false })
export class PlumbingSystem {
  @Prop({ default: null }) condition?: string;
  @Prop({ type: [String], default: [] }) work_needed?: string[];
  @Prop({ default: null }) requires_additional_plumbing?: string;
}

@Schema({ _id: false })
export class HvacSystem {
  @Prop({ default: null }) responsibility?: string;
  @Prop({ default: null }) condition?: string;
  @Prop({ default: null }) existing_units?: number;
  @Prop({ default: null }) additional_capacity_required?: string;
  @Prop({ type: [String], default: [] }) work_needed?: string[];
}

@Schema({ _id: false })
export class ElectricalSystem {
  @Prop({ default: null }) responsibility?: string;
  @Prop({ default: null }) existing_service?: string;
  @Prop({ default: null }) condition?: string;
  @Prop({ type: [String], default: [] }) work_needed?: string[];
  @Prop({ default: null }) preferred_upgrade?: string;
}

@Schema({ _id: false })
export class FireProtectionSystem {
  @Prop({ default: null }) responsibility?: string;
  @Prop({ default: null }) condition?: string;
  @Prop({ default: null }) sprinkler_status?: string;
  @Prop({ type: [String], default: [] }) work_needed?: string[];
}

@Schema({ _id: false })
export class GasSystem {
  @Prop({ default: null }) condition?: string;
  @Prop({ type: [String], default: [] }) work_needed?: string[];
  @Prop({ default: null }) requires_natural_gas?: string;
}

@Schema({ _id: false })
export class PropertySystems {
  @Prop({ type: PlumbingSystem, default: () => ({}) })
  plumbing?: PlumbingSystem;

  @Prop({ type: HvacSystem, default: () => ({}) })
  hvac?: HvacSystem;

  @Prop({ type: ElectricalSystem, default: () => ({}) })
  electrical?: ElectricalSystem;

  @Prop({ type: FireProtectionSystem, default: () => ({}) })
  fire_protection?: FireProtectionSystem;

  @Prop({ type: GasSystem, default: () => ({}) })
  gas?: GasSystem;
}

@Schema({ _id: false })
export class LeaseTerms {
  @Prop({ default: null }) asking_base_rent?: number;
  @Prop({ default: null }) rent_calculation_unit?: string;
  @Prop({ default: null }) lease_type?: string;
  @Prop({ default: null }) tenant_improvement_level?: string;
  @Prop({ default: null }) landlord_work_contribution?: number;
  @Prop({ default: null }) rentable_square_footage?: number;
  @Prop({ default: null }) desired_lease_term?: string;
  @Prop({ type: [String], default: [] }) preferred_categories?: string[];
  @Prop({ type: [String], default: [] }) excluded_categories?: string[];
  @Prop({ default: null }) landlord_notes?: string;
}

@Schema({ _id: false })
export class AnalysisPreferences {
  @Prop({ default: null }) opening_timeline?: string;
  @Prop({ default: null }) preferred_tenant_quality?: string;
  @Prop({ default: null }) business_categories?: string;
  @Prop({ default: null }) ai_instructions?: string;
}

@Schema({ timestamps: true })
export class PropertyAnalysis {
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  user?: Types.ObjectId;

  @Prop({ default: 'draft' })
  status: string;

  @Prop({ type: PropertyInfo, default: () => ({}) })
  property?: PropertyInfo;

  @Prop({ type: SpaceCondition, default: () => ({}) })
  space_condition?: SpaceCondition;

  @Prop({ type: PropertySystems, default: () => ({}) })
  systems?: PropertySystems;

  @Prop({ type: LeaseTerms, default: () => ({}) })
  lease_terms?: LeaseTerms;

  @Prop({ type: AnalysisPreferences, default: () => ({}) })
  analysis_preferences?: AnalysisPreferences;
}

export const PropertyAnalysisSchema = SchemaFactory.createForClass(PropertyAnalysis);
export type PropertyAnalysisDocument = HydratedDocument<PropertyAnalysis>;
