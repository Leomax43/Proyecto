import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UcnController } from './ucn/ucn.controller';
import { UsersController } from './users/users.controller';
import { UcnService } from './ucn/ucn.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [AppController, UsersController, UcnController],
  providers: [AppService, UcnService],
})
export class AppModule {}
