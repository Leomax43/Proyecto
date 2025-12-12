# Proyecto Integrador de Software

Plataforma web desarrollada para facilitar a los estudiantes la visualización de su malla curricular y la simulación de proyecciones académicas futuras.

## Guía de Inicio

### Requisitos Previos
* **Node.js** (v18 o superior)
* **Backend API** ejecutándose en el puerto 3000

### Instalación y Ejecución
1.  Instalar dependencias:
    
    npm install
    
2.  Iniciar el servidor de desarrollo (Frontend):
    
    npm run dev
    
3.  Abrir en el navegador: `http://localhost:5173`

## 📖 Manual de Usuario Resumido

### 1. Autenticación
* Ingrese con sus credenciales institucionales (Correo UCN y contraseña).
* El sistema validará su identidad y cargará su perfil académico.

### 2. Navegación Principal
Desde la barra lateral (Sidebar) puede acceder a:
* **Malla Curricular:** Vista gráfica de todos los ramos de su carrera.
* **Avance Curricular:** Resumen de ramos aprobados, reprobados y pendientes.
* **Proyecciones:** Herramienta para simular escenarios futuros.

### 3. Solución de Problemas
* Si visualiza un error de conexión, asegúrese de que el Backend esté encendido.
* Para verificar la integridad del sistema, ejecute los tests automatizados(en Backend):
   
    `npm test`
    