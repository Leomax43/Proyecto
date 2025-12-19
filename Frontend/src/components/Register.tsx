import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiPost } from '../config/api';
import '../styles/Register.css';

const emptyUser = {
  rut: '',
  email: '',
  password: '',
  nombre: '',
  rol: 'estudiante',
};

const emptyCareer = {
  codigo: '',
  nombre: '',
  catalogo: '',
};

const sanitizeString = (value: unknown) => (value == null ? '' : value.toString().trim());

const extractArray = (raw: unknown): any[] => {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const maybeCursos = (raw as { cursos?: unknown }).cursos;
    if (Array.isArray(maybeCursos)) return maybeCursos;
    const maybeAvances = (raw as { avances?: unknown }).avances;
    if (Array.isArray(maybeAvances)) return maybeAvances;
  }
  return [];
};

const normalizeMallaRecords = (records: any[]) =>
  records
    .map((curso) => ({
      codigo: sanitizeString(curso?.codigo ?? curso?.sigla),
      asignatura: sanitizeString(curso?.asignatura ?? curso?.nombre ?? curso?.titulo) || 'Curso sin nombre',
      creditos: Number(curso?.creditos) || 0,
      nivel: Number(curso?.nivel) || 0,
      prereq: sanitizeString(curso?.prereq ?? (Array.isArray(curso?.prereqs) ? curso.prereqs.join(',') : '')),
      equivalencias: Array.isArray(curso?.equivalencias)
        ? curso.equivalencias
            .map((value: unknown) => sanitizeString(value).toUpperCase())
            .filter(Boolean)
        : undefined,
    }))
    .filter((curso) => curso.codigo);

const normalizeAvanceRecords = (records: any[]) =>
  records
    .map((item) => ({
      nrc: sanitizeString(item?.nrc),
      period: sanitizeString(item?.period),
      student: sanitizeString(item?.student),
      course: sanitizeString(item?.course ?? item?.codigo ?? item?.sigla),
      excluded: Boolean(item?.excluded),
      inscriptionType: sanitizeString(item?.inscriptionType),
      status: sanitizeString(item?.status),
      creditos: Number(item?.creditos) || undefined,
    }))
    .filter((entry) => entry.course);

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(emptyUser);
  const [career, setCareer] = useState(emptyCareer);
  const [mallaRecords, setMallaRecords] = useState<any[]>([]);
  const [avanceRecords, setAvanceRecords] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remoteCreds, setRemoteCreds] = useState({ email: '', password: '' });
  const [remoteMessage, setRemoteMessage] = useState<string | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);

  const updateUser = (field: keyof typeof emptyUser) => (event: ChangeEvent<HTMLInputElement>) => {
    setUser((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const updateCareer = (field: keyof typeof emptyCareer) => (event: ChangeEvent<HTMLInputElement>) => {
    setCareer((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleJsonUpload = (type: 'malla' | 'avance') => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => setError('No se pudo leer el archivo seleccionado.');
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const array = extractArray(parsed);
        if (!array.length) {
          setError('El JSON no contiene registros válidos.');
          return;
        }
        if (type === 'malla') {
          setMallaRecords(array);
        } else {
          setAvanceRecords(array);
        }
        setError(null);
      } catch (err) {
        console.error(err);
        setError('El archivo debe ser un JSON válido.');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const validateManualForm = () => {
    if (!user.rut || !user.email || !user.password) {
      return 'Completa RUT, correo y contraseña.';
    }
    if (!career.codigo || !career.catalogo || !career.nombre) {
      return 'Completa los datos de la carrera principal.';
    }
    return null;
  };

  const handleManualSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    const validationError = validateManualForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await apiPost('/ucn/local/users', {
        ...user,
        carreras: [career],
      });

      if (mallaRecords.length) {
        await apiPost('/ucn/local/malla', {
          codigo: career.codigo,
          catalogo: career.catalogo,
          cursos: normalizeMallaRecords(mallaRecords),
        });
      }

      if (avanceRecords.length) {
        await apiPost('/ucn/local/avance', {
          rut: user.rut,
          codCarrera: career.codigo,
          avances: normalizeAvanceRecords(avanceRecords),
          clearPrevious: true,
        });
      }

      setMessage('Usuario creado correctamente. Ya puedes iniciar sesión.');
      setUser(emptyUser);
      setCareer(emptyCareer);
      setMallaRecords([]);
      setAvanceRecords([]);
      setTimeout(() => navigate('/'), 1200);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'No se pudo completar el registro. Revisa el backend y los datos enviados.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoteSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setRemoteMessage(null);
    if (!remoteCreds.email || !remoteCreds.password) {
      setRemoteMessage('Ingresa las credenciales que usabas en la API original.');
      return;
    }
    setRemoteLoading(true);
    try {
      await apiPost('/ucn/local/migrate', remoteCreds);
      setRemoteMessage('Migración completada. Revisa la pestaña de login.');
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'No se pudo migrar desde la API externa.';
      setRemoteMessage(message);
    } finally {
      setRemoteLoading(false);
    }
  };

  return (
    <div className="register-bg">
      <div className="register-grid">
        <section className="register-card">
          <div className="register-header">
            <h2>Crear cuenta manualmente</h2>
            <p>Sube los JSON que tengas del avance y la malla para alimentar tu base local.</p>
          </div>
          <form onSubmit={handleManualSubmit} className="register-form">
            <label>RUT</label>
            <input value={user.rut} onChange={updateUser('rut')} placeholder="11111111-1" required />

            <label>Correo institucional</label>
            <input type="email" value={user.email} onChange={updateUser('email')} required />

            <label>Contraseña</label>
            <input type="password" value={user.password} onChange={updateUser('password')} required />

            <label>Nombre</label>
            <input value={user.nombre} onChange={updateUser('nombre')} placeholder="Juan Pérez" />

            <label>Rol</label>
            <input value={user.rol} onChange={updateUser('rol')} />

            <div className="register-divider" />

            <label>Código de carrera</label>
            <input value={career.codigo} onChange={updateCareer('codigo')} required />

            <label>Nombre de carrera</label>
            <input value={career.nombre} onChange={updateCareer('nombre')} required />

            <label>Catálogo</label>
            <input value={career.catalogo} onChange={updateCareer('catalogo')} required />

            <label>Malla (JSON)</label>
            <input type="file" accept="application/json" onChange={handleJsonUpload('malla')} />
            {mallaRecords.length > 0 && <small>{mallaRecords.length} cursos listos para importar.</small>}

            <label>Avance (JSON)</label>
            <input type="file" accept="application/json" onChange={handleJsonUpload('avance')} />
            {avanceRecords.length > 0 && <small>{avanceRecords.length} registros de avance listos.</small>}

            {error && <div className="register-error">{error}</div>}
            {message && <div className="register-success">{message}</div>}

            <button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Registrar nuevo usuario'}
            </button>
            <p className="register-hint">
              ¿Ya tienes cuenta? <Link to="/">Vuelve al login</Link>
            </p>
          </form>
        </section>

        <section className="register-card register-card--secondary">
          <div className="register-header">
            <h2>Migrar desde API UCN</h2>
            <p>Usa las credenciales antiguas para clonar tus datos y guardarlos en la base local.</p>
          </div>
          <form onSubmit={handleRemoteSubmit} className="register-form">
            <label>Correo remoto</label>
            <input
              type="email"
              value={remoteCreds.email}
              onChange={(event) => setRemoteCreds((prev) => ({ ...prev, email: event.target.value }))}
            />

            <label>Contraseña remota</label>
            <input
              type="password"
              value={remoteCreds.password}
              onChange={(event) => setRemoteCreds((prev) => ({ ...prev, password: event.target.value }))}
            />

            {remoteMessage && <div className="register-info">{remoteMessage}</div>}

            <button type="submit" disabled={remoteLoading}>
              {remoteLoading ? 'Migrando...' : 'Migrar datos oficiales'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};

export default Register;
