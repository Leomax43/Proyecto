// src/App.tsx

import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import HomeScreen from "./HomeScreen";
import Login from "./components/Login";



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

