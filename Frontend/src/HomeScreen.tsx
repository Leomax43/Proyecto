
import "./styles/CurriculumGrid.css";
import Sidebar from "./components/Sidebar";
import "./styles/Sidebar.css";
import "./styles/HomeScreen.css";
import { Link } from "react-router-dom";

function HomeScreen() {
  // Mostrar nombre extraído del correo
  const userRut = localStorage.getItem("rut");
  const possibleEmailKeys = ["email", "correo", "userEmail", "usuario", "user", "username"];
  let userName = "Usuario";
  // buscar un valor tipo email
  let foundEmail: string | null = null;
  for (const k of possibleEmailKeys) {
    const v = localStorage.getItem(k);
    if (v && v.includes("@")) {
      foundEmail = v;
      break;
    }
  }
  // Si no se encontró en las claves comunes, revisar 'rut' por si contiene un correo
  if (!foundEmail && userRut && userRut.includes("@")) foundEmail = userRut;

  if (foundEmail) {
    const localPart = foundEmail.split("@")[0];
    // transformar 'juan.perez' o 'juan_perez' a 'Juan Perez'
    const nameParts = localPart.replace(/[_\.]+/g, " ").split(" ").filter(Boolean);
    userName = nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
  } else if (userRut) {
    // fallback: mostrar RUT si no existe correo
    userName = `RUT: ${userRut}`;
  }

return (
  <div className="home-main">
    <Sidebar />
    <main className="home-content">
      <div className="home-container">
        <header className="home-header">
          <h1>Hola, {userName}</h1>
        </header>

        <section className="home-section">
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Explora tus herramientas</h2>
          <p>
            Desde este panel puedes gestionar tu progreso académico, revisar los cursos que has completado
            y planificar los próximos pasos en tu carrera. Aprovecha las opciones disponibles para mantener
            tu avance siempre bajo control.
          </p>
        </section>

        <section>
          <div className="home-grid">
            <Link to="/malla" className="home-card">
              <div>
                <h3>Consultar Plan de Estudios</h3>
                <p>Explora la estructura completa de tu carrera organizada por niveles y semestres.</p>
              </div>
              <div className="home-cta">Ver Plan</div>
            </Link>

            <Link to="/avance" className="home-card">
              <div>
                <h3>Revisar Progreso Académico</h3>
                <p>Observa los cursos aprobados, en curso y los que aún te faltan por completar.</p>
              </div>
              <div className="home-cta">Ver Avance</div>
            </Link>

            <Link to="/proyecciones" className="home-card">
              <div>
                <h3>Planificar Semestres Futuros</h3>
                <p>Simula tus próximas inscripciones y organiza tu trayectoria para cumplir tus metas.</p>
              </div>
              <div className="home-cta">Ir a Planificación</div>
            </Link>
          </div>
        </section>

      </div>
    </main>
  </div>
);
}

export default HomeScreen;
