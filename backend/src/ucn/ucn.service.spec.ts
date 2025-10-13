import { Test, TestingModule } from '@nestjs/testing';
import { UcnService } from './ucn.service';

describe('UcnService', () => {
  let service: UcnService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UcnService],
    }).compile();

    service = module.get<UcnService>(UcnService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
