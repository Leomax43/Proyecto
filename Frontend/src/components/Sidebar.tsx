import React from "react";
import "./Sidebar.css";

const Sidebar: React.FC = () => {
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
      <button className="sidebar-logout">Cerrar sesión</button>
    </aside>
  );
};

export default Sidebar;
