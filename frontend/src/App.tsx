// src/App.tsx

// 1. Quitamos 'BrowserRouter' de esta línea de importación
import { Routes, Route, Link } from "react-router-dom";

import HomeScreen from "./HomeScreen";
import Login from "./components/Login";
import Malla from "./Malla"; 
import Avance from "./Avance";
import Proyecciones from "./Proyecciones";

export default function App() {
  return (
    // 2. Quitamos la etiqueta <BrowserRouter> que envolvía este 'div'
    <div style={{ padding: "1rem" }}>
      <nav>
        <Link to="/">Login</Link> | <Link to="/home">Home</Link> | <Link to="/malla">Malla</Link>
      </nav>

      {/* Este <Routes> ahora funciona porque su "padre" 
        <BrowserRouter> está en main.tsx 
      */}
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/home" element={<HomeScreen />} />
        <Route path="/malla" element={<Malla />} />
        <Route path="/avance" element={<Avance />} />
        <Route path="/proyecciones" element={<Proyecciones />} />
      </Routes>
    </div>
    // 3. Quitamos la etiqueta de cierre </BrowserRouter> de aquí
  );
}