import React from 'react';
// Importa 'NavLink' para los botones de navegación y 'useNavigate' para el logout
import { NavLink, useNavigate } from 'react-router-dom';
import './Sidebar.css';

const userRole = localStorage.getItem('rol');

const Sidebar: React.FC = () => {
  // 'useNavigate' se sigue usando para la función de logout
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
          <div className="sidebar-user-name">Nombre del usuario</div>
          <div className="sidebar-user-career">Carrera del usuario</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {/*
          Usamos NavLink en lugar de <button>.
          La prop 'className' recibe una función.
          El argumento '{ isActive }' es un booleano que nos da React Router.
          Si 'isActive' es true, aplicamos la clase "sidebar-btn active".
          Si es false, solo aplicamos "sidebar-btn".
        */}
        
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

      {/* Botón de logout con el onClick que ya tenías */}
      <button className="sidebar-logout" onClick={handleLogout}>
        Cerrar sesión
      </button>

      <nav>
        {userRole === 'admin' && (//puede que esto se tenga que cambiar (para despues**)
          <button>Panel de Administrador</button>
        )}
      </nav>
    </aside>
  );
};

export default Sidebar;