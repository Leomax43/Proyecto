import { Injectable } from '@nestjs/common';
// 1. Importa HttpService y firstValueFrom
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

// La interfaz sigue igual
export interface UcnLoginResponse {
  rut: string;
  carreras: any[];
  error?: string;  
  rol?: string;    
}

@Injectable()
export class UcnService {

  // 2. Inyecta el HttpService de NestJS
  constructor(private readonly httpService: HttpService) {}

  // 🔹 1. LOGIN
  async login(email: string, password: string) {
    const url = `https://puclaro.ucn.cl/eross/avance/login.php?email=${email}&password=${password}`;

    try {
      // 3. Usa la sintaxis de HttpService
      // Axios (lo que usa HttpService) pone la respuesta en response.data
      const response = await firstValueFrom(this.httpService.get(url));
      const data: UcnLoginResponse = response.data;

      if (!data.error) {
        data.rol = 'estudiante'; 
      }
      return data;
    } catch (error) {
      console.error('Error en servicio de Login UCN:', error.message);
      return { error: 'No se pudo conectar al servicio externo de Login' };
    }
  }

  // 🔹 2. MALLA (¡Aquí está el cambio clave!)
  async getMalla(codigo: string, catalogo: string) {
    const url = `https://losvilos.ucn.cl/hawaii/api/mallas?${codigo}-${catalogo}`;
    
    // 4. Así es como Axios envía headers, en un objeto 'config'
    const config = {
      headers: {
        'X-HAWAII-AUTH': 'jf400fejof13f'
      }
    };

    try {
      // 5. Pasamos la URL y la config con los headers
      const response = await firstValueFrom(this.httpService.get(url, config));
      return response.data; // Axios ya parsea el JSON
    } catch (error) {
      console.error('Error en servicio de Malla UCN:', error.response?.data || error.message);
      // Retornamos el error que nos dio la API (ej: Unauthorized)
      return error.response?.data || { error: 'No se pudo conectar al servicio externo de Malla' };
    }
  }

  // 🔹 3. AVANCE
  async getAvance(rut: string, codCarrera: string) {
    const url = `https://puclaro.ucn.cl/eross/avance/avance.php?rut=${rut}&codcarrera=${codCarrera}`;

    try {
      const response = await firstValueFrom(this.httpService.get(url));
      return response.data;
    } catch (error) {
      console.error('Error en servicio de Avance UCN:', error.message);
      return { error: 'No se pudo conectar al servicio externo de Avance' };
    }
  }
}