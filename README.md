# Proyecto Integrador de Software

Aplicación web que permite a las y los estudiantes visualizar su malla curricular, registrar su avance y planificar proyecciones académicas futuras con ayuda de simulaciones automáticas configurables.

## Características Clave
- Visualización completa de la malla curricular con estados por asignatura.
- Gestión manual de proyecciones académicas y ordenamiento por semestre.
- Simulación automática con preferencias ajustables (carga, prioridad, desbloqueo de prerrequisitos, entre otras).
- Persistencia local de proyecciones y preferencias para retomar el trabajo sin perder cambios.

## Arquitectura
- **Backend:** NestJS (TypeScript) expuesto en http://localhost:3000.
- **Frontend:** React + Vite (TypeScript) sirviendo en http://localhost:5173.
- **Persistencia:** Información académica proporcionada por servicios externos UCN y almacenamiento local en el navegador para el trabajo del usuario.

## Requisitos Previos
- Node.js v18 o superior.
- Acceso a la API Backend levantada en el puerto 3000.
- Variables de entorno del backend definidas (ej. conexión a base de datos) cuando sea necesario.

## Puesta en Marcha

### Backend
1. Abrir una terminal en la carpeta `backend`.
2. Instalar dependencias con `npm install`.
3. Configurar las variables de entorno según el entorno de despliegue.
4. Ejecutar `npm run start:dev` para iniciar el servidor en modo recarga automática.

### Frontend
1. Abrir otra terminal en la carpeta `Frontend`.
2. Instalar dependencias con `npm install`.
3. Ejecutar `npm run dev` para servir la aplicación en modo desarrollo.
4. Abrir http://localhost:5173 en el navegador.

## Uso Rápido

### Autenticación
- Ingrese con sus credenciales institucionales. El sistema cargará automáticamente su perfil y la malla asociada.

### Navegación
- **Malla Curricular:** resumen visual del plan de estudios con estados por ramo.
- **Avance Curricular:** indicadores de progreso, asignaturas aprobadas y pendientes.
- **Proyecciones:** espacio para crear escenarios y aplicar la simulación automática.

### Simulador Automático
- Active el modo automático para generar una propuesta basada en su estado actual.
- Ajuste las preferencias disponibles: número máximo de asignaturas, carga objetivo, prioridad de selección, enfoque en desbloqueo de prerrequisitos, dispersión por nivel y límite de semestres.
- Aplique la propuesta para marcar ramos como aprobados o pendientes según el resultado y elimine duplicados futuros de forma automática.

## Pruebas y Verificación
- **Backend:** `npm test`
- **Frontend:** `npm run test`

## Resolución de Problemas
- Si el frontend no puede conectarse, valide que el backend esté activo en el puerto 3000.
- Revise la configuración de variables de entorno del backend si existen errores de conexión a servicios externos.
- Ejecute las pruebas correspondientes para confirmar la integridad del proyecto.
