// src/App.tsx

import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import HomeScreen from "./HomeScreen";
import logoUcn from "./recursos/logo-ucn.png";
import escIngeniria from "./recursos/escuela-ingenieria.png";



export default function App() {
  return (
    <BrowserRouter>
      <div style={{ padding: "1rem" }}>
        <nav>
          <Link to="/">Login</Link> | <Link to="/home">Home</Link>
        </nav>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/home" element={<HomeScreen />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

// Componente simple de Login
function Login() {
  return (
    <div>
      <img src={logoUcn} className="logo" alt="Logo UCN" />
      <img src={escIngeniria} className="logo" alt="Escuela de Ingeniería" />
      <h2>¡Bienvenido!</h2>
      <p>Inicie Sesión para comenzar a crear sus proyecciones</p>
    </div>
  );
}