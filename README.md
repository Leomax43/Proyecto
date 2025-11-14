This immersive artifact is rendered using Gemini AST.

Proyecto

Bienvenido al repositorio del proyecto. Este documento contiene todos los pasos necesarios para configurar, levantar y ejecutar la aplicación (Backend y Frontend) en un entorno local.

🚀 Configuración Inicial y Levantamiento de Base de Datos

Sigue estos pasos la primera vez que configures el proyecto en tu PC.

1. Preparación del Entorno

Revisar y Actualizar WSL (Subsistema de Windows para Linux):
Asegúrate de que WSL esté instalado y actualizado, ya que es necesario para Docker Desktop en Windows.

wsl --status
wsl --update


Instalar Docker Desktop:
Descarga e instala la última versión de Docker Desktop.

Iniciar Docker Desktop:
Abre Docker Desktop antes de intentar levantar cualquier contenedor.

2. Configuración del Backend y Base de Datos

Clonar Repositorio:
Clona este proyecto en tu máquina local.

git clone [nombre_github]/[proyecto]


Crear Archivo de Variables de Entorno (.env):
Verifica que en la carpeta backend/ exista un archivo llamado .env. Si no existe, créalo y añade el siguiente contenido (es esencial para la conexión a la base de datos dentro del contenedor):

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=ucn_user
DB_PASSWORD=ucn_pass
DB_DATABASE=proyecciones_db


Levantar Contenedor de la Base de Datos:
Desde la raíz del proyecto (donde se encuentra docker-compose.yml), levanta el contenedor de PostgreSQL en modo detached (-d).

docker compose up -d


Nota: Si la base de datos ya estaba levantada y tienes problemas, puedes limpiarla y levantarla de nuevo con: docker compose down -v

Verificar el Contenedor:
Comprueba que el contenedor se esté ejecutando correctamente.

docker ps


Instalar Dependencias del Backend:
Ingresa al directorio del backend e instala las dependencias.

cd backend
npm install


Instalar Dependencias del Frontend:
Ingresa al directorio del frontend e instala las dependencias.

cd ../Frontend
npm install


⚙️ Ejecución Normal del Proyecto

Una vez que la configuración inicial esté completa, sigue estos pasos para iniciar la aplicación:

1. Iniciar Docker y Backend

Abrir Docker Desktop. (Asegúrate de que esté ejecutándose).

Levantar Contenedor DB: (Solo si no lo levantaste antes o si lo detuviste).

docker compose up -d


Iniciar el Backend:
Abre una terminal, navega a la carpeta backend/ y ejecuta:

cd backend
npm run start:dev


(Esto iniciará el servidor de desarrollo del backend, generalmente en http://localhost:3000)

2. Iniciar el Frontend

Iniciar el Frontend:
Abre otra terminal, navega a la carpeta Frontend/ y ejecuta:

cd Frontend
npm run dev


(Esto iniciará el servidor de desarrollo del frontend, generalmente en http://localhost:5173/)

3. Probar la Aplicación

Abre tu navegador web y visita:

http://localhost:5173/


📋 Resumen de Comandos

Paso

Acción

Directorio

Comando

1

Clonar repo

(Cualquiera)

git clone ...

2

Limpiar contenedores (Opcional)

Raíz del Proyecto

docker compose down -v

3

Levantar Base de Datos

Raíz del Proyecto

docker compose up -d

4

Instalar Backend

backend/

npm install

5

Instalar Frontend

Frontend/

npm install

6

Ejecutar Backend

backend/

npm run start:dev

7

Ejecutar Frontend

Frontend/

npm run dev

8

Probar Conexión

(Navegador)

http://localhost:5173/

🔑 Datos de Prueba

Utiliza estas credenciales para acceder a la aplicación después de la instalación y migración de la base de datos:

Rol

Correo Electrónico

Contraseña

Maria

maria@example.com

abcd

Ximena

ximena@example.com

qwerty
