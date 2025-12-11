import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UcnController } from './ucn.controller';
import { UcnService } from './ucn.service';

@Module({
  imports: [HttpModule],
  controllers: [UcnController],
  providers: [UcnService],
  exports: [UcnService], // Export service so other modules can use it
})
export class UcnModule {}
