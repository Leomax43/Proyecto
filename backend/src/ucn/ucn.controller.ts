import { Controller, Get, Query } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Controller('ucn')
export class UcnController {
  constructor(private readonly httpService: HttpService) {}

  @Get('login')
  async login(
    @Query('email') email: string,
    @Query('password') password: string,
  ) {
    const url = `https://puclaro.ucn.cl/eross/avance/login.php?email=${email}&password=${password}`;

    try {
      const response = await firstValueFrom(this.httpService.get(url));
      return response.data; // devuelve el JSON de la API externa
    } catch (error) {
      return { error: 'No se pudo conectar al servicio externo' };
    }
  }
}
