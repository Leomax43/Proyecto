import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // 👈 importamos el hook de navegación
import logoUcn from '../recursos/logo-ucn.png';
import './Login.css';

const API_BASE_URL = "http://localhost:3000";

const Login: React.FC = () => {
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate(); // 👈 inicializamos el hook

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rut || !password) {
      setError('Por favor ingresa tu correo y contraseña');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/ucn/login?email=${encodeURIComponent(rut)}&password=${encodeURIComponent(password)}`
      );

      if (!response.ok) {
        throw new Error('Error de conexión con el servidor');
      }

      const data = await response.json();

      if (data.error) {
        setError('Credenciales incorrectas');
      } else {
        console.log('✅ Login exitoso:', data);

        // (opcional) guardar el rut o las carreras en localStorage
        localStorage.setItem('rut', data.rut);
        localStorage.setItem('carreras', JSON.stringify(data.carreras));

        // 👇 redirige a la página home
        navigate('/home');
      }
    } catch (err) {
      console.error(err);
      setError('No se pudo conectar con el backend');
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
            value={rut}
            onChange={e => setRut(e.target.value)}
            placeholder="Ej: juan@example.com"
            className="login-input"
          />

          <label className="login-label">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="login-input"
          />

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
