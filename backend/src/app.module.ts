import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UcnController } from './ucn/ucn.controller';
import { UsersController } from './users/users.controller';
import { UcnService } from './ucn/ucn.service';
import { HttpModule } from '@nestjs/axios';

// 1. ¡ASEGÚRATE DE QUE ESTA LÍNEA EXISTA!
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    HttpModule,

    // 2. Cargar el ConfigModule
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // 3. Usar TypeOrmModule.forRootAsync
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],       // Se importa aquí también
      inject: [ConfigService],       // Se inyecta el servicio
      useFactory: (configService: ConfigService) => ({ // Esta es la línea que mencionaste
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
  ],
  controllers: [AppController, UsersController, UcnController],
  providers: [AppService, UcnService],
})
export class AppModule {}