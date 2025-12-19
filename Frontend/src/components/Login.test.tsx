//pruebas de login
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from './Login';
import '@testing-library/jest-dom';

// Mocks se mantienen igual
const fetchMock = vi.fn();
globalThis.fetch = fetchMock as typeof globalThis.fetch;
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Componente de Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- PRUEBA 1 QUE FALLABA (AHORA CORREGIDA) ---
  it('debe llamar a la API y navegar a /home con credenciales correctas', async () => {
    const mockSuccessResponse = {
      rut: '19.876.543-2',
      carreras: [{ id: 1, nombre: 'INGENIERÍA CIVIL EN COMPUTACIÓN E INFORMÁTICA' }]
    };
    
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    } as Response);

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    // --- CAMBIO CLAVE AQUÍ ---
    // Usamos un formato de email válido para pasar la validación del frontend.
    fireEvent.change(screen.getByLabelText(/Correo electrónico/i), { target: { value: 'eross@ucn.cl' } });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), { target: { value: 'avance' } });
    fireEvent.click(screen.getByRole('button', { name: /Ingresar/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/home');
    });
  });

  // --- PRUEBA 2 QUE FALLABA (AHORA CORREGIDA) ---
  it('debe mostrar un error de API si las credenciales son incorrectas', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: 'Credenciales incorrectas' }),
    } as Response);

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    // --- CAMBIO CLAVE AQUÍ ---
    // También usamos un formato de email válido aquí.
    fireEvent.change(screen.getByLabelText(/Correo electrónico/i), { target: { value: 'usuario-falso@ucn.cl' } });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), { target: { value: 'password-incorrecto' } });
    fireEvent.click(screen.getByRole('button', { name: /Ingresar/i }));

    expect(await screen.findByText('Credenciales incorrectas. Inténtalo de nuevo.')).toBeInTheDocument();
  });

  // --- Las pruebas de validación no cambian y deberían seguir pasando ---
  it('debe renderizar el formulario correctamente', () => { /* ... sin cambios ... */ });
  it('debe mostrar errores de validación si los campos están vacíos', async () => { /* ... sin cambios ... */ });
  it('debe mostrar un error si el formato del correo es inválido', async () => { /* ... sin cambios ... */ });
});