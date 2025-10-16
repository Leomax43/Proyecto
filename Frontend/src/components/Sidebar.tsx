import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Sidebar.css';

const userRole = localStorage.getItem('rol');
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
          <div className="sidebar-user-name">Nombre del usuario</div>
          <div className="sidebar-user-career">Carrera del usuario</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        <button className="sidebar-btn active">Malla Curricular</button>
        <button className="sidebar-btn">Avance Curricular</button>
        <button className="sidebar-btn">Proyecciones</button>
      </nav>
      {/* El botón de logout ahora usará los nuevos estilos y llama a la función */}
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