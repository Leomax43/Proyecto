import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import './Sidebar.css';

// --- INTERFAZ para la Carrera (solo para este componente) ---
interface Carrera {
  codigo: string;
  nombre: string;
  catalogo: string;
}

// --- Lógica para leer datos del localStorage ---
const userRole = localStorage.getItem('rol');

// 1. Leemos el RUT
const userRut = localStorage.getItem('rut');
// (La API no nos da un nombre, así que usamos el RUT. Puedes cambiar "RUT: " por "Usuario: ")
const userName = userRut ? `RUT: ${userRut}` : "Nombre de usuario"; 

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