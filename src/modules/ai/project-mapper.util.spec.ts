import {
  mapPropertyAnalysisToProject,
  mergeProject,
} from './project-mapper.util';

const analysis = {
  _id: '6adae5831332136ef3506aac',
  property: {
    address: '1015 S Congress Ave',
    state_county: 'Texas / Travis County',
    square_footage_sf: 3430,
  },
  space_condition: {
    current_condition: 'warm_shell',
    ceiling_height_ft: 14,
    signage_availability: 'pole_sign',
  },
  systems: {
    electrical: { existing_service: '200_amp' },
    fire_protection: { sprinkler_status: 'fully_sprinklered' },
  },
  lease_terms: {
    asking_base_rent: 30,
    rent_calculation_unit: 'per_sf_year',
    landlord_work_contribution: 25000,
  },
};

describe('mapPropertyAnalysisToProject', () => {
  it('maps a backend property analysis to the AI project shape', () => {
    expect(mapPropertyAnalysisToProject(analysis)).toEqual({
      project_id: '6adae5831332136ef3506aac',
      address: '1015 S Congress Ave, Travis County, Texas',
      state_code: 'TX',
      sqft: 3430,
      ceiling_ft: 14,
      condition: 'vanilla_box',
      infrastructure: { electrical_amps: 200, has_sprinkler: true },
      signage: true,
      asking_rent_psf: 30,
      landlord_work: [
        { description: 'Landlord work contribution', amount_usd: 25000 },
      ],
    });
  });

  it('normalizes rent units and omits what it cannot map', () => {
    const monthly = mapPropertyAnalysisToProject({
      property: { square_footage_sf: 1000 },
      space_condition: {
        current_condition: 'something_new',
        signage_availability: 'none',
      },
      lease_terms: {
        asking_base_rent: 2.5,
        rent_calculation_unit: 'per_sf_month',
      },
    });
    expect(monthly).toEqual({
      sqft: 1000,
      signage: false,
      asking_rent_psf: 30,
    });

    const total = mapPropertyAnalysisToProject({
      property: { square_footage_sf: 2000 },
      lease_terms: {
        asking_base_rent: 5000,
        rent_calculation_unit: 'per_month',
      },
    });
    expect(total.asking_rent_psf).toBe(30);
    expect(mapPropertyAnalysisToProject({})).toEqual({});
  });
});

describe('mergeProject', () => {
  it('lets explicit frontend values override mapped ones', () => {
    const merged = mergeProject(mapPropertyAnalysisToProject(analysis), {
      parking_spaces: 24,
      ceiling_ft: 16,
      infrastructure: { has_hood: true },
    });
    expect(merged.ceiling_ft).toBe(16);
    expect(merged.parking_spaces).toBe(24);
    expect(merged.infrastructure).toEqual({
      electrical_amps: 200,
      has_sprinkler: true,
      has_hood: true,
    });
  });
});
