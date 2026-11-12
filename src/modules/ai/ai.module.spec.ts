import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import configs from '../../config';
import { AiModule } from './ai.module';
import { AiService } from './ai.service';
import { CreditBurnService } from './credit-burn.service';
import {
  AiCallbackController,
  AiController,
  CreditUsageController,
} from './ai.controller';

/** Dependency-injection smoke test: the module wires without a database. */
describe('AiModule', () => {
  it('resolves its services and controllers', async () => {
    const builder = Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: configs,
          ignoreEnvFile: true,
        }),
        AiModule,
      ],
    });
    builder.overrideProvider(getConnectionToken()).useValue({});
    for (const name of ['AiRun', 'CreditUsage', 'PropertyAnalysis', 'User']) {
      builder.overrideProvider(getModelToken(name)).useValue({});
    }
    const moduleRef = await builder.compile();
    expect(moduleRef.get(AiService)).toBeInstanceOf(AiService);
    expect(moduleRef.get(CreditBurnService)).toBeInstanceOf(CreditBurnService);
    expect(moduleRef.get(AiController)).toBeDefined();
    expect(moduleRef.get(AiCallbackController)).toBeDefined();
    expect(moduleRef.get(CreditUsageController)).toBeDefined();
  });
});
