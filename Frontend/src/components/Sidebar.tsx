import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import '../styles/Sidebar.css';

// --- INTERFAZ para la Carrera ---
interface Carrera {
  codigo: string;
  nombre: string;
  catalogo: string;
}

// --- Lógica para leer datos del localStorage ---
const userRole = localStorage.getItem('rol');

// Obtener nombre del usuario preferentemente desde 'nombre' o desde el email (parte antes del @)
const storedName = localStorage.getItem('nombre');
const storedEmail = localStorage.getItem('email') || localStorage.getItem('correo') || localStorage.getItem('userEmail');

let userName = 'Nombre de usuario';
if (storedName) {
  userName = storedName;
} else if (storedEmail && storedEmail.includes('@')) {
  const localPart = storedEmail.split('@')[0];
  const nameParts = localPart.replace(/[_\.]+/g, ' ').split(' ').filter(Boolean);
  userName = nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
} else {
  // fallback: mostrar RUT si no hay nombre ni correo
  const userRut = localStorage.getItem('rut');
  if (userRut) userName = `RUT: ${userRut}`;
}

// Leemos el nombre de la carrera
let careerName = "Carrera del usuario";
const carrerasString = localStorage.getItem('carreras');

if (carrerasString) {
  try {
    const carreras: Carrera[] = JSON.parse(carrerasString);
    if (carreras && carreras.length > 0) {
      careerName = carreras[0].nombre; // Mostramos la primera carrera
    }
  } catch (error) {
    console.error("Error al parsear carreras en Sidebar:", error);
  }
}

const Sidebar: React.FC = () => {
  const navigate = useNavigate();

  const defaultAvatar = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
  const [avatarUrl, setAvatarUrl] = useState<string>(() => localStorage.getItem('avatarUrl') || defaultAvatar);
  const [editingAvatar, setEditingAvatar] = useState<boolean>(false);
  const [tempAvatarUrl, setTempAvatarUrl] = useState<string>('');

  useEffect(() => {
    // keep localStorage in sync if avatarUrl changes
    if (avatarUrl && avatarUrl !== defaultAvatar) {
      localStorage.setItem('avatarUrl', avatarUrl);
    } else if (avatarUrl === defaultAvatar) {
      // remove custom avatar when using default
      localStorage.removeItem('avatarUrl');
    }
  }, [avatarUrl]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-profile">
        <div className="sidebar-avatar" onClick={() => { setTempAvatarUrl(avatarUrl === defaultAvatar ? '' : avatarUrl); setEditingAvatar(true); }} title="Hacer clic para cambiar avatar">
          <img src={avatarUrl || defaultAvatar} alt="avatar" onError={(e) => { (e.currentTarget as HTMLImageElement).src = defaultAvatar; }} />
          <div className="avatar-edit-overlay">✎</div>
        </div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{userName}</div>
          <div className="sidebar-user-career">{careerName}</div>
        </div>
      </div>

      {editingAvatar && (
        <div className="avatar-url-input">
          <input
            type="text"
            placeholder="Pegar URL de la imagen"
            value={tempAvatarUrl}
            onChange={(e) => setTempAvatarUrl(e.target.value)}
          />
          <div className="avatar-url-actions">
            <button className="btn small primary" onClick={() => { setAvatarUrl(tempAvatarUrl || defaultAvatar); setEditingAvatar(false); }}>Guardar</button>
            <button className="btn small ghost" onClick={() => { setEditingAvatar(false); setTempAvatarUrl(''); }}>Cancelar</button>
            <button className="btn small danger" onClick={() => { setAvatarUrl(defaultAvatar); setEditingAvatar(false); setTempAvatarUrl(''); }}>Quitar</button>
          </div>
        </div>
      )}

      <nav className="sidebar-nav">
        <NavLink
          to="/malla"
          className={({ isActive }) =>
            isActive ? "sidebar-btn active" : "sidebar-btn"
          }
        >
          Malla Curricular
        </NavLink>

        <NavLink
          to="/avance"
          className={({ isActive }) =>
            isActive ? "sidebar-btn active" : "sidebar-btn"
          }
        >
          Avance Curricular
        </NavLink>

        <NavLink
          to="/proyecciones"
          className={({ isActive }) =>
            isActive ? "sidebar-btn active" : "sidebar-btn"
          }
        >
          Proyecciones
        </NavLink>
      </nav>

      <button className="sidebar-logout" onClick={handleLogout}>
        Cerrar sesión
      </button>

      <nav>
        {userRole === 'admin' && (
          <button>Panel de Administrador</button>
        )}
      </nav>
    </aside>
  );
};

export default Sidebar;