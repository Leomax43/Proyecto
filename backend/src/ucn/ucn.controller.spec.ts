import { Test, TestingModule } from '@nestjs/testing';
import { UcnController } from './ucn.controller';

describe('UcnController', () => {
  let controller: UcnController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UcnController],
    }).compile();

    controller = module.get<UcnController>(UcnController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
