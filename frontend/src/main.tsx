import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from "react-router-dom"; // Solo importamos BrowserRouter
import App from './App.tsx'; // Importamos tu App
import './index.css';

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* Rodeamos toda la aplicación con el Router. 
      Ahora App.tsx (y todos sus hijos) pueden usar 'Routes', 'Route', y 'Link'.
    */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);