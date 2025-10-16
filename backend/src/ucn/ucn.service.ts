import { Injectable } from '@nestjs/common';
import fetch from 'node-fetch';

interface UcnLoginResponse {
  rut: string;
  carreras: any[];
  error?: string;  
  rol?: string;    
}

@Injectable()
export class UcnService {

  // 🔹 1. LOGIN
  async login(email: string, password: string) {
    const url = `https://puclaro.ucn.cl/eross/avance/login.php?email=${email}&password=${password}`;
    const response = await fetch(url);
    const data = await response.json() as UcnLoginResponse;

    if (!data.error) {
      data.rol = 'estudiante'; 
    }
    return data;
  }

  // 🔹 2. MALLA
  async getMalla(codigo: string, catalogo: string) {
    const url = `https://losvilos.ucn.cl/hawaii/api/mallas?${codigo}-${catalogo}`;
    const headers = { 'X-HAWAII-AUTH': 'jf400fejof13f' };
    const response = await fetch(url, { headers });
    return await response.json();
  }

  // 🔹 3. AVANCE
  async getAvance(rut: string, codCarrera: string) {
    const url = `https://puclaro.ucn.cl/eross/avance/avance.php?rut=${rut}&codcarrera=${codCarrera}`;
    const response = await fetch(url);
    return await response.json();
  }


}
