/*
import { Routes, Route, Link } from "react-router-dom";

import HomeScreen from "./HomeScreen";
import Login from "./components/Login";
import Malla from "./Malla"; 
import Avance from "./Avance";
import Proyecciones from "./Proyecciones";

export default function App() {
  return (
    <div style={{ padding: "1rem" }}>
      <nav>
        <Link to="/">Login</Link> | <Link to="/home">Home</Link> | <Link to="/malla">Malla</Link>
      </nav>

      {}
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/home" element={<HomeScreen />} />
        <Route path="/malla" element={<Malla />} />
        <Route path="/avance" element={<Avance />} />
        <Route path="/proyecciones" element={<Proyecciones />} />
      </Routes>
    </div>
    
  );
}
*/
import { Routes, Route } from "react-router-dom";

import HomeScreen from "./HomeScreen";
import Login from "./components/Login";
import Malla from "./Malla"; 
import Avance from "./Avance";
import Proyecciones from "./Proyecciones";

export default function App() {
  return (
    <div className="App">


      {}
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/home" element={<HomeScreen />} />
        <Route path="/malla" element={<Malla />} />
        <Route path="/avance" element={<Avance />} />
        <Route path="/proyecciones" element={<Proyecciones />} />
      </Routes>
    </div>
    
  );
}