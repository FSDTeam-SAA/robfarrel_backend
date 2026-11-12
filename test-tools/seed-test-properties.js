/**
 * Create varied property analyses owned by the test landlord, through the backend API.
 *
 *   node test-tools/seed-test-properties.js <landlord-password>
 *   (or set TEST_USER_PASSWORD; BACKEND_URL defaults to http://localhost:5000/api/v1)
 *
 * Idempotent: a property is skipped when the landlord already has one with the same
 * address and suite name. Run test-tools/seed-test-users.js first.
 */
'use strict';

const BACKEND = (process.env.BACKEND_URL || 'http://localhost:5000/api/v1').replace(/\/+$/, '');
const EMAIL = 'test.landlord@visionitforme.test';
const PASSWORD = process.argv[2] || process.env.TEST_USER_PASSWORD;

const system = (condition, work_needed = [], extra = {}) => ({ condition, work_needed, ...extra });

// Varied on purpose: location, size, rent unit, condition, categories, systems and status.
const PROPERTIES = [
  {
    status: 'completed',
    property: { address: '2401 E 6th St', suite_name: 'East Sixth Corner Restaurant', state_county: 'Texas / Travis County', property_type: 'second_generation_restaurant', square_footage_sf: 2200, previous_tenant: 'Taqueria', previous_use: 'Restaurant' },
    space_condition: { current_condition: 'second_generation', ceiling_height_ft: 13, parking_availability: 'limited', signage_availability: 'building_sign', zoning_permitted_use: 'commercial' },
    systems: {
      plumbing: system('good', [], { requires_additional_plumbing: 'no' }),
      hvac: system('good', [], { responsibility: 'landlord', existing_units: 2, additional_capacity_required: 'no' }),
      electrical: system('good', [], { responsibility: 'landlord', existing_service: '400_amp' }),
      fire_protection: system('good', [], { responsibility: 'landlord', sprinkler_status: 'fully_sprinklered' }),
      gas: system('available', [], { requires_natural_gas: 'yes' }),
    },
    lease_terms: { asking_base_rent: 38, rent_calculation_unit: 'per_sf_year', lease_type: 'nnn', tenant_improvement_level: 'as_is', landlord_work_contribution: 0, rentable_square_footage: 2200, desired_lease_term: '5-10_years', preferred_categories: ['restaurants', 'food_beverage'], excluded_categories: ['fitness'], landlord_notes: 'Hood, grease trap and walk-in cooler stay with the space.' },
    analysis_preferences: { opening_timeline: '0-3_months', preferred_tenant_quality: 'regional_operators', business_categories: 'Restaurants and bars', ai_instructions: 'Favor concepts that reuse the existing kitchen.' },
  },
  {
    status: 'completed',
    property: { address: '1100 S Lamar Blvd', suite_name: 'Lamar Union Suite 120', state_county: 'Texas / Travis County', property_type: 'vacant_space', square_footage_sf: 3200, previous_tenant: null, previous_use: 'Retail' },
    space_condition: { current_condition: 'warm_shell', ceiling_height_ft: 16, parking_availability: 'adequate', signage_availability: 'pole_sign', zoning_permitted_use: 'commercial' },
    systems: {
      plumbing: system('functional', ['add_restrooms'], { requires_additional_plumbing: 'yes' }),
      hvac: system('functional_additional_capacity', ['increase_hvac_capacity'], { responsibility: 'landlord', existing_units: 3, additional_capacity_required: 'yes' }),
      electrical: system('functional_additional_capacity', [], { responsibility: 'landlord', existing_service: '200_amp', preferred_upgrade: '400_amp' }),
      fire_protection: system('good', [], { responsibility: 'landlord', sprinkler_status: 'fully_sprinklered' }),
      gas: system('not_available', [], { requires_natural_gas: 'no' }),
    },
    lease_terms: { asking_base_rent: 31, rent_calculation_unit: 'per_sf_year', lease_type: 'nnn', tenant_improvement_level: 'allowance', landlord_work_contribution: 40000, rentable_square_footage: 3200, desired_lease_term: '5-10_years', preferred_categories: ['fitness', 'medical_wellness', 'retail'], excluded_categories: ['nightlife'], landlord_notes: 'High ceilings suit a studio; landlord funds restroom build-out.' },
    analysis_preferences: { opening_timeline: '3-6_months', preferred_tenant_quality: 'institutional_corporate_tenants', business_categories: 'Fitness and wellness', ai_instructions: 'Prioritize tenants with strong credit.' },
  },
  {
    status: 'completed',
    property: { address: '3800 N Lamar Blvd', suite_name: 'Rosedale Shops Unit B', state_county: 'Texas / Travis County', property_type: 'vacant_space', square_footage_sf: 1500, previous_tenant: 'Boutique', previous_use: 'Retail' },
    space_condition: { current_condition: 'vanilla_box', ceiling_height_ft: 12, parking_availability: 'adequate', signage_availability: 'storefront_sign', zoning_permitted_use: 'commercial' },
    systems: {
      plumbing: system('functional', ['add_sinks'], { requires_additional_plumbing: 'no' }),
      hvac: system('good', [], { responsibility: 'landlord', existing_units: 1, additional_capacity_required: 'no' }),
      electrical: system('good', [], { responsibility: 'landlord', existing_service: '200_amp' }),
      fire_protection: system('good', [], { responsibility: 'landlord', sprinkler_status: 'fully_sprinklered' }),
      gas: system('available', [], { requires_natural_gas: 'no' }),
    },
    lease_terms: { asking_base_rent: 2.75, rent_calculation_unit: 'per_sf_month', lease_type: 'modified_gross', tenant_improvement_level: 'turnkey', landlord_work_contribution: 15000, rentable_square_footage: 1500, desired_lease_term: '3-5_years', preferred_categories: ['food_beverage', 'retail', 'services'], excluded_categories: [], landlord_notes: 'Ideal for a café or specialty retailer.' },
    analysis_preferences: { opening_timeline: '0-3_months', preferred_tenant_quality: 'local_operators', business_categories: 'Coffee, retail, personal services', ai_instructions: 'Low build-out concepts preferred.' },
  },
  {
    status: 'completed',
    property: { address: '201 E Main St', suite_name: 'Downtown Round Rock Building', state_county: 'Texas / Williamson County', property_type: 'vacant_space', square_footage_sf: 4500, previous_tenant: null, previous_use: 'Office' },
    space_condition: { current_condition: 'cold_shell', ceiling_height_ft: 14, parking_availability: 'street_only', signage_availability: 'building_sign', zoning_permitted_use: 'mixed_use' },
    systems: {
      plumbing: system('repairs_needed', ['repair_fixtures', 'add_restrooms', 'add_sinks'], { requires_additional_plumbing: 'yes' }),
      hvac: system('replacement_needed', ['replace_hvac_units'], { responsibility: 'tenant', existing_units: 2, additional_capacity_required: 'yes' }),
      electrical: system('upgrade_needed', ['upgrade_panel', 'add_outlets_circuits'], { responsibility: 'tenant', existing_service: '100_amp', preferred_upgrade: '200_amp' }),
      fire_protection: system('partial', ['extend_sprinklers'], { responsibility: 'landlord', sprinkler_status: 'partially_sprinklered' }),
      gas: system('available_repairs_inspection', ['inspect_gas_line'], { requires_natural_gas: 'no' }),
    },
    lease_terms: { asking_base_rent: 24, rent_calculation_unit: 'per_sf_year', lease_type: 'nnn', tenant_improvement_level: 'allowance', landlord_work_contribution: 60000, rentable_square_footage: 4500, desired_lease_term: '10+_years', preferred_categories: ['fitness', 'education', 'medical_wellness'], excluded_categories: ['nightlife', 'cannabis'], landlord_notes: 'Large allowance for a long-term tenant.' },
    analysis_preferences: { opening_timeline: '6-12_months', preferred_tenant_quality: 'institutional_corporate_tenants', business_categories: 'Education, fitness, medical', ai_instructions: 'Account for full build-out costs.' },
  },
  {
    status: 'completed',
    property: { address: '1834 Westheimer Rd', suite_name: 'Montrose Corner', state_county: 'Texas / Harris County', property_type: 'second_generation_restaurant', square_footage_sf: 2800, previous_tenant: 'Bistro', previous_use: 'Restaurant' },
    space_condition: { current_condition: 'second_generation', ceiling_height_ft: 12, parking_availability: 'adequate', signage_availability: 'pole_sign', zoning_permitted_use: 'commercial' },
    systems: {
      plumbing: system('good', [], { requires_additional_plumbing: 'no' }),
      hvac: system('good', [], { responsibility: 'landlord', existing_units: 3, additional_capacity_required: 'no' }),
      electrical: system('good', [], { responsibility: 'landlord', existing_service: '600_amp' }),
      fire_protection: system('good', [], { responsibility: 'landlord', sprinkler_status: 'fully_sprinklered' }),
      gas: system('available', [], { requires_natural_gas: 'yes' }),
    },
    lease_terms: { asking_base_rent: 7000, rent_calculation_unit: 'per_month', lease_type: 'gross', tenant_improvement_level: 'as_is', landlord_work_contribution: 0, rentable_square_footage: 2800, desired_lease_term: '5-10_years', preferred_categories: ['restaurants'], excluded_categories: ['fitness', 'nightlife'], landlord_notes: 'Turnkey restaurant with patio.' },
    analysis_preferences: { opening_timeline: '0-3_months', preferred_tenant_quality: 'regional_operators', business_categories: 'Full-service dining', ai_instructions: 'Favor experienced restaurant groups.' },
  },
  {
    status: 'draft',
    property: { address: '5900 Burnet Rd', suite_name: 'Allandale Strip Suite 4', state_county: 'Texas / Travis County', property_type: 'vacant_space', square_footage_sf: 2600, previous_tenant: null, previous_use: 'Salon' },
    space_condition: { current_condition: 'warm_shell', ceiling_height_ft: null, parking_availability: 'adequate', signage_availability: null, zoning_permitted_use: 'commercial' },
    systems: { electrical: system('functional', [], { existing_service: '200_amp' }) },
    lease_terms: { asking_base_rent: 28, rent_calculation_unit: null, lease_type: null, preferred_categories: [], excluded_categories: [], landlord_notes: 'Draft: some details still missing.' },
    analysis_preferences: { opening_timeline: '3-6_months' },
  },
];

async function call(method, path, body) {
  const res = await fetch(BACKEND + path, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} -> HTTP ${res.status}: ${json?.message || 'request failed'}`);
  return json;
}

async function main() {
  if (!PASSWORD) throw new Error('Pass the test landlord password: node test-tools/seed-test-properties.js <password>');
  const login = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  const userId = login.data.user._id;
  const existing = await call('GET', `/property-analyses/user/${userId}?page=1&limit=100`);
  const key = (p) => `${p?.address}|${p?.suite_name}`.toLowerCase();
  const have = new Set((existing.data || []).map((a) => key(a.property)));

  for (const item of PROPERTIES) {
    if (have.has(key(item.property))) {
      console.log(`skip    ${item.property.address} (${item.property.suite_name})`);
      continue;
    }
    const created = await call('POST', '/property-analyses', { ...item, user: userId });
    console.log(`created ${created.data._id}  ${item.status.padEnd(9)} ${item.property.address}, ${item.property.state_county}`);
  }
  console.log(`\nowner: ${EMAIL} (${userId})`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
