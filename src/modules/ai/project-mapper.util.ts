/**
 * Convert a stored PropertyAnalysis into the AI service's `project` payload.
 * Fields the analysis does not capture are omitted; the frontend can supply them in `project`.
 */

const US_STATES: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  'district of columbia': 'DC',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
};

/** AI conditions are shell | vanilla_box | second_gen. A warm shell (systems in, unfinished) maps to vanilla_box. */
const CONDITIONS: Record<string, string> = {
  shell: 'shell',
  cold_shell: 'shell',
  dark_shell: 'shell',
  grey_shell: 'shell',
  gray_shell: 'shell',
  warm_shell: 'vanilla_box',
  vanilla_box: 'vanilla_box',
  vanilla_shell: 'vanilla_box',
  white_box: 'vanilla_box',
  second_gen: 'second_gen',
  second_generation: 'second_gen',
  turnkey: 'second_gen',
  move_in_ready: 'second_gen',
};

const NONE = new Set(['none', 'no', 'not_available', 'unavailable']);
const norm = (value?: string | null) =>
  (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

function annualRentPsf(lease: any, sqft?: number): number | undefined {
  const rent = num(lease?.asking_base_rent);
  if (rent === undefined) return undefined;
  const unit = norm(lease?.rent_calculation_unit);
  if (!unit || unit.split('_').includes('sf'))
    return unit.includes('month') ? rent * 12 : rent;
  if (sqft && unit.includes('month'))
    return Math.round(((rent * 12) / sqft) * 100) / 100;
  if (sqft && (unit.includes('year') || unit.includes('annual')))
    return Math.round((rent / sqft) * 100) / 100;
  return undefined;
}

export function mapPropertyAnalysisToProject(
  analysis: any,
): Record<string, any> {
  const property = analysis?.property ?? {};
  const space = analysis?.space_condition ?? {};
  const systems = analysis?.systems ?? {};
  const lease = analysis?.lease_terms ?? {};

  const parts = String(property.state_county ?? '')
    .split('/')
    .map((part: string) => part.trim())
    .filter(Boolean);
  const stateCode = parts
    .map((part: string) => US_STATES[part.toLowerCase()])
    .find(Boolean);
  const sqft =
    num(property.square_footage_sf) ?? num(lease.rentable_square_footage);
  const amps = parseInt(
    String(systems.electrical?.existing_service ?? '').match(/\d+/)?.[0] ?? '',
    10,
  );
  const sprinkler = norm(systems.fire_protection?.sprinkler_status);
  const signage = norm(space.signage_availability);
  const contribution = num(lease.landlord_work_contribution);

  const project: Record<string, any> = {
    project_id: analysis?._id ? String(analysis._id) : undefined,
    address:
      [property.address, ...[...parts].reverse()].filter(Boolean).join(', ') ||
      undefined,
    state_code: stateCode,
    sqft: sqft && sqft > 0 ? sqft : undefined,
    ceiling_ft: num(space.ceiling_height_ft) || undefined,
    condition: CONDITIONS[norm(space.current_condition)],
    infrastructure: {
      electrical_amps: Number.isFinite(amps) ? amps : undefined,
      has_sprinkler: sprinkler.includes('fully')
        ? true
        : NONE.has(sprinkler)
          ? false
          : undefined,
    },
    signage: signage ? !NONE.has(signage) : undefined,
    asking_rent_psf: annualRentPsf(lease, sqft),
    landlord_work: contribution
      ? [
          {
            description: 'Landlord work contribution',
            amount_usd: contribution,
          },
        ]
      : undefined,
  };
  return stripUndefined(project);
}

/** Overlay explicit frontend values; `infrastructure` merges one level deep. */
export function mergeProject(
  base: Record<string, any>,
  override?: Record<string, any>,
): Record<string, any> {
  if (!override) return base;
  return stripUndefined({
    ...base,
    ...override,
    infrastructure: {
      ...(base.infrastructure ?? {}),
      ...(override.infrastructure ?? {}),
    },
  });
}

function stripUndefined<T extends Record<string, any>>(value: T): T {
  const out: Record<string, any> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const nested = stripUndefined(item);
      if (Object.keys(nested).length) out[key] = nested;
    } else {
      out[key] = item;
    }
  }
  return out as T;
}
