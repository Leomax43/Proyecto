import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UcnController } from './ucn.controller';
import { UcnService } from './ucn.service';
import { User } from '../users/entities/user.entity';
import { UserCareer } from '../users/entities/user-career.entity';
import { Course } from './entities/course.entity';
import { UserProgress } from './entities/user-progress.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserCareer, Course, UserProgress])],
  controllers: [UcnController],
  providers: [UcnService],
  exports: [UcnService], // Export service so other modules can use it
})
export class UcnModule {}
