/**
 * AI microservice routes this backend exposes to the frontend.
 * `fields` are the module-specific body keys forwarded as-is; the AI service rejects unknown keys.
 */
export interface AiModuleDefinition {
  path: string;
  mode: 'sync' | 'async';
  /** Module takes run_type + project (all except property_match) */
  usesProject: boolean;
  fields: string[];
}

export const AI_MODULES = {
  market: {
    path: '/v1/market/analyze',
    mode: 'sync',
    usesProject: true,
    fields: ['concept_id'],
  },
  fit_score: {
    path: '/v1/fit-score',
    mode: 'sync',
    usesProject: true,
    fields: ['concept_id', 'market_snapshot'],
  },
  concepts: {
    path: '/v1/concepts/generate',
    mode: 'sync',
    usesProject: true,
    fields: ['market_snapshot'],
  },
  cost: {
    path: '/v1/cost/estimate',
    mode: 'sync',
    usesProject: true,
    fields: ['concept_id'],
  },
  space_plan: {
    path: '/v1/space-plan',
    mode: 'sync',
    usesProject: true,
    fields: ['concept_id', 'images'],
  },
  report: {
    path: '/v1/report/narrative',
    mode: 'sync',
    usesProject: true,
    fields: ['report_inputs'],
  },
  property_match: {
    path: '/v1/property-match',
    mode: 'sync',
    usesProject: false,
    fields: [
      'requirements',
      'reference_analysis_id',
      'statuses',
      'limit',
      'explain',
    ],
  },
  visualize: {
    path: '/v1/visualize',
    mode: 'async',
    usesProject: true,
    fields: ['concept_id', 'images'],
  },
  analysis_run: {
    path: '/v1/analysis/run',
    mode: 'async',
    usesProject: true,
    fields: ['concept_id'],
  },
} satisfies Record<string, AiModuleDefinition>;

export type AiModuleKey = keyof typeof AI_MODULES;
