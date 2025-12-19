import { Link, useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import logoUcn from '../assets/logo-ucn.png';
import '../styles/Login.css';
import { buildUrl } from '../config/api';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; api?: string }>({});
  const [loading, setLoading] = useState(false);


  // --- FUNCION DE VALIDACIÓN ---
  // Esta funcion se encarga de todas las restricciones del frontend
  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    // Restriccion: Email no puede estar vacio
    if (!email) {
      newErrors.email = 'El correo electrónico es obligatorio.';
    } 
    // Restriccion: Email debe tener un formato valido
    else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Por favor, ingresa un formato de correo válido.';
    }

    // Restriccion: Contraseña no puede estar vacia
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
        buildUrl(`/ucn/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`)
      );

      if (!response.ok) {
        throw new Error('Error de conexión con el servidor');
      }

      const data = await response.json();

      if (data.error) {
        // Muestra el error de la API
        setErrors({ api: 'Credenciales incorrectas. Inténtalo de nuevo.' });
      } else {
        // login successful; store data in localStorage
        // Guardamos campos esperados en localStorage para que otras pantallas los usen
        if (data.rut) localStorage.setItem('rut', data.rut);
        if (data.carreras) localStorage.setItem('carreras', JSON.stringify(data.carreras));
        if (data.rol) localStorage.setItem('rol', data.rol);
        const emailFromApi = data.email || data.correo || data.user || data.usuario || data.username || null;
        if (emailFromApi) {
          localStorage.setItem('email', emailFromApi);
        } else if (email) {
          localStorage.setItem('email', email);
        }
        if (data.nombre) localStorage.setItem('nombre', data.nombre);
        navigate('/home');
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
            aria-label="Correo electrónico"
          />
          {errors.email && <div className="login-error">{errors.email}</div>}


          <label className="login-label">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="login-input"
            aria-label="Contraseña"
          />
          {errors.password && <div className="login-error">{errors.password}</div>}
          {errors.api && <div className="login-error">{errors.api}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
          <p className="login-register-link">
            ¿No tienes cuenta? <Link to="/register">Regístrate con tus datos</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;