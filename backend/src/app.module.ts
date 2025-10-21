import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UcnController } from './ucn/ucn.controller';
import { UsersController } from './users/users.controller';
import { UcnService } from './ucn/ucn.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'ucn_user',
      password: 'ucn_pass',
      database: 'proyecciones_db',
      autoLoadEntities: true,
      synchronize: true, // ⚠️ solo en desarrollo
    }),
  ],
  controllers: [AppController, UsersController, UcnController],
  providers: [AppService, UcnService],
})
export class AppModule {}
