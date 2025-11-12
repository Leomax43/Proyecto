import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import '../styles/Sidebar.css';

// --- INTERFAZ para la Carrera (solo para este componente) ---
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

// 2. Leemos el nombre de la carrera
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
    // Dejamos el nombre por defecto
  }
}
// --- Fin de la lógica ---


const Sidebar: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-profile">
        <div className="sidebar-avatar">
          <img src="https://cdn-icons-png.flaticon.com/512/149/149071.png" alt="avatar" />
        </div>
        <div className="sidebar-user-info">
          {/* 3. Usamos las variables dinámicas */}
          <div className="sidebar-user-name">{userName}</div>
          <div className="sidebar-user-career">{careerName}</div>
        </div>
      </div>

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