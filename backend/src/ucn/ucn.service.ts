import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { MallaFormattedDto, SemestreDto, CursoDto } from './dto/malla-formatted.dto';
import { AvanceSummaryDto, CarreraAvanceDto, PeriodoDto, CursoAvanceDto } from './dto/avance-summary.dto';
import { User } from '../users/entities/user.entity';
import { UserCareer } from '../users/entities/user-career.entity';
import { Course, CourseEquivalenceDetail } from './entities/course.entity';
import { UserProgress } from './entities/user-progress.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { ImportMallaDto } from './dto/import-malla.dto';
import { ImportAvanceDto } from './dto/import-avance.dto';
import { RemoteMigrateDto } from './dto/remote-migrate.dto';
import { UpdateCourseEquivalencesDto } from './dto/update-course-equivalences.dto';

export interface UcnLoginResponse {
	rut: string;
	carreras: Array<{ codigo: string; nombre: string; catalogo: string }>;
	error?: string;
	rol?: string;
	nombre?: string;
}

const REMOTE_LOGIN_URL = 'https://puclaro.ucn.cl/eross/avance/login.php';
const REMOTE_AVANCE_URL = 'https://puclaro.ucn.cl/eross/avance/avance.php';
const REMOTE_MALLA_URL = 'https://losvilos.ucn.cl/hawaii/api/mallas';
const REMOTE_MALLA_TOKEN = process.env.HAWAII_REMOTE_TOKEN ?? 'jf400fejof13f';

type FetchInit = Parameters<typeof fetch>[1];

type RawEquivalence =
	| string
	| {
		codigo?: string;
		code?: string;
		id?: string;
		alias?: string;
		value?: string;
		nombre?: string;
		name?: string;
		descripcion?: string;
	};

type StatusRecord = { status: string; sourceCode: string; period?: string; semesterIndex?: number };
type ResolvedStatus = StatusRecord & { sourceName?: string };

@Injectable()
export class UcnService {
	constructor(
		@InjectRepository(User)
		private readonly userRepo: Repository<User>,
		@InjectRepository(UserCareer)
		private readonly userCareerRepo: Repository<UserCareer>,
		@InjectRepository(Course)
		private readonly courseRepo: Repository<Course>,
		@InjectRepository(UserProgress)
		private readonly progressRepo: Repository<UserProgress>,
	) {}

	async login(email: string, password: string): Promise<UcnLoginResponse | { error: string }> {
		const user = await this.userRepo.findOne({ where: { email }, relations: ['carreras'] });
		if (!user) {
			return { error: 'credenciales incorrectas' };
		}

		const isValid = await bcrypt.compare(password, user.passwordHash);
		if (!isValid) {
			return { error: 'credenciales incorrectas' };
		}

		return this.makeLoginResponse(user);
	}

	async createUser(dto: CreateUserDto) {
		const emailOwner = await this.userRepo.findOne({ where: { email: dto.email } });
		if (emailOwner && emailOwner.rut !== dto.rut) {
			throw new BadRequestException('El correo ya estÃ¡ asociado a otro usuario.');
		}

		let user = await this.userRepo.findOne({ where: { rut: dto.rut }, relations: ['carreras'] });
		const passwordHash = await this.hashPassword(dto.password);

		if (user) {
			user.email = dto.email;
			user.passwordHash = passwordHash;
			user.nombre = dto.nombre ?? user.nombre;
			user.rol = dto.rol ?? user.rol;
			await this.userCareerRepo.delete({ rut: dto.rut });
		} else {
			user = this.userRepo.create({
				rut: dto.rut,
				email: dto.email,
				passwordHash,
				nombre: dto.nombre,
				rol: dto.rol ?? 'estudiante',
			});
		}

		user.carreras = dto.carreras.map((career) =>
			this.userCareerRepo.create({
				codigo: career.codigo.trim(),
				nombre: career.nombre.trim(),
				catalogo: career.catalogo.trim(),
				rut: dto.rut,
			}),
		);

		const saved = await this.userRepo.save(user);
		return this.makeLoginResponse(saved);
	}

	async importMalla(dto: ImportMallaDto) {
		await this.courseRepo.delete({ codigoCarrera: dto.codigo, catalogo: dto.catalogo });
		const payload = dto.cursos.map((curso) => {
			const equivalencePayload = this.normalizeEquivalencesPayload(curso.equivalencias as RawEquivalence[]);
			const providedDetails = this.normalizeEquivalenceDetailList(curso.equivalenciasDetalle);
			const equivalences = equivalencePayload.codes ?? undefined;
			const equivalenceDetails = providedDetails ?? equivalencePayload.details;
			return this.courseRepo.create({
				codigo: this.normalizeCode(curso.codigo),
				asignatura: curso.asignatura.trim(),
				creditos: curso.creditos,
				nivel: curso.nivel,
				prereq: curso.prereq?.trim(),
				equivalencias: equivalences,
				equivalenciasDetalle: equivalenceDetails,
				codigoCarrera: dto.codigo,
				catalogo: dto.catalogo,
			});
		});
		await this.courseRepo.save(payload);
		return { inserted: payload.length };
	}

	async updateCourseEquivalences(dto: UpdateCourseEquivalencesDto) {
		const codigo = this.normalizeCode(dto.codigo);
		const course = await this.courseRepo.findOne({
			where: {
				codigo,
				codigoCarrera: dto.codigoCarrera,
				catalogo: dto.catalogo,
			},
		});
		if (!course) {
			throw new BadRequestException('Curso no encontrado para la carrera/catalogo indicados.');
		}
		course.equivalencias = this.normalizeEquivalences(dto.equivalencias);
		course.equivalenciasDetalle = undefined;
		await this.courseRepo.save(course);
		return {
			codigo: course.codigo,
			equivalencias: course.equivalencias ?? [],
		};
	}

	async importEquivalencesFromAdvancement(payload: unknown) {
		if (!Array.isArray(payload)) {
			throw new BadRequestException('El archivo debe ser un arreglo de carreras.');
		}
		const summary: Array<{ codigoCarrera: string; catalogo: string; detected: number; updated: number; missing: number }> = [];
		for (const block of payload) {
			const codigoCarrera = this.normalizeCode(block?.career ?? block?.codigo ?? block?.codigoCarrera);
			const catalogo = this.normalizeCode(block?.catalog ?? block?.catalogo);
			if (!codigoCarrera || !catalogo) {
				continue;
			}
			const stats = await this.processAdvancementEquivalencesBlock(block, codigoCarrera, catalogo);
			summary.push({ codigoCarrera, catalogo, ...stats });
		}
		return { careers: summary };
	}

	async importAvance(dto: ImportAvanceDto) {
		if (dto.clearPrevious ?? true) {
			await this.progressRepo.delete({ rut: dto.rut, codCarrera: dto.codCarrera });
		}
		const entries = dto.avances.map((item) =>
			this.progressRepo.create({
				rut: dto.rut,
				codCarrera: dto.codCarrera,
				nrc: item.nrc?.trim(),
				period: item.period?.trim(),
				student: item.student?.trim(),
				course: this.normalizeCode(item.course),
				excluded: item.excluded ?? false,
				inscriptionType: item.inscriptionType?.trim(),
				status: item.status?.trim().toUpperCase(),
				creditos: typeof item.creditos === 'number' ? item.creditos : undefined,
			}),
		);
		await this.progressRepo.save(entries);
		return { inserted: entries.length };
	}

	async migrateFromRemote(dto: RemoteMigrateDto) {
		try {
			const loginData = await this.fetchRemoteLogin(dto.email, dto.password);
			if (!loginData || loginData.error) {
				throw new BadRequestException(loginData?.error ?? 'No fue posible validar las credenciales remotas.');
			}

			const rut = this.sanitizeRemoteString(loginData.rut);
			if (!rut) {
				throw new BadRequestException('La API remota no devolviÃ³ un RUT vÃ¡lido.');
			}

			const careers = this.normalizeRemoteCareers(loginData.carreras);
			if (!careers.length) {
				throw new BadRequestException('El usuario remoto no tiene carreras asociadas.');
			}

			await this.createUser({
				rut: rut,
				email: dto.email,
				password: dto.password,
				nombre: this.sanitizeRemoteString(loginData.nombre),
				rol: loginData.rol ?? 'estudiante',
				carreras: careers,
			});

			for (const career of careers) {
				const remoteCourses = await this.fetchRemoteMalla(career.codigo, career.catalogo);
				if (remoteCourses.length) {
					await this.importMalla({
						codigo: career.codigo,
						catalogo: career.catalogo,
						cursos: remoteCourses,
					});
				}

				const remoteProgress = await this.fetchRemoteAvance(rut, career.codigo);
				if (remoteProgress.length) {
					await this.importAvance({
						rut: rut,
						codCarrera: career.codigo,
						avances: remoteProgress,
						clearPrevious: true,
					});
				}
			}

			return { rut, carreras: careers.length };
		} catch (error) {
			console.error('[migrateFromRemote] Failed', error);
			if (error instanceof BadRequestException) {
				throw error;
			}
			const message = error instanceof Error ? error.message : 'No se pudo migrar desde la API externa.';
			throw new BadRequestException(message);
		}
	}

	async getMalla(codigo: string, catalogo: string) {
		const courses = await this.courseRepo.find({
			where: { codigoCarrera: codigo, catalogo },
			order: { nivel: 'ASC', codigo: 'ASC' },
		});
		return courses.map((course) => ({
			codigo: course.codigo,
			asignatura: course.asignatura,
			creditos: course.creditos,
			nivel: course.nivel,
			prereq: course.prereq ?? '',
			equivalencias: course.equivalencias ?? undefined,
			equivalenciasDetalle: course.equivalenciasDetalle ?? undefined,
		}));
	}

	async getAvance(rut: string, codCarrera: string) {
		const progress = await this.progressRepo.find({
			where: { rut, codCarrera },
			order: { period: 'ASC', createdAt: 'ASC' },
		});

		if (!progress.length) {
			return { error: 'Avance no encontrado' };
		}

		return progress.map((record) => ({
			nrc: record.nrc,
			period: record.period,
			student: record.student ?? rut,
			course: record.course,
			excluded: record.excluded,
			inscriptionType: record.inscriptionType,
			status: record.status,
		}));
	}

	async getMallaFormatted(codigo: string, catalogo: string, rut?: string): Promise<MallaFormattedDto> {
		const mallaEntities = await this.courseRepo.find({
			where: { codigoCarrera: codigo, catalogo },
			order: { nivel: 'ASC', codigo: 'ASC' },
		});

		if (!mallaEntities.length) {
			return { semestres: [] };
		}

		const statusMap = rut ? await this.buildStatusMap(rut, codigo) : new Map<string, StatusRecord[]>();
		const grupos = new Map<number, CursoDto[]>();
		const niveles = mallaEntities.map((course) => course.nivel).filter((nivel) => typeof nivel === 'number');
		const maxNivel = niveles.length ? Math.max(...niveles) : 1;

		mallaEntities.forEach((course) => {
			const codigoCurso = this.normalizeCode(course.codigo);
			const curso: CursoDto = {
				codigo: codigoCurso,
				nombre: course.asignatura,
				creditos: course.creditos,
				prereqs: this.parsePrereqs(course.prereq),
			};

				const status = this.resolveStatusForCourse(codigoCurso, course.equivalencias, course.equivalenciasDetalle, statusMap);
			if (status) {
				curso.status = status.status;
				curso.statusSourceCode = status.sourceCode;
				curso.statusSourceName = status.sourceName;
				if (status.sourceName) {
					curso.nombre = status.sourceName;
				}
			}

			const targetLevel = this.resolveDisplayLevel(course, status, maxNivel);
			if (!grupos.has(targetLevel)) {
				grupos.set(targetLevel, []);
			}
			grupos.get(targetLevel)!.push(curso);
		});

		const semestres: SemestreDto[] = Array.from(grupos.entries())
			.sort((a, b) => a[0] - b[0])
			.map(([nivel, cursos]) => ({ nivel, cursos }));

		return { semestres };
	}

	async getAvanceSummary(rut: string, carrerasJson?: string): Promise<AvanceSummaryDto> {
		let carrerasInfo: Array<{ codigo: string; catalogo: string; nombre?: string }> = [];

		if (carrerasJson) {
			try {
				const parsed = JSON.parse(carrerasJson);
				if (Array.isArray(parsed)) {
					carrerasInfo = parsed;
				}
			} catch (error) {
				console.error('[getAvanceSummary] Error parsing carreras JSON:', error);
			}
		}

		if (!carrerasInfo.length) {
			const stored = await this.userCareerRepo.find({ where: { rut } });
			carrerasInfo = stored.map((career) => ({
				codigo: career.codigo,
				catalogo: career.catalogo,
				nombre: career.nombre,
			}));
		}

		if (!carrerasInfo.length) {
			return { carreras: [] };
		}

		const results = await Promise.all(
			carrerasInfo.map(async (career) => {
				if (!career.codigo || !career.catalogo) {
					return null;
				}
				const summary = await this.getAvanceSummaryForCareer(rut, career.codigo, career.catalogo);
				summary.nombre = career.nombre || summary.nombre;
				return summary;
			}),
		);

		return { carreras: results.filter((item): item is CarreraAvanceDto => item !== null) };
	}

	async getAvanceSummaryForCareer(rut: string, codCarrera: string, catalogo: string): Promise<CarreraAvanceDto> {
		const [avanceRaw, mallaRaw, careerInfo] = await Promise.all([
			this.progressRepo.find({ where: { rut, codCarrera } }),
			this.courseRepo.find({ where: { codigoCarrera: codCarrera, catalogo } }),
			this.userCareerRepo.findOne({ where: { rut, codigo: codCarrera } }),
		]);

		if (!avanceRaw.length) {
			return {
				codigo: codCarrera,
				nombre: '',
				catalogo,
				periodos: [],
				creditosAprobados: 0,
				creditosTotales: 0,
			};
		}

		const courseMeta = new Map<string, { nombre: string; creditos: number; codigo: string }>();
		mallaRaw.forEach((course) => {
			const canonical = this.normalizeCode(course.codigo);
			const meta = {
				nombre: course.asignatura,
				creditos: course.creditos,
				codigo: canonical,
			};
			courseMeta.set(canonical, meta);
			if (course.equivalencias?.length) {
				course.equivalencias.forEach((alias) => {
					const aliasCode = this.normalizeCode(alias);
					if (!aliasCode || aliasCode === canonical) {
						return;
					}
					if (!courseMeta.has(aliasCode)) {
						courseMeta.set(aliasCode, meta);
					}
				});
			}
		});

		const periodoMap = new Map<string, CursoAvanceDto[]>();
		let creditosTotales = 0;
		let creditosAprobados = 0;

		avanceRaw.forEach((item) => {
			const periodo = item.period || 'SIN_PERIODO';
			const codigoCurso = this.normalizeCode(item.course);
			const meta = courseMeta.get(codigoCurso);
			const creditos = meta?.creditos ?? item.creditos ?? 0;
			const status = (item.status || '').toString().toUpperCase();

			const curso: CursoAvanceDto = {
				nrc: item.nrc ?? '',
				codigo: meta?.codigo ?? codigoCurso,
				nombre: meta?.nombre || 'Nombre no encontrado',
				status,
				creditos,
				inscriptionType: item.inscriptionType,
			};

			if (!periodoMap.has(periodo)) {
				periodoMap.set(periodo, []);
			}
			periodoMap.get(periodo)!.push(curso);

			creditosTotales += creditos;
			if (status === 'APROBADO') {
				creditosAprobados += creditos;
			}
		});

		const periodos: PeriodoDto[] = Array.from(periodoMap.entries())
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([periodo, cursos]) => ({ periodo, label: this.getPeriodLabel(periodo), cursos }));

		return {
			codigo: codCarrera,
			nombre: careerInfo?.nombre ?? '',
			catalogo,
			periodos,
			creditosAprobados,
			creditosTotales,
		};
	}

	private async fetchRemoteLogin(email: string, password: string) {
		const url = `${REMOTE_LOGIN_URL}?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
		return this.fetchJson<any>(url);
	}

	private async fetchRemoteMalla(codigo: string, catalogo: string) {
		if (!codigo || !catalogo) {
			return [];
		}
		const url = `${REMOTE_MALLA_URL}?${encodeURIComponent(codigo)}-${encodeURIComponent(catalogo)}`;
		const data = await this.fetchJson<any>(url, {
			// Endpoint requiere el encabezado con mayúsculas exactas.
			headers: { 'X-HAWAII-AUTH': REMOTE_MALLA_TOKEN },
		});
		if (!Array.isArray(data)) {
			return [];
		}
		return data
			.map((curso: any) => {
				const equivalenceData = this.normalizeEquivalencesPayload(this.extractRemoteEquivalences(curso));
				return {
					codigo: this.normalizeCode(curso?.codigo),
					asignatura: this.sanitizeRemoteString(curso?.asignatura) || 'Sin nombre',
					creditos: Number(curso?.creditos) || 0,
					nivel: Number(curso?.nivel) || 0,
					prereq: this.sanitizeRemoteString(curso?.prereq),
					equivalencias: equivalenceData.codes,
					equivalenciasDetalle: equivalenceData.details,
				};
			})
			.filter((curso) => !!curso.codigo);
	}

	private async fetchRemoteAvance(rut: string, codCarrera: string) {
		const url = `${REMOTE_AVANCE_URL}?rut=${encodeURIComponent(rut)}&codcarrera=${encodeURIComponent(codCarrera)}`;
		const data = await this.fetchJson<any>(url);
		if (!Array.isArray(data)) {
			return [];
		}
		return data
			.map((item: any) => ({
				nrc: this.sanitizeRemoteString(item?.nrc),
				period: this.sanitizeRemoteString(item?.period),
				student: this.sanitizeRemoteString(item?.student),
				course: this.normalizeCode(item?.course),
				excluded: Boolean(item?.excluded),
				inscriptionType: this.sanitizeRemoteString(item?.inscriptionType),
				status: this.sanitizeRemoteString(item?.status),
				creditos: Number(item?.creditos) || undefined,
			}))
			.filter((entry) => !!entry.course);
	}

	private normalizeRemoteCareers(raw: any[]): Array<{ codigo: string; nombre: string; catalogo: string }> {
		if (!Array.isArray(raw)) {
			return [];
		}
		return raw
			.map((career) => {
				const codigo = this.sanitizeRemoteString(career?.codigo ?? career?.codCarrera ?? career?.id);
				const catalogo = this.sanitizeRemoteString(career?.catalogo ?? career?.plan ?? career?.codPlan);
				const nombre = this.sanitizeRemoteString(career?.nombre ?? career?.carrera ?? career?.descripcion) || 'Carrera';
				if (!codigo || !catalogo) {
					return null;
				}
				return { codigo, catalogo, nombre };
			})
			.filter((career): career is { codigo: string; nombre: string; catalogo: string } => career !== null);
	}

	private async processAdvancementEquivalencesBlock(block: any, codigoCarrera: string, catalogo: string) {
		const courseMap = new Map<string, { aliases: Set<string>; details: Map<string, string> }>();
		const students = Array.isArray(block?.students) ? block.students : [];
		for (const student of students) {
			const advancement = Array.isArray(student?.advancement) ? student.advancement : [];
			for (const record of advancement) {
				const original = record?.originalCourse;
				const canonical = this.normalizeCode(original?.code);
				const options = Array.isArray(original?.options) ? original.options : [];
				if (!canonical) {
					continue;
				}
				const bucket = courseMap.get(canonical) ?? { aliases: new Set<string>(), details: new Map<string, string>() };
				const registerAlias = (rawCode?: string, rawName?: string) => {
					const alias = this.normalizeCode(rawCode);
					if (!alias || alias === canonical) {
						return;
					}
					bucket.aliases.add(alias);
					const label = this.sanitizeRemoteString(rawName);
					if (label) {
						bucket.details.set(alias, label);
					}
				};

				const directEquivalents = this.normalizeEquivalences(original?.equivalents) ?? [];
				directEquivalents.forEach((alias) => registerAlias(alias));

				options.forEach((option) => {
					registerAlias(option?.code ?? option?.codigo, option?.name ?? option?.nombre);
					const optionEquivalents = this.normalizeEquivalences(option?.equivalents) ?? [];
					optionEquivalents.forEach((value) => registerAlias(value));
				});

				if (bucket.aliases.size) {
					courseMap.set(canonical, bucket);
				}
			}
		}

		let updated = 0;
		let missing = 0;
		for (const [codigoCurso, payload] of courseMap.entries()) {
			const additions = Array.from(payload.aliases);
			const result = await this.upsertCourseEquivalences(codigoCurso, codigoCarrera, catalogo, additions, payload.details);
			if (!result.found) {
				missing++;
			} else if (result.updated) {
				updated++;
			}
		}

		return {
			detected: courseMap.size,
			updated,
			missing,
		};
	}

	private extractRemoteEquivalences(raw: any): RawEquivalence[] | undefined {
		if (!raw) {
			return undefined;
		}
		const output: RawEquivalence[] = [];
		const consumeCandidate = (value: unknown) => {
			if (!value) {
				return;
			}
			if (typeof value === 'string') {
				const tokens = value
					.split(/[;,]/)
					.map((entry) => entry.trim())
					.filter(Boolean);
				if (tokens.length) {
					output.push(...tokens);
				}
				return;
			}
			if (Array.isArray(value)) {
				value.forEach((entry) => consumeCandidate(entry));
				return;
			}
			if (typeof value === 'object') {
				output.push(value as RawEquivalence);
			}
		};
		const candidates = [raw.equivalencias, raw.equiv, raw.aliases, raw.alias, raw.equivalentes];
		candidates.forEach((candidate) => consumeCandidate(candidate));

		const options = Array.isArray(raw?.options) ? raw.options : [];
		options.forEach((option) => {
			if (option?.code || option?.codigo) {
				output.push({ codigo: option.code ?? option.codigo, nombre: option?.name ?? option?.nombre });
			}
			if (option?.equivalents || option?.equivalencias) {
				consumeCandidate(option.equivalents ?? option.equivalencias);
			}
		});

		return output.length ? output : undefined;
	}

	private sanitizeRemoteString(value: unknown): string {
		if (value === null || value === undefined) {
			return '';
		}
		return value.toString().trim();
	}

	private async fetchJson<T>(url: string, init?: FetchInit): Promise<T> {
		try {
			const response = await fetch(url, init);
			if (!response.ok) {
				const text = await response.text();
				throw new BadRequestException(`Error al consultar ${url}: ${response.status} ${text || response.statusText}`);
			}
			return (await response.json()) as T;
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}
			const reason = error instanceof Error ? error.message : 'error desconocido';
			throw new BadRequestException(`No se pudo contactar ${url}: ${reason}`);
		}
	}

	private parsePrereqs(prereq?: string): string[] {
		if (!prereq) return [];
		return prereq
			.split(',')
			.map((value) => value.trim().toUpperCase())
			.filter(Boolean);
	}

	private normalizeEquivalences(values?: string[] | null): string[] | undefined {
		if (!Array.isArray(values)) {
			return undefined;
		}
		const normalized = values.map((value) => this.normalizeCode(value)).filter(Boolean);
		return normalized.length ? normalized : undefined;
	}

	private normalizeEquivalencesPayload(values?: RawEquivalence[] | null): {
		codes?: string[];
		details?: CourseEquivalenceDetail[];
	} {
		if (!Array.isArray(values)) {
			return { codes: undefined, details: undefined };
		}
		const codes = new Set<string>();
		const detailMap = new Map<string, string>();
		values.forEach((value) => {
			if (value === null || value === undefined) {
				return;
			}
			let code: string | undefined;
			let name: string | undefined;
			if (typeof value === 'string') {
				code = value;
			} else if (typeof value === 'object') {
				code =
					value.codigo ??
					value.code ??
					value.id ??
					value.alias ??
					value.value ??
					undefined;
				name = value.nombre ?? value.name ?? value.descripcion ?? undefined;
			}
			code = this.normalizeCode(code);
			if (!code) {
				return;
			}
			codes.add(code);
			if (name) {
				detailMap.set(code, name.trim());
			}
		});
		const details = detailMap.size
			? Array.from(detailMap.entries()).map(([codigo, nombre]) => ({ codigo, nombre }))
			: undefined;
		return {
			codes: codes.size ? Array.from(codes) : undefined,
			details,
		};
	}

	private normalizeEquivalenceDetailList(details?: Array<{ codigo?: string; nombre?: string }> | null): CourseEquivalenceDetail[] | undefined {
		if (!details?.length) {
			return undefined;
		}
		const normalized = details
			.map((entry) => ({
				codigo: this.normalizeCode(entry?.codigo),
				nombre: entry?.nombre?.trim() || undefined,
			}))
			.filter((entry) => !!entry.codigo);
		return normalized.length ? normalized : undefined;
	}

	private mergeEquivalenceDetails(
		current: CourseEquivalenceDetail[] | undefined,
		updates: Map<string, string> | undefined,
		validCodes: Set<string>,
	): CourseEquivalenceDetail[] | undefined {
		if (!validCodes.size) {
			return undefined;
		}
		const data = new Map<string, string>();
		(current ?? []).forEach((detail) => {
			const code = this.normalizeCode(detail?.codigo);
			if (!code || !validCodes.has(code)) {
				return;
			}
			const label = detail?.nombre?.trim();
			if (label) {
				data.set(code, label);
			}
		});
		updates?.forEach((value, key) => {
			const code = this.normalizeCode(key);
			if (!code || !validCodes.has(code)) {
				return;
			}
			const label = value?.trim();
			if (label) {
				data.set(code, label);
			}
		});
		if (!data.size) {
			return undefined;
		}
		return Array.from(data.entries()).map(([codigo, nombre]) => ({ codigo, nombre }));
	}

	private haveEquivalenceDetailsChanged(
		current?: CourseEquivalenceDetail[] | null,
		next?: CourseEquivalenceDetail[] | null,
	): boolean {
		const normalizeList = (list?: CourseEquivalenceDetail[] | null) => {
			if (!list?.length) {
				return [] as Array<{ codigo: string; nombre?: string }>;
			}
			return list
				.map((entry) => ({
					codigo: this.normalizeCode(entry?.codigo),
					nombre: entry?.nombre?.trim() || undefined,
				}))
				.filter((entry) => !!entry.codigo)
				.sort((a, b) => a.codigo.localeCompare(b.codigo));
		};
		const currentNormalized = normalizeList(current);
		const nextNormalized = normalizeList(next);
		if (currentNormalized.length !== nextNormalized.length) {
			return true;
		}
		for (let i = 0; i < currentNormalized.length; i++) {
			if (currentNormalized[i].codigo !== nextNormalized[i].codigo) {
				return true;
			}
			if ((currentNormalized[i].nombre ?? '') !== (nextNormalized[i].nombre ?? '')) {
				return true;
			}
		}
		return false;
	}

	private extractOrderedPeriods(records: UserProgress[]) {
		const unique = new Set(
			records
				.map((record) => this.normalizePeriod(record.period))
				.filter((value): value is string => !!value),
		);
		return Array.from(unique).sort((a, b) => a.localeCompare(b));
	}

	private normalizePeriod(value?: string | null) {
		if (!value) {
			return undefined;
		}
		const trimmed = value.toString().trim();
		if (!/^\d{6}$/.test(trimmed)) {
			return undefined;
		}
		return trimmed;
	}

	private calculateSemesterIndex(period: string, basePeriod: string) {
		const baseParts = this.parsePeriod(basePeriod);
		const targetParts = this.parsePeriod(period);
		if (!baseParts || !targetParts) {
			return undefined;
		}
		const yearDiff = targetParts.year - baseParts.year;
		const termDiff = targetParts.termOrder - baseParts.termOrder;
		return yearDiff * 2 + termDiff + 1;
	}

	private parsePeriod(period: string) {
		const normalized = this.normalizePeriod(period);
		if (!normalized) {
			return undefined;
		}
		const year = Number(normalized.substring(0, 4));
		const suffix = normalized.substring(4);
		const termOrder = this.getTermOrder(suffix);
		if (!termOrder || Number.isNaN(year)) {
			return undefined;
		}
		return { year, termOrder };
	}

	private getTermOrder(suffix: string) {
		switch (suffix) {
			case '10':
			case '11':
				return 1;
			case '15':
				return 1;
			case '20':
			case '21':
				return 2;
			case '25':
				return 2;
			default:
				return undefined;
		}
	}

	private async upsertCourseEquivalences(
		codigo: string,
		codigoCarrera: string,
		catalogo: string,
		additions: string[],
		detailLabels?: Map<string, string>,
	) {
		const normalizedCodigo = this.normalizeCode(codigo);
		const normalizedAdditions = this.normalizeEquivalences(additions) ?? [];
		if (!normalizedCodigo || !normalizedAdditions.length) {
			return { updated: false, found: true };
		}
		const course = await this.courseRepo.findOne({
			where: { codigo: normalizedCodigo, codigoCarrera, catalogo },
		});
		if (!course) {
			return { updated: false, found: false };
		}
		const existing = new Set(this.normalizeEquivalences(course.equivalencias) ?? []);
		let equivalencesChanged = false;
		for (const alias of normalizedAdditions) {
			if (alias && alias !== normalizedCodigo && !existing.has(alias)) {
				existing.add(alias);
				equivalencesChanged = true;
			}
		}
		const mergedDetails = this.mergeEquivalenceDetails(course.equivalenciasDetalle, detailLabels, existing);
		const detailsChanged = this.haveEquivalenceDetailsChanged(course.equivalenciasDetalle, mergedDetails);
		if (!equivalencesChanged && !detailsChanged) {
			return { updated: false, found: true };
		}
		course.equivalencias = existing.size ? Array.from(existing) : undefined;
		course.equivalenciasDetalle = mergedDetails;
		await this.courseRepo.save(course);
		return { updated: true, found: true };
	}

	private resolveStatusForCourse(
		codigoCurso: string,
		equivalencias: string[] | null | undefined,
		equivalenciasDetalle: CourseEquivalenceDetail[] | null | undefined,
		statusMap: Map<string, StatusRecord[]>,
	): ResolvedStatus | undefined {
		const normalized = this.normalizeCode(codigoCurso);
		const direct = this.consumeStatusRecord(statusMap, normalized);
		if (direct) {
			return { ...direct };
		}
		if (!equivalencias?.length) {
			return undefined;
		}
		const detailLookup = this.buildEquivalenceNameMap(equivalenciasDetalle);
		for (const alias of equivalencias) {
			const aliasCode = this.normalizeCode(alias);
			if (!aliasCode) {
				continue;
			}
			const aliasStatus = this.consumeStatusRecord(statusMap, aliasCode);
			if (aliasStatus) {
				return {
					status: aliasStatus.status,
					sourceCode: aliasStatus.sourceCode,
					sourceName: detailLookup.get(aliasCode),
					period: aliasStatus.period,
					semesterIndex: aliasStatus.semesterIndex,
				};
			}
		}
		return undefined;
	}

	private consumeStatusRecord(statusMap: Map<string, StatusRecord[]>, code: string) {
		const normalized = this.normalizeCode(code);
		if (!normalized) {
			return undefined;
		}
		const entries = statusMap.get(normalized);
		if (!entries?.length) {
			return undefined;
		}
		let index = entries.findIndex((entry) => entry.status === 'APROBADO');
		if (index === -1) {
			index = 0;
		}
		const [record] = entries.splice(index, 1);
		if (!entries.length) {
			statusMap.delete(normalized);
		}
		return record;
	}

	private resolveDisplayLevel(course: Course, status: ResolvedStatus | undefined, maxNivel: number) {
		if (!this.isProfessionalElectiveCourse(course)) {
			return course.nivel;
		}
		const sequencedLevel = this.getSequencedProfessionalElectiveLevel(course);
		if (sequencedLevel) {
			return sequencedLevel;
		}
		if (!status?.semesterIndex) {
			return course.nivel;
		}
		const normalized = Math.max(1, Math.min(maxNivel, status.semesterIndex));
		return normalized;
	}

	private isProfessionalElectiveCourse(course: Course) {
		const code = this.normalizeCode(course?.codigo);
		const name = (course?.asignatura || '').toUpperCase();
		if (!code && !name) {
			return false;
		}
		return code.startsWith('UNFP') || name.includes('FORMACIÓN PROFESIONAL ELECTIVA');
	}

	private getSequencedProfessionalElectiveLevel(course: Course): number | undefined {
		const code = this.normalizeCode(course?.codigo);
		if (!code?.startsWith('UNFP-')) {
			return undefined;
		}
		const digits = code.substring(5);
		if (!digits.length) {
			return undefined;
		}
		const firstDigit = Number(digits[0]);
		if (Number.isNaN(firstDigit)) {
			return undefined;
		}
		if (firstDigit >= 4 && firstDigit <= 8) {
			return firstDigit;
		}
		return undefined;
	}

	private buildEquivalenceNameMap(details?: CourseEquivalenceDetail[] | null) {
		const lookup = new Map<string, string>();
		(details ?? []).forEach((entry) => {
			const code = this.normalizeCode(entry?.codigo);
			if (!code) {
				return;
			}
			const name = entry?.nombre?.trim();
			if (name) {
				lookup.set(code, name);
			}
		});
		return lookup;
	}

	private normalizeCode(value?: string): string {
		return (value || '').toString().trim().toUpperCase();
	}

	private getPeriodLabel(periodo: string): string {
		if (!periodo || periodo === 'SIN_PERIODO') {
			return 'Sin perÃ­odo';
		}
		const year = periodo.substring(0, 4);
		const suffix = periodo.substring(4);
		if (suffix === '10') return `Primer Semestre ${year}`;
		if (suffix === '20') return `Segundo Semestre ${year}`;
		if (suffix === '25') return `Curso de Verano ${year}`;
		if (suffix === '15') return `Curso de Invierno ${year}`;
		return `Periodo ${periodo}`;
	}

	private async buildStatusMap(rut: string, codCarrera: string) {
		const records = await this.progressRepo.find({ where: { rut, codCarrera }, order: { period: 'ASC', createdAt: 'ASC' } });
		const orderedPeriods = this.extractOrderedPeriods(records);
		const basePeriod = orderedPeriods[0];
		const map = new Map<string, StatusRecord[]>();
		records.forEach((record) => {
			const code = this.normalizeCode(record.course);
			if (!code) return;
			const bucket = map.get(code) ?? [];
			const period = this.normalizePeriod(record.period);
			const semesterIndex = period && basePeriod ? this.calculateSemesterIndex(period, basePeriod) : undefined;
			bucket.push({
				status: (record.status ?? '').toString().toUpperCase(),
				sourceCode: code,
				period,
				semesterIndex,
			});
			map.set(code, bucket);
		});
		return map;
	}

	private async hashPassword(password: string) {
		const salt = await bcrypt.genSalt(10);
		return bcrypt.hash(password, salt);
	}

	private makeLoginResponse(user: User): UcnLoginResponse {
		return {
			rut: user.rut,
			rol: user.rol ?? 'estudiante',
			nombre: user.nombre,
			carreras: (user.carreras || []).map((career) => ({
				codigo: career.codigo,
				nombre: career.nombre,
				catalogo: career.catalogo,
			})),
		};
	}
}


