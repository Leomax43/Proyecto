import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import '../styles/Sidebar.css';

// --- INTERFAZ para la Carrera ---
interface Carrera {
  codigo: string;
  nombre: string;
  catalogo: string;
}

const Sidebar: React.FC = () => {
  const navigate = useNavigate();

  // 1. ESTADO: Inicializamos leyendo de localStorage DENTRO del componente
  // Esto asegura que leamos el valor actualizado después del Login
  const [userName, setUserName] = useState<string>('Nombre de usuario');
  const [careerName, setCareerName] = useState<string>('Carrera del usuario');
  const [userRole, setUserRole] = useState<string | null>(null);

  const defaultAvatar = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
  const [avatarUrl, setAvatarUrl] = useState<string>(() => localStorage.getItem('avatarUrl') || defaultAvatar);
  const [editingAvatar, setEditingAvatar] = useState<boolean>(false);
  const [tempAvatarUrl, setTempAvatarUrl] = useState<string>('');
  
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('sidebarCollapsed');
      return stored === 'true';
    } catch (e) {
      return false;
    }
  });

  // 2. EFECTO: Cargar datos del usuario al montar el componente
  useEffect(() => {
    // Leer Rol
    setUserRole(localStorage.getItem('rol'));

    // Leer Nombre
    const storedName = localStorage.getItem('nombre');
    const storedEmail = localStorage.getItem('email') || localStorage.getItem('correo') || localStorage.getItem('userEmail');
    const userRut = localStorage.getItem('rut');

    if (storedName) {
      setUserName(storedName);
    } else if (storedEmail && storedEmail.includes('@')) {
      const localPart = storedEmail.split('@')[0];
      const nameParts = localPart.replace(/[_\.]+/g, ' ').split(' ').filter(Boolean);
      const formattedName = nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
      setUserName(formattedName);
    } else if (userRut) {
      setUserName(`RUT: ${userRut}`);
    }

    // Leer Carrera
    const carrerasString = localStorage.getItem('carreras');
    if (carrerasString) {
      try {
        const carreras: Carrera[] = JSON.parse(carrerasString);
        if (carreras && carreras.length > 0) {
          setCareerName(carreras[0].nombre);
        }
      } catch (error) {
        console.error("Error al parsear carreras en Sidebar:", error);
      }
    }
  }, []); // Se ejecuta una vez al aparecer el Sidebar

  useEffect(() => {
    try {
      localStorage.setItem('sidebarCollapsed', String(collapsed));
    } catch (e) {
      // ignore
    }
  }, [collapsed]);

  useEffect(() => {
    if (avatarUrl && avatarUrl !== defaultAvatar) {
      localStorage.setItem('avatarUrl', avatarUrl);
    } else if (avatarUrl === defaultAvatar) {
      localStorage.removeItem('avatarUrl');
    }
  }, [avatarUrl]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const toggleCollapsed = () => setCollapsed((s) => !s);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button
        className={`sidebar-toggle ${collapsed ? 'is-collapsed' : ''}`}
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'Expandir sidebar' : 'Minimizar sidebar'}
        aria-controls="sidebar-nav"
        aria-expanded={!collapsed}
        title={collapsed ? 'Expandir' : 'Minimizar'}
      >
        {collapsed ? '›' : '‹'}
      </button>
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

      <nav className="sidebar-nav" id="sidebar-nav">
        <NavLink to="/malla" data-tooltip="Malla Curricular" className={({ isActive }) => isActive ? "sidebar-btn active" : "sidebar-btn"}>
          <div className="sidebar-btn-content">
            <span className="icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="4" width="7" height="6" rx="1" fill="currentColor" />
                <rect x="14" y="4" width="7" height="6" rx="1" fill="currentColor" />
                <rect x="3" y="14" width="7" height="6" rx="1" fill="currentColor" />
                <rect x="14" y="14" width="7" height="6" rx="1" fill="currentColor" />
              </svg>
            </span>
            <span className="label">Malla Curricular</span>
          </div>
        </NavLink>

        <NavLink to="/avance" data-tooltip="Avance Curricular" className={({ isActive }) => isActive ? "sidebar-btn active" : "sidebar-btn"}>
          <div className="sidebar-btn-content">
            <span className="icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 17L9 11L13 15L21 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="label">Avance Curricular</span>
          </div>
        </NavLink>

        <NavLink to="/proyecciones" data-tooltip="Proyecciones" className={({ isActive }) => isActive ? "sidebar-btn active" : "sidebar-btn"}>
          <div className="sidebar-btn-content">
            <span className="icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="10" width="4" height="10" rx="1" fill="currentColor" />
                <rect x="10" y="6" width="4" height="14" rx="1" fill="currentColor" />
                <rect x="16" y="2" width="4" height="18" rx="1" fill="currentColor" />
              </svg>
            </span>
            <span className="label">Proyecciones</span>
          </div>
        </NavLink>
      </nav>

      <button className="sidebar-logout" data-tooltip="Cerrar sesión" onClick={handleLogout}>
        <div className="sidebar-btn-content">
          <span className="icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 19H8a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="label">Cerrar sesión</span>
        </div>
      </button>

      <nav>
        {userRole === 'admin' && (
          <button className="sidebar-btn" data-tooltip="Panel de Administrador">
            <div className="sidebar-btn-content">
              <span className="icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="label">Panel de Administrador</span>
            </div>
          </button>
        )}
      </nav>
    </aside>
  );
};

export default Sidebar;