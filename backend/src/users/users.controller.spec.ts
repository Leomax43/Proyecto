import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
    }).compile();


    controller = module.get<UsersController>(UsersController);
  });
  //test 1
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
  //test 2
  it('should return the correct user list message', () => {
    const result = controller.findAll();
    expect(result).toBe('Aquí se listarían los usuarios');
  });



});
