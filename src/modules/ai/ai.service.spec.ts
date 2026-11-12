import { HttpException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AiService } from './ai.service';
import { CreditBurnService } from './credit-burn.service';
import { signCallback } from './credit-burn.util';
import { RoleType } from '../../common/enums/role.enum';

// ─── Minimal in-memory stand-ins for the Mongoose models ─────────────

const matches = (doc: any, filter: Record<string, any>) =>
  Object.entries(filter).every(([key, expected]) => {
    const actual = doc[key];
    if (expected && typeof expected === 'object' && '$in' in expected) {
      return expected.$in.includes(actual);
    }
    if (expected === null) return actual === null || actual === undefined;
    return String(actual) === String(expected);
  });

class FakeRunModel {
  docs = new Map<string, any>();

  async create(data: any) {
    const store = this.docs;
    const doc: any = {
      aiErrors: [],
      usage: [],
      totalTokens: 0,
      creditsCharged: null,
      jobId: null,
      ...data,
      createdAt: new Date(),
      markModified: () => undefined,
      async save() {
        store.set(String(this._id), this);
        return this;
      },
    };
    store.set(String(doc._id), doc);
    return doc;
  }

  async findById(id: any) {
    return this.docs.get(String(id)) ?? null;
  }

  async findOne(filter: any) {
    return [...this.docs.values()].find((doc) => matches(doc, filter)) ?? null;
  }

  async updateOne(filter: any, update: any) {
    const doc = await this.findOne(filter);
    if (doc) Object.assign(doc, update.$set);
    return { modifiedCount: doc ? 1 : 0 };
  }

  async findOneAndUpdate(filter: any, update: any) {
    const doc = await this.findOne(filter);
    if (doc) Object.assign(doc, update.$set);
    return doc;
  }
}

class FakeUserModel {
  constructor(public balances: Record<string, number>) {}

  findById(id: any) {
    const balance = this.balances[String(id)];
    const result =
      balance === undefined ? null : { _id: id, creditBalance: balance };
    return { select: async () => result };
  }

  /** Emulates the $max/$subtract pipeline; returns the pre-update document. */
  async findOneAndUpdate(filter: any, pipeline: any[]) {
    const id = String(filter._id);
    const before = this.balances[id] ?? 0;
    const credits = pipeline[0].$set.creditBalance.$max[1].$subtract[1];
    this.balances[id] = Math.max(0, before - credits);
    return { _id: id, creditBalance: before };
  }
}

class FakeUsageModel {
  rows: any[] = [];
  async create(row: any) {
    this.rows.push(row);
    return row;
  }
}

// ─── Fixtures ─────────────────────────────────────────────────────────

const CONFIG: Record<string, any> = {
  'ai.serviceUrl': 'https://ai.test',
  'ai.internalSecret': 'internal',
  'ai.callbackSigningSecret': 'cb-secret',
  'ai.publicUrl': 'https://backend.test',
  'ai.tokensPerCredit': 1000,
  'ai.minCreditsToRun': 1,
  'ai.callbackMaxAgeSeconds': 300,
};
const configService: any = { get: (key: string) => CONFIG[key] };

const analysisId = new Types.ObjectId();
const userId = new Types.ObjectId();
const user: any = { _id: userId, role: RoleType.TENANT };

function setup(balance = 10, aiResponse: any = {}) {
  const runs = new FakeRunModel();
  const users = new FakeUserModel({ [String(userId)]: balance });
  const usage = new FakeUsageModel();
  const creditBurn = new CreditBurnService(
    users as any,
    runs as any,
    usage as any,
    configService,
  );
  const aiClient = {
    isConfigured: true,
    post: jest.fn(
      async (_path: string, _body: any): Promise<any> => aiResponse,
    ),
  };
  const analyses = {
    findById: () => ({
      lean: async () => ({
        _id: analysisId,
        property: {
          address: '1015 S Congress Ave',
          state_county: 'Texas / Travis County',
        },
      }),
    }),
  };
  const cloudinary = {
    upload: jest.fn(async (_data: string, publicId: string) => ({
      url: `https://res.cloudinary.com/x/${publicId}.png`,
      publicId,
    })),
  };
  const service = new AiService(
    runs as any,
    analyses as any,
    aiClient as any,
    creditBurn,
    cloudinary as any,
    configService,
  );
  return { service, runs, users, usage, aiClient, cloudinary };
}

const envelope = (requestId: string, overrides: any = {}) => ({
  request_id: requestId,
  status: 'completed',
  results: { score: 81 },
  errors: [],
  usage: [{ provider: 'anthropic', input_tokens: 2000, output_tokens: 500 }],
  total_tokens: 2500,
  config_version: 'cfg',
  prompt_version: 'pv',
  ...overrides,
});

function signed(body: any) {
  const raw = Buffer.from(JSON.stringify(body));
  const ts = String(Math.floor(Date.now() / 1000));
  return { raw, ts, sig: signCallback('cb-secret', ts, raw) };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('AiService sync runs', () => {
  it('forwards the mapped project, stores the result and burns credits from total_tokens', async () => {
    const ctx = setup(10);
    ctx.aiClient.post.mockImplementation(async (_path: string, body: any) =>
      envelope(body.request_id),
    );

    const response = await ctx.service.run(user, 'fit_score', {
      propertyAnalysisId: String(analysisId),
      project: { sqft: 3000 },
      concept_id: 'coffee_shop',
      ignored_field: 'x',
    });

    const [path, sent] = ctx.aiClient.post.mock.calls[0] as any[];
    expect(path).toBe('/v1/fit-score');
    expect(sent).toEqual({
      request_id: expect.any(String),
      run_type: 'tenant',
      project: {
        project_id: String(analysisId),
        address: '1015 S Congress Ave, Travis County, Texas',
        state_code: 'TX',
        sqft: 3000,
      },
      concept_id: 'coffee_shop',
    });
    expect(response.data).toMatchObject({
      status: 'completed',
      totalTokens: 2500,
      creditsCharged: 3,
      results: { score: 81 },
    });
    expect(ctx.users.balances[String(userId)]).toBe(7);
    expect(ctx.usage.rows).toEqual([
      expect.objectContaining({
        totalTokens: 2500,
        tokensPerCredit: 1000,
        creditsBurned: 3,
        creditsDeducted: 3,
        balanceBefore: 10,
        balanceAfter: 7,
      }),
    ]);
  });

  it('rejects with 402 before calling the AI service when the balance is too low', async () => {
    const ctx = setup(0);
    await expect(
      ctx.service.run(user, 'market', {
        propertyAnalysisId: String(analysisId),
      }),
    ).rejects.toMatchObject({ status: 402 });
    expect(ctx.aiClient.post).not.toHaveBeenCalled();
    expect(ctx.runs.docs.size).toBe(0);
  });

  it('does not charge a failed run', async () => {
    const ctx = setup(10);
    ctx.aiClient.post.mockImplementation(async (_p: string, body: any) =>
      envelope(body.request_id, {
        status: 'failed',
        results: null,
        total_tokens: 900,
      }),
    );
    const response = await ctx.service.run(user, 'cost', {
      project: { sqft: 1200 },
    });
    expect(response.data).toMatchObject({
      status: 'failed',
      creditsCharged: 0,
    });
    expect(ctx.users.balances[String(userId)]).toBe(10);
    expect(ctx.usage.rows).toHaveLength(0);
  });

  it('records an AI transport failure on the run and rethrows', async () => {
    const ctx = setup(10);
    ctx.aiClient.post.mockRejectedValue(
      new HttpException('AI service is unreachable', 502),
    );
    await expect(
      ctx.service.run(user, 'cost', { project: { sqft: 1 } }),
    ).rejects.toThrow('unreachable');
    const [run] = [...ctx.runs.docs.values()];
    expect(run.status).toBe('failed');
    expect(ctx.users.balances[String(userId)]).toBe(10);
  });

  it('requires a project source for project-based modules', async () => {
    const ctx = setup(10);
    await expect(ctx.service.run(user, 'market', {})).rejects.toMatchObject({
      status: 400,
    });
  });

  it('sends property_match without run_type or project', async () => {
    const ctx = setup(10);
    ctx.aiClient.post.mockImplementation(async (_p: string, body: any) =>
      envelope(body.request_id),
    );
    await ctx.service.run(user, 'property_match', {
      requirements: { min_sqft: 1000 },
      limit: 5,
    });
    const [, sent] = ctx.aiClient.post.mock.calls[0] as any[];
    expect(sent).toEqual({
      request_id: expect.any(String),
      requirements: { min_sqft: 1000 },
      limit: 5,
    });
  });
});

describe('AiService async runs and callbacks', () => {
  async function startVisualization(ctx: ReturnType<typeof setup>) {
    ctx.aiClient.post.mockImplementation(async (_p: string, body: any) => ({
      request_id: body.request_id,
      job_id: 'job-1',
      status: 'accepted',
      total_tokens: 0,
    }));
    const accepted = await ctx.service.run(user, 'visualize', {
      project: { sqft: 2000 },
      images: [
        { url: 'https://res.cloudinary.com/x/space.jpg', kind: 'space_photo' },
      ],
    });
    const [, sent] = ctx.aiClient.post.mock.calls[0] as any[];
    return { accepted, requestId: sent.request_id, sent };
  }

  it('accepts the job without charging, then charges once when the signed callback lands', async () => {
    const ctx = setup(10);
    const { accepted, requestId, sent } = await startVisualization(ctx);
    expect(sent.callback_url).toBe('https://backend.test/api/v1/ai/callback');
    expect(accepted.data).toMatchObject({
      status: 'running',
      jobId: 'job-1',
      creditsCharged: null,
    });
    expect(ctx.users.balances[String(userId)]).toBe(10);

    const body = envelope(requestId, {
      job_id: 'job-1',
      results: {
        images_base64: ['AAAA', 'BBBB'],
        architecture_description: 'x',
      },
      total_tokens: 4200,
    });
    const { raw, ts, sig } = signed(body);
    await ctx.service.handleCallback(raw, ts, sig);
    await ctx.service.handleCallback(raw, ts, sig); // retried delivery

    const run = await ctx.runs.findById(requestId);
    expect(run.status).toBe('completed');
    expect(run.creditsCharged).toBe(5);
    expect(run.results.image_urls).toHaveLength(2);
    expect(run.results.images_base64).toEqual([]);
    expect(ctx.cloudinary.upload).toHaveBeenCalledTimes(2);
    expect(ctx.users.balances[String(userId)]).toBe(5);
    expect(ctx.usage.rows).toHaveLength(1);
  });

  it('rejects an unsigned or tampered callback', async () => {
    const ctx = setup(10);
    const { requestId } = await startVisualization(ctx);
    const { raw, ts } = signed(envelope(requestId));
    await expect(
      ctx.service.handleCallback(raw, ts, 'sha256=bad'),
    ).rejects.toMatchObject({
      status: 401,
    });
    expect(ctx.users.balances[String(userId)]).toBe(10);
  });

  it('caps the burn at the remaining balance', async () => {
    const ctx = setup(2);
    const { requestId } = await startVisualization(ctx);
    const { raw, ts, sig } = signed(
      envelope(requestId, { results: {}, total_tokens: 9000 }),
    );
    await ctx.service.handleCallback(raw, ts, sig);
    expect(ctx.users.balances[String(userId)]).toBe(0);
    expect(ctx.usage.rows[0]).toMatchObject({
      creditsBurned: 9,
      creditsDeducted: 2,
    });
  });
});
