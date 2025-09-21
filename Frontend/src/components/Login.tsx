import React, { useState } from 'react';
import logoUcn from '../recursos/logo-ucn.png';
import './Login.css';

const Login: React.FC = () => {
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rut || !password) {
      setError('Por favor ingresa tu RUT y contraseña');
      return;
    }
    // Aquí iría la lógica de autenticación con el backend
    setError('');
    alert('Login exitoso (simulado)');
  };

  return (
    <div className="login-bg">
      <div className="login-container">
        <img src={logoUcn} alt="Logo UCN" className="login-logo" />
        <h2 className="login-title">¡Bienvenido!</h2>
        <p className="login-desc">
          Inicia sesión con tu RUT y contraseña para comenzar a crear tus proyecciones académicas.
        </p>
        <form onSubmit={handleSubmit}>
          <label className="login-label">RUT</label>
          <input
            type="text"
            value={rut}
            onChange={e => setRut(e.target.value)}
            placeholder="Ej: 12.345.678-9"
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
          <button type="submit" className="login-btn">
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
