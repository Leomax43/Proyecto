---

# 🖥️ Proyecto – Configuración de PC Nuevo

Este documento detalla los pasos necesarios para configurar el entorno y ejecutar correctamente el proyecto (backend + frontend + base de datos con Docker & WSL).

---

## 🚀 Requisitos Previos

### ✔️ Verificar e instalar WSL

```bash
wsl --status
```

Si ya está instalado:

```bash
wsl --update
```

### ✔️ Instalar Docker Desktop

Asegúrate de abrir **Docker Desktop antes de iniciar el backend**.

---

## ⚙️ Configurar Backend

### 1. Verificar archivo `.env`

Dentro de la carpeta **backend** debe existir el archivo `.env` con el siguiente contenido:

```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=ucn_user
DB_PASSWORD=ucn_pass
DB_DATABASE=proyecciones_db
```

### 2. Levantar Base de Datos con Docker

```bash
docker compose up -d
```

Verificar que funcione:

```bash
docker ps
```

### 3. Instalar dependencias del backend

```bash
cd backend
npm install
```

---

## ▶️ Iniciar Backend

Entrar a la carpeta `backend/src` en una terminal y ejecutar:

```bash
npm run start:dev
```

---

## 🎨 Iniciar Frontend

Entrar a `Frontend/src` y ejecutar:

```bash
npm run dev
```

Luego abrir la página:
👉 **[http://localhost:5173/](http://localhost:5173/)**

---

# 📋 Resumen de Pasos

| Paso | Acción                     | Comando                  |
| ---- | -------------------------- | ------------------------ |
| 1    | Clonar repo                | `git clone <url>`        |
| 2    | Instalar backend           | `npm install`            |
| 3    | Instalar frontend          | `npm install`            |
| 4    | Actualizar WSL             | `wsl --update`           |
| 5    | Revisar                    | `docker-compose.yml`     |
| 6    | Limpiar contenedores       | `docker compose down -v` |
| 7    | Levantar base de datos     | `docker compose up -d`   |
| 8    | Ejecutar backend           | `npm run start:dev`      |
| 9    | Ejecutar frontend          | `npm run dev`            |
| 10   | Probar conexión            | `http://localhost:5173/` |

---

# 🔁 Uso Normal (una vez instalado)

1. Abrir Docker Desktop
2. Iniciar backend:

   ```bash
   npm run start:dev
   ```
3. Iniciar frontend:

   ```bash
   npm run dev
   ```
4. ¡Y listo!

---

# 🧪 Datos de Prueba

**Usuario 1**
Email: `maria@example.com`
Pass: `abcd`

**Usuario 2**
Email: `ximena@example.com`
Pass: `qwerty`

---
