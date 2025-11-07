import React, { useState, useEffect } from 'react'; // 👈 Se importa useEffect
import { useNavigate } from 'react-router-dom';
import logoUcn from '../recursos/logo-ucn.png';
import './Login.css';

const API_BASE_URL = "http://localhost:3000";

const Login: React.FC = () => {
  // Cambiamos 'rut' a 'email' para que sea más claro
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; api?: string }>({}); // 👈 Objeto para errores específicos
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // --- NUEVA FUNCIÓN DE VALIDACIÓN ---
  // Esta función se encarga de todas las restricciones del frontend
  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    // 1. Restricción: Email no puede estar vacío
    if (!email) {
      newErrors.email = 'El correo electrónico es obligatorio.';
    } 
    // 2. Restricción: Email debe tener un formato válido
    else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Por favor, ingresa un formato de correo válido.';
    }

    // 3. Restricción: Contraseña no puede estar vacía
    if (!password) {
      newErrors.password = 'La contraseña es obligatoria.';
    }

    setErrors(newErrors);
    // Retorna true si no hay errores, de lo contrario false
    return Object.keys(newErrors).length === 0;
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Llama a la nueva función de validación
    if (!validateForm()) {
      return; // Si hay errores de validación, no se envía nada al backend
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/ucn/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
      );

      if (!response.ok) {
        throw new Error('Error de conexión con el servidor');
      }

      const data = await response.json();

      if (data.error) {
        // Muestra el error de la API
        setErrors({ api: 'Credenciales incorrectas. Inténtalo de nuevo.' });
      } else {
        console.log('✅ Login exitoso:', data);
        localStorage.setItem('rut', data.rut);
        localStorage.setItem('carreras', JSON.stringify(data.carreras));
        localStorage.setItem('rol', data.rol); // 👈 Esta línea guarda el rol
        window.location.href = '/home';
      }
    } catch (err) {
      console.error(err);
      setErrors({ api: 'No se pudo conectar con el backend. Revisa si está encendido.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-container">
        <img src={logoUcn} alt="Logo UCN" className="login-logo" />
        <h2 className="login-title">¡Bienvenido!</h2>
        <p className="login-desc">
          Inicia sesión con tu correo y contraseña para comenzar a crear tus proyecciones académicas.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="login-label">Correo electrónico</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Ej: juan.perez@alumnos.ucn.cl"
            className="login-input"
            aria-label="Correo electrónico" // 👈 Accesibilidad para pruebas
          />
          {/* Muestra el error específico del email */}
          {errors.email && <div className="login-error">{errors.email}</div>}


          <label className="login-label">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="login-input"
            aria-label="Contraseña" // 👈 Accesibilidad para pruebas
          />
          {/* Muestra el error específico de la contraseña */}
          {errors.password && <div className="login-error">{errors.password}</div>}

          {/* Muestra el error general de la API */}
          {errors.api && <div className="login-error">{errors.api}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;