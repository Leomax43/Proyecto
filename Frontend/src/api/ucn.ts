// src/api/ucn.ts
import { API_BASE_URL } from "./config";

export async function login(email: string, password: string) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/ucn/login?email=${email}&password=${password}`
    );

    if (!response.ok) {
      throw new Error("Error en la solicitud");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error en login:", error);
    return { error: "Error al conectar con el backend" };
  }
}
