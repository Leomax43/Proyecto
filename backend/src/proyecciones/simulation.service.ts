import { Injectable } from '@nestjs/common';
import {
	CourseBoxDto,
	ProyeccionDto,
	SemesterDto,
	SimulationPreferencesDto,
	SimulationResultDto,
	WarningDto,
	YearDto,
} from './dto/simulate-projection.dto';

interface ApiCurso {
	codigo: string;
	asignatura: string;
	creditos?: number;
	nivel?: number;
	prereq?: string;
	creditosRequisito?: number;
	creditosRequeridos?: number;
	creditos_req?: number;
	creditos_minimos?: number;
	nivelRequisito?: number;
	nivelMinimo?: number;
	nivel_minimo?: number;
	nivelReq?: number;
}

interface ApiAvance {
	nrc?: string;
	period?: string;
	student?: string;
	course: string;
	excluded?: boolean;
	inscriptionType?: string;
	status?: string;
	creditos?: number;
	asignatura?: string;
}

type CourseStatus =
	| 'APROBADO'
	| 'REPROBADO'
	| 'VACANTE'
	| 'INSCRITO'
	| 'CONVALIDADO'
	| 'BLOQUEADO'
	| 'EXCEPCION'
	| 'UNKNOWN';

type CourseMeta = {
	code: string;
	name: string;
	credits: number;
	level: number;
	prereqs: string[];
	creditRequirement: number;
	minLevelRequirement: number;
	isTitulo: boolean;
	dependentCount: number;
};

type StudentState = {
	approved: Set<string>;
	approvedCredits: number;
	failures: Map<string, number>;
	pendingFailures: Set<string>;
	maxLevel: number;
	secondChanceCount: number;
	periodSemesters: Array<{ period: string; semester: SemesterDto }>;
};

type SimulationRuntime = {
	approved: Set<string>;
	approvedCredits: number;
	failures: Map<string, number>;
	pendingFailures: Set<string>;
	maxLevel: number;
	secondChanceCount: number;
	secondChanceLimitWarned: boolean;
	thirdFailureWarned: Set<string>;
};

type SemesterProcessContext = {
	yearIndex: number;
	semIdx: number;
	isLastMeaningful: boolean;
};

type ProcessedCourse = {
	course: CourseBoxDto;
	meta?: CourseMeta;
	status: CourseStatus;
	blocked: boolean;
	reasons: string[];
	originalIndex: number;
};

type SimulationPreferences = {
	maxCoursesPerSemester: number | null;
	targetCredits: { min: number; max: number } | null;
	priority: 'PENDING_FIRST' | 'NEW_FIRST' | 'BALANCED';
	unlockFocus: boolean;
	levelDispersion: number;
	semesterLimit: number | null;
};

@Injectable()
export class SimulationService {
	simulate(
		proyeccion: ProyeccionDto,
		allCourses: ApiCurso[],
		allAvance: ApiAvance[],
		rawPreferences?: SimulationPreferencesDto,
	): SimulationResultDto {
		const courseMeta = this.buildCourseMeta(allCourses || []);
		const currentOverrides = this.extractCurrentSemesterOverrides(proyeccion);
		const adjustedAvance = this.applyOverridesToAvance(allAvance || [], currentOverrides);
		const studentState = this.buildStudentState(adjustedAvance, courseMeta);
		this.applyOverridesToStudentState(studentState, currentOverrides, courseMeta);

		const baseYears = this.prepareInitialYears(proyeccion, studentState, courseMeta, currentOverrides);
		const timelineYears = this.prepareTimeline(proyeccion, courseMeta);
		const mergedYears = this.mergeTimelineYears(baseYears, timelineYears);
		const retakeSeededYears = this.ensureFailedCoursesRetake(mergedYears, currentOverrides, courseMeta);

		const preferences = this.buildPreferences(rawPreferences);
		const autoPopulation = this.autoPopulateFutureYears(retakeSeededYears, courseMeta, studentState, preferences);

		const warnings: WarningDto[] = [...autoPopulation.warnings];
		const processedYears = this.processYears(
			autoPopulation.years,
			courseMeta,
			studentState,
			warnings,
			preferences.semesterLimit ?? undefined,
		);

		return { years: processedYears, warnings };
	}

	private buildPreferences(dto?: SimulationPreferencesDto): SimulationPreferences {
		const defaults: SimulationPreferences = {
			maxCoursesPerSemester: null,
			targetCredits: null,
			priority: 'BALANCED',
			unlockFocus: false,
			levelDispersion: 2,
			semesterLimit: null,
		};

		if (!dto) {
			return defaults;
		}

		const preferences: SimulationPreferences = { ...defaults };

		if (typeof dto.maxCoursesPerSemester === 'number') {
			preferences.maxCoursesPerSemester = dto.maxCoursesPerSemester;
		}

		if (dto.targetLoad) {
			preferences.targetCredits = this.mapTargetLoad(dto.targetLoad);
		}

		if (dto.priority) {
			preferences.priority = dto.priority;
		}

		if (typeof dto.unlockFocus === 'boolean') {
			preferences.unlockFocus = dto.unlockFocus;
		}

		if (typeof dto.levelDispersion === 'number') {
			preferences.levelDispersion = Math.max(0, Math.min(2, dto.levelDispersion));
		}

		const normalizedLimit = this.normalizeSemesterLimit(dto.semesterLimit);
		if (normalizedLimit !== null) {
			preferences.semesterLimit = normalizedLimit;
		}

		return preferences;
	}

	private normalizeSemesterLimit(raw?: number | null): number | null {
		if (typeof raw !== 'number' || !Number.isFinite(raw)) {
			return null;
		}
		return Math.max(1, Math.floor(raw));
	}

	private mapTargetLoad(load: 'LOW' | 'MEDIUM' | 'HIGH'): { min: number; max: number } {
		switch (load) {
			case 'LOW':
				return { min: 12, max: 18 };
			case 'MEDIUM':
				return { min: 18, max: 24 };
			case 'HIGH':
			default:
				return { min: 24, max: 30 };
		}
	}

	private buildCourseMeta(allCourses: ApiCurso[]): Map<string, CourseMeta> {
		const map = new Map<string, CourseMeta>();
		const validCodes = new Set<string>();

		allCourses.forEach((curso) => {
			const code = this.normalize(curso.codigo);
			if (!code) return;
			const name = (curso.asignatura || '').trim();
			if (!name) return;
			validCodes.add(code);
			const credits = Number.isFinite(curso.creditos) ? Number(curso.creditos) : 0;
			const level = Number.isFinite(curso.nivel) ? Number(curso.nivel) : 0;
			const prereqs = this.parsePrereqs(curso.prereq);

			const creditCandidates: Array<number | undefined> = [
				curso.creditosRequisito,
				curso.creditosRequeridos,
				curso.creditos_req,
				curso.creditos_minimos,
			];
			let creditRequirement = 0;
			for (const candidate of creditCandidates) {
				const parsed = Number(candidate);
				if (Number.isFinite(parsed) && parsed > 0) {
					creditRequirement = parsed;
					break;
				}
			}

			const levelCandidates: Array<number | undefined> = [
				curso.nivelRequisito,
				curso.nivelMinimo,
				curso.nivel_minimo,
				curso.nivelReq,
			];
			let minLevelRequirement = 0;
			for (const candidate of levelCandidates) {
				const parsed = Number(candidate);
				if (Number.isFinite(parsed) && parsed > 0) {
					minLevelRequirement = parsed;
					break;
				}
			}

			const loweredName = name.toLowerCase();
			const isCapstone = loweredName.includes('capstone') || loweredName.includes('proyecto de titulo');

			map.set(code, {
				code,
				name,
				credits,
				level,
				prereqs,
				creditRequirement,
				minLevelRequirement,
				isTitulo: credits >= 30 || isCapstone,
				dependentCount: 0,
			});
		});

		map.forEach((meta) => {
			meta.prereqs = meta.prereqs.filter((pr) => validCodes.has(pr));
		});

		map.forEach((meta) => {
			meta.dependentCount = 0;
		});

		map.forEach((meta) => {
			meta.prereqs.forEach((pr) => {
				const prereqMeta = map.get(pr);
				if (prereqMeta) {
					prereqMeta.dependentCount += 1;
				}
			});
		});
		return map;
	}

	private extractCurrentSemesterOverrides(proyeccion: ProyeccionDto): Map<string, CourseBoxDto> {
		const overrides = new Map<string, CourseBoxDto>();
		if (!proyeccion || !Array.isArray(proyeccion.years)) return overrides;
		const now = new Date().getFullYear();
		const currentYear =
			proyeccion.years.find((year) => year.yearIndex === 0) ||
			proyeccion.years.find((year) => year.yearIndex === now);
		if (!currentYear) return overrides;
		const semesters = currentYear.semesters || [];
		if (semesters.length === 0) return overrides;
		const targetSemester = semesters[semesters.length - 1];
		if (!targetSemester) return overrides;

		targetSemester.courses.forEach((course) => {
			const code = this.normalize(course.code);
			if (!code) return;
			overrides.set(code, this.cloneCourse(course));
		});

		return overrides;
	}

	private applyOverridesToAvance(avance: ApiAvance[], overrides: Map<string, CourseBoxDto>): ApiAvance[] {
		if (!Array.isArray(avance) || overrides.size === 0) return avance;
		return avance.map((record) => {
			const code = this.normalize(record.course || (record as any).codigo);
			if (!code) return record;
			const override = overrides.get(code);
			if (!override) return record;
			return {
				...record,
				status: override.status ?? record.status,
				creditos: override.creditos ?? record.creditos,
				asignatura: override.name ?? record.asignatura,
			};
		});
	}

	private mergeSemesterWithOverrides(
		semester: SemesterDto,
		overrides: Map<string, CourseBoxDto>,
		courseMeta: Map<string, CourseMeta>,
	): SemesterDto {
		const cloned = this.cloneSemester(semester);
		if (overrides.size === 0) {
			return this.enrichSemester(cloned, courseMeta);
		}

		const used = new Set<string>();
		const updatedCourses = cloned.courses.map((course) => {
			const code = this.normalize(course.code);
			if (!code) return this.enrichCourse(course, courseMeta);
			const override = overrides.get(code);
			if (!override) {
				return this.enrichCourse(course, courseMeta);
			}
			used.add(code);
			const merged: CourseBoxDto = {
				...course,
				status: override.status ?? course.status,
				creditos: override.creditos ?? course.creditos,
				name: override.name ?? course.name,
				id: override.id || course.id || this.makeId(),
			};
			return this.enrichCourse(merged, courseMeta);
		});

		overrides.forEach((override, rawCode) => {
			const code = this.normalize(rawCode);
			if (!code || used.has(code)) return;
			const meta = courseMeta.get(code);
			const merged: CourseBoxDto = {
				id: override.id || this.makeId(),
				code,
				status: override.status ?? 'VACANTE',
				creditos: override.creditos ?? meta?.credits ?? 0,
				name: override.name ?? meta?.name,
			};
			updatedCourses.push(this.enrichCourse(merged, courseMeta));
		});

		return {
			...cloned,
			courses: updatedCourses,
		};
	}

	private applyOverridesToStudentState(
		student: StudentState,
		overrides: Map<string, CourseBoxDto>,
		courseMeta: Map<string, CourseMeta>,
	): void {
		if (overrides.size === 0) return;

		const originalMaxLevel = student.maxLevel;

		overrides.forEach((override, rawCode) => {
			const code = this.normalize(rawCode);
			if (!code) return;
			const status = this.normalizePlanStatus(override.status);
			if (status === 'REPROBADO') {
				if (student.approved.has(code)) {
					student.approved.delete(code);
				}
				const currentFailures = student.failures.get(code) ?? 0;
				student.failures.set(code, Math.max(currentFailures, 1));
			} else if (status === 'APROBADO' || status === 'CONVALIDADO') {
				student.approved.add(code);
				student.failures.delete(code);
			}
		});

		let newApprovedCredits = 0;
		let newMaxLevel = 0;
		student.approved.forEach((code) => {
			const meta = courseMeta.get(code);
			if (!meta) return;
			newApprovedCredits += meta.credits;
			if (meta.level > newMaxLevel) newMaxLevel = meta.level;
		});

		student.approvedCredits = newApprovedCredits;
		student.maxLevel = Math.max(newMaxLevel, originalMaxLevel);

		const newPendingFailures = new Set<string>();
		student.failures.forEach((count, code) => {
			if (count > 0) {
				newPendingFailures.add(code);
			}
		});
		student.pendingFailures = newPendingFailures;
		student.secondChanceCount = Array.from(student.failures.values()).filter((count) => count >= 2).length;
	}

	private buildStudentState(avance: ApiAvance[], courseMeta: Map<string, CourseMeta>): StudentState {
		const approved = new Set<string>();
		const failures = new Map<string, number>();
		const pendingFailures = new Set<string>();
		const periodMap = new Map<string, CourseBoxDto[]>();
		let approvedCredits = 0;
		let maxLevel = 0;

		avance.forEach((record) => {
			const code = this.normalize(record.course || (record as any).codigo);
			if (!code) return;
			const meta = courseMeta.get(code);
			const status = this.normalizeRecordStatus(record.status, record.inscriptionType);
			const creditsFromMeta = meta?.credits ?? 0;
			const credits = Number.isFinite(record.creditos) ? Number(record.creditos) : creditsFromMeta;
			const box: CourseBoxDto = {
				id: this.makeId(),
				code,
				status,
				creditos: credits,
				name: meta?.name || record.asignatura,
			};

			const period = (record.period || 'SIN_PERIODO').toString();
			if (!periodMap.has(period)) periodMap.set(period, []);
			periodMap.get(period)!.push({ ...box });

			if (status === 'APROBADO' || status === 'CONVALIDADO') {
				if (!approved.has(code)) {
					approved.add(code);
					approvedCredits += creditsFromMeta || credits || 0;
					pendingFailures.delete(code);
					if (meta && meta.level > maxLevel) maxLevel = meta.level;
				}
			} else if (status === 'REPROBADO') {
				const current = failures.get(code) ?? 0;
				failures.set(code, current + 1);
				pendingFailures.add(code);
			}
		});

		const periodSemesters = Array.from(periodMap.entries())
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([period, courses]) => ({
				period,
				semester: {
					label: this.getSemesterLabel(period),
					courses: courses.map((c) => ({ ...c, id: c.id || this.makeId() })),
				},
			}));

		failures.forEach((count, code) => {
			if (count === 0) pendingFailures.delete(code);
		});

		const secondChanceCount = Array.from(failures.values()).filter((count) => count >= 2).length;

		return {
			approved,
			approvedCredits,
			failures,
			pendingFailures,
			maxLevel,
			secondChanceCount,
			periodSemesters,
		};
	}

	private prepareInitialYears(
		proyeccion: ProyeccionDto,
		student: StudentState,
		courseMeta: Map<string, CourseMeta>,
		currentOverrides: Map<string, CourseBoxDto>,
	): YearDto[] {
		const baseYears = Array.isArray(proyeccion?.years)
			? proyeccion.years.map((year) => this.cloneYear(year))
			: [];
		const enrichedBase = baseYears.map((year) => ({
			...year,
			semesters: year.semesters.map((sem) => this.enrichSemester(sem, courseMeta)),
		}));

		const futureYears = enrichedBase.filter((y) => y.yearIndex !== 0);
		futureYears.sort((a, b) => a.yearIndex - b.yearIndex);

		const fallbackCurrent = enrichedBase.find((y) => y.yearIndex === 0) ?? null;
		const currentYear = this.buildCurrentYear(student, courseMeta, fallbackCurrent, currentOverrides);

		return [currentYear, ...futureYears];
	}

	private prepareTimeline(proyeccion: ProyeccionDto, courseMeta: Map<string, CourseMeta>): YearDto[] {
		const currentYear = new Date().getFullYear();
		if (!Array.isArray(proyeccion?.years)) {
			return [];
		}

		return proyeccion.years
			.filter((year) => year.yearIndex >= currentYear)
			.map((year) => ({
				...year,
				title: year.title || `Año Simulado ${year.yearIndex}`,
				semesters: year.semesters.map((semester) => this.enrichSemester(semester, courseMeta)),
			}))
			.sort((a, b) => a.yearIndex - b.yearIndex);
	}

	private mergeTimelineYears(baseYears: YearDto[], timelineYears: YearDto[]): YearDto[] {
		const current = baseYears.find((year) => year.yearIndex === 0) ?? null;
		const baseFuture = baseYears.filter((year) => year.yearIndex !== 0);
		const timelineFuture = timelineYears.filter((year) => year.yearIndex !== 0);
		const future = timelineFuture.length > 0 ? timelineFuture : baseFuture;
		const merged = current ? [current, ...future] : future;
		return merged.sort((a, b) => a.yearIndex - b.yearIndex);
	}

	private ensureFailedCoursesRetake(
		years: YearDto[],
		overrides: Map<string, CourseBoxDto>,
		courseMeta: Map<string, CourseMeta>,
	): YearDto[] {
		if (overrides.size === 0) return years;

		let futureYears = years.filter((year) => year.yearIndex > 0);
		if (futureYears.length === 0) {
			const baseIndex = years.reduce((max, year) => Math.max(max, year.yearIndex), 0) + 1;
			const newYear = this.createAutomaticYear(baseIndex);
			years.push(newYear);
			years.sort((a, b) => a.yearIndex - b.yearIndex);
			futureYears = [newYear];
		}

		const firstYear = futureYears[0];
		if (!firstYear.semesters || firstYear.semesters.length === 0) {
			firstYear.semesters = [
				this.enrichSemester({ label: 'Primer Semestre', courses: [] }, courseMeta),
				this.enrichSemester({ label: 'Segundo Semestre', courses: [] }, courseMeta),
			];
		}

		overrides.forEach((override, rawCode) => {
			const code = this.normalize(rawCode);
			if (!code) return;
			const status = this.normalizePlanStatus(override.status);
			if (status !== 'REPROBADO') return;

			const alreadyScheduled = futureYears.some((year) =>
				year.semesters.some((semester) =>
					semester.courses.some((course) => this.normalize(course.code) === code),
				),
			);
			if (alreadyScheduled) return;

			const meta = courseMeta.get(code);
			const targetSemester =
				firstYear.semesters[0] ?? this.enrichSemester({ label: 'Primer Semestre', courses: [] }, courseMeta);
			const newCourse: CourseBoxDto = {
				id: override.id || this.makeId(),
				code,
				status: 'VACANTE',
				creditos: override.creditos ?? meta?.credits ?? 0,
				name: override.name ?? meta?.name,
			};
			const updatedCourses = [...targetSemester.courses, this.enrichCourse(newCourse, courseMeta)];
			const updatedSemester: SemesterDto = {
				...targetSemester,
				courses: updatedCourses,
			};
			firstYear.semesters[0] = this.enrichSemester(updatedSemester, courseMeta);
		});

		return years;
	}

	private autoPopulateFutureYears(
		years: YearDto[],
		courseMeta: Map<string, CourseMeta>,
		student: StudentState,
		preferences: SimulationPreferences,
	): { years: YearDto[]; warnings: WarningDto[] } {
		const strictResult = this.autoPopulateWithMode(years, courseMeta, student, false, preferences);
		if (strictResult.remainingCount === 0) {
			return { years: strictResult.years, warnings: strictResult.warnings };
		}

		const relaxedResult = this.autoPopulateWithMode(years, courseMeta, student, true, preferences);

		if (strictResult.remainingCount <= relaxedResult.remainingCount) {
			return { years: strictResult.years, warnings: strictResult.warnings };
		}

		return { years: relaxedResult.years, warnings: relaxedResult.warnings };
	}

	private autoPopulateWithMode(
		years: YearDto[],
		courseMeta: Map<string, CourseMeta>,
		student: StudentState,
		relaxed: boolean,
		preferences: SimulationPreferences,
	): {
		years: YearDto[];
		addedCount: number;
		hasFutureCourses: boolean;
		remainingCount: number;
		warnings: WarningDto[];
	} {
		const clonedYears = years.map((year) => this.cloneYear(year));
		if (clonedYears.length === 0) {
			return {
				years: clonedYears,
				addedCount: 0,
				hasFutureCourses: false,
				remainingCount: courseMeta.size,
				warnings: [],
			};
		}

		const sortedYears = [...clonedYears].sort((a, b) => a.yearIndex - b.yearIndex);

		let maxYearIndex = sortedYears.reduce((acc, year) => Math.max(acc, year.yearIndex), 0);
		if (!sortedYears.some((year) => year.yearIndex > 0)) {
			maxYearIndex += 1;
			sortedYears.push(this.createAutomaticYear(maxYearIndex));
		}

		const targetYearLimit = preferences.semesterLimit ?? null;
		if (targetYearLimit !== null) {
			this.enforceSemesterLimit(sortedYears, targetYearLimit);
		}

		const scheduledCodes = new Set<string>(student.approved);
		sortedYears.forEach((year) => {
			year.semesters.forEach((semester) => {
				semester.courses.forEach((course) => {
					const code = this.normalize(course.code);
					if (!code) return;
					const status = this.normalizePlanStatus(course.status);
					const isFailedCurrent = year.yearIndex === 0 && status === 'REPROBADO';
					if (!isFailedCurrent) {
						scheduledCodes.add(code);
					}
				});
			});
		});

		maxYearIndex = sortedYears.reduce((acc, year) => Math.max(acc, year.yearIndex), 0);
		const yearLimitValue = targetYearLimit ?? Number.POSITIVE_INFINITY;
		let futureYearsCount = this.countFutureYears(sortedYears);

		const planApprovals = new Set<string>(student.approved);
		let planApprovedCredits = student.approvedCredits;
		let planMaxLevel = student.maxLevel;

		const pendingFailures = new Set<string>(student.pendingFailures);

		const comparator = this.createCourseComparator(preferences, pendingFailures);
		const remainingList = Array.from(courseMeta.values())
			.filter((meta) => !planApprovals.has(meta.code) && !scheduledCodes.has(meta.code))
			.sort(comparator);

		const targetCredits = preferences.targetCredits ?? null;
		const minTargetCredits = targetCredits?.min ?? 0;
		const creditCap = targetCredits?.max ?? 30;
		const maxCourses = preferences.maxCoursesPerSemester ?? null;
		const MAX_EXTRA_YEARS = 6;
		let addedYears = 0;
		let totalAdded = 0;
		let hasFutureCourses = false;
		const warnings: WarningDto[] = [];

		for (let yearIdx = 0; yearIdx < sortedYears.length; yearIdx++) {
			const year = sortedYears[yearIdx];
			if (year.yearIndex === 0) continue;

			let coursesScheduledInYear = 0;

			for (let semIdx = 0; semIdx < year.semesters.length; semIdx++) {
				const semester = year.semesters[semIdx];

				const sanitizedCourses: CourseBoxDto[] = [];
				const semesterMetas = new Map<string, CourseMeta>();
				let creditLoad = 0;

				semester.courses.forEach((course) => {
					const code = this.normalize(course.code);
					if (!code) return;
					const meta = courseMeta.get(code);
					if (!meta) return;
					const normalizedStatus = this.normalizePlanStatus(course.status);
					const isCurrentAndFailed = year.yearIndex === 0 && normalizedStatus === 'REPROBADO';

					const enriched = this.enrichCourse(course, courseMeta);
					sanitizedCourses.push(enriched);
					hasFutureCourses = true;

					if (!isCurrentAndFailed && !scheduledCodes.has(code)) {
						scheduledCodes.add(code);
					}

					if (!isCurrentAndFailed && !planApprovals.has(code)) {
						semesterMetas.set(code, meta);
					}

					const effectiveExisting = Number.isFinite(meta.credits) ? Math.max(Number(meta.credits), 0) : 0;
					creditLoad += effectiveExisting;
				});

				for (const meta of remainingList) {
					if (scheduledCodes.has(meta.code)) continue;
					if (maxCourses !== null && sanitizedCourses.length >= maxCourses) break;

					const rawCredits = Number.isFinite(meta.credits) ? Number(meta.credits) : 0;
					const credits = rawCredits;
					const effectiveCredits = credits > 0 ? credits : 0;

					const baseLevel = planMaxLevel === 0 ? 1 : planMaxLevel;
					const allowedLevel = relaxed
						? Number.POSITIVE_INFINITY
						: baseLevel + preferences.levelDispersion;
					const prereqsOk = relaxed || meta.prereqs.every((pr) => planApprovals.has(pr));
					const creditReqOk = relaxed || meta.creditRequirement <= planApprovedCredits;
					const minLevelOk = relaxed || meta.minLevelRequirement <= planMaxLevel;
					const levelOk = relaxed || meta.level <= allowedLevel;

					if (!prereqsOk || !creditReqOk || !minLevelOk || !levelOk) continue;

					const exceedsCap = effectiveCredits > 0 && creditLoad + effectiveCredits > creditCap;
					const allowOversizedCourse = exceedsCap && creditLoad === 0;
					if (exceedsCap && !allowOversizedCourse) continue;

					const newCourse: CourseBoxDto = {
						id: this.makeId(),
						code: meta.code,
						status: 'VACANTE',
						creditos: credits,
						name: meta.name,
					};

					sanitizedCourses.push(newCourse);
					scheduledCodes.add(meta.code);
					semesterMetas.set(meta.code, meta);
					if (allowOversizedCourse) {
						creditLoad = Math.max(creditCap, effectiveCredits);
					} else {
						creditLoad += effectiveCredits;
					}
					totalAdded += 1;
					coursesScheduledInYear += 1;
					hasFutureCourses = true;

					if (creditLoad >= creditCap) break;
				}

				const enrichedSemester = this.enrichSemester({ ...semester, courses: sanitizedCourses }, courseMeta);
				year.semesters[semIdx] = enrichedSemester;

				if (targetCredits && creditLoad < minTargetCredits) {
					warnings.push({
						yearIndex: year.yearIndex,
						semIdx,
						message: `No se alcanzó la carga mínima configurada (${creditLoad}/${minTargetCredits} créditos).`,
					});
				}

				semesterMetas.forEach((meta, code) => {
					if (!planApprovals.has(code)) {
						planApprovals.add(code);
						planApprovedCredits += meta.credits;
						if (meta.level > planMaxLevel) planMaxLevel = meta.level;
					}
				});
			}

			if (yearIdx === sortedYears.length - 1) {
				const unscheduled = remainingList.filter(
					(meta) => !scheduledCodes.has(meta.code) && (meta.credits ?? 0) > 0,
				);

				if (unscheduled.length > 0 && addedYears < MAX_EXTRA_YEARS) {
					if (coursesScheduledInYear === 0 && !relaxed) {
						break;
					}

					if (coursesScheduledInYear > 0 || relaxed) {
						if (futureYearsCount + 1 > yearLimitValue) {
							continue;
						}
						maxYearIndex += 1;
						const newYear = this.createAutomaticYear(maxYearIndex);
						sortedYears.push(newYear);
						futureYearsCount += 1;
						addedYears += 1;
					}
				}
			}
		}

		const remainingCount = remainingList.filter((meta) => !scheduledCodes.has(meta.code)).length;

		return {
			years: sortedYears,
			addedCount: totalAdded,
			hasFutureCourses,
			remainingCount,
			warnings,
		};
	}

	private enforceSemesterLimit(years: YearDto[], limit: number): void {
		if (!Number.isFinite(limit) || limit <= 0) {
			return;
		}

		const futureYears = years
			.filter((year) => year.yearIndex > 0)
			.sort((a, b) => a.yearIndex - b.yearIndex);

		let allowance = Math.floor(limit);

		futureYears.forEach((year) => {
			if (allowance > 0) {
				allowance -= 1;
			} else {
				year.semesters = [];
			}
		});

		for (let idx = years.length - 1; idx >= 0; idx--) {
			const year = years[idx];
			if (year.yearIndex === 0) continue;
			if (!year.semesters || year.semesters.length === 0) {
				years.splice(idx, 1);
			}
		}
	}

	private countFutureYears(years: YearDto[]): number {
		return years.filter((year) => year.yearIndex > 0 && Array.isArray(year.semesters) && year.semesters.length > 0).length;
	}

	private createCourseComparator(
		preferences: SimulationPreferences,
		pendingFailures: Set<string>,
	): (a: CourseMeta, b: CourseMeta) => number {
		return (a, b) => {
			const scorePriority = (meta: CourseMeta): number => {
				const isPending = pendingFailures.has(meta.code);
				switch (preferences.priority) {
					case 'PENDING_FIRST':
						return isPending ? 0 : 1;
					case 'NEW_FIRST':
						return isPending ? 1 : 0;
					default:
						return 0;
				}
			};

			const priorityDiff = scorePriority(a) - scorePriority(b);
			if (priorityDiff !== 0) return priorityDiff;

			const levelDiff = a.level - b.level;
			if (levelDiff !== 0) return levelDiff;

			if (preferences.unlockFocus) {
				const dependentsDiff = b.dependentCount - a.dependentCount;
				if (dependentsDiff !== 0) return dependentsDiff;
			}

			const creditsA = Number.isFinite(a.credits) ? Number(a.credits) : 0;
			const creditsB = Number.isFinite(b.credits) ? Number(b.credits) : 0;
			const creditDiff = creditsB - creditsA;
			if (creditDiff !== 0) return creditDiff;

			return a.code.localeCompare(b.code);
		};
	}

	private createAutomaticYear(yearIndex: number): YearDto {
		return {
			yearIndex,
			title: yearIndex === 0 ? 'Semestre Actual' : `Año Simulado ${yearIndex}`,
			semesters: [
				{
					label: 'Primer Semestre',
					courses: [],
				},
				{
					label: 'Segundo Semestre',
					courses: [],
				},
			],
		};
	}

	private buildCurrentYear(
		student: StudentState,
		courseMeta: Map<string, CourseMeta>,
		fallback: YearDto | null,
		overrides: Map<string, CourseBoxDto>,
	): YearDto {
		if (student.periodSemesters.length > 0) {
			const latest = student.periodSemesters[student.periodSemesters.length - 1];
			const mergedSemester = this.mergeSemesterWithOverrides(this.cloneSemester(latest.semester), overrides, courseMeta);
			return {
				yearIndex: 0,
				title: 'Semestre Actual',
				semesters: [mergedSemester],
			};
		}

		if (fallback) {
			const cloned = this.cloneYear(fallback);
			cloned.yearIndex = 0;
			cloned.semesters = cloned.semesters.map((sem) => this.mergeSemesterWithOverrides(sem, overrides, courseMeta));
			return cloned;
		}

		return {
			yearIndex: 0,
			title: 'Semestre Actual',
			semesters: [
				this.mergeSemesterWithOverrides(
					{
						label: 'Semestre Actual',
						courses: [],
					},
					overrides,
					courseMeta,
				),
			],
		};
	}

	private processYears(
		years: YearDto[],
		courseMeta: Map<string, CourseMeta>,
		student: StudentState,
		warnings: WarningDto[],
		maxFutureYears?: number,
	): YearDto[] {
		if (years.length === 0) return [];

		const sortedYears = [...years].sort((a, b) => a.yearIndex - b.yearIndex);
		const runtime: SimulationRuntime = {
			approved: new Set(student.approved),
			approvedCredits: student.approvedCredits,
			failures: new Map(student.failures),
			pendingFailures: new Set(student.pendingFailures),
			maxLevel: student.maxLevel,
			secondChanceCount: student.secondChanceCount,
			secondChanceLimitWarned: student.secondChanceCount > 4,
			thirdFailureWarned: new Set<string>(),
		};

		const result: YearDto[] = [];
		const lastPosition = this.findLastSemesterWithCourses(sortedYears);
		let carryForward: CourseBoxDto[] = [];

		sortedYears.forEach((year) => {
			const newYear: YearDto = {
				...year,
				semesters: [],
			};

			year.semesters.forEach((semester, semIdx) => {
				const clonedSemester = this.cloneSemester(semester);
				const mergedSemester = this.mergeCarryIntoSemester(clonedSemester, carryForward, courseMeta);
				carryForward = [];

				if (year.yearIndex === 0) {
					this.consumeActualSemester(mergedSemester, runtime, courseMeta);
					newYear.semesters.push(mergedSemester);
					return;
				}

				const semResult = this.processSemester(
					mergedSemester,
					{
						yearIndex: year.yearIndex,
						semIdx,
						isLastMeaningful: this.isLastMeaningful(year.yearIndex, semIdx, lastPosition),
					},
					runtime,
					courseMeta,
					warnings,
				);

				newYear.semesters.push(semResult.semester);
				carryForward = this.mergeCarryLists(carryForward, semResult.carryForward);
			});

			result.push(newYear);
		});

		if (carryForward.length > 0) {
			const futureYearCount = result.filter((year) => year.yearIndex > 0).length;
			const futureLimit = typeof maxFutureYears === 'number' && Number.isFinite(maxFutureYears) ? maxFutureYears : null;
			const lastYearIndex = result.reduce((acc, year) => Math.max(acc, year.yearIndex), 0);
			if (futureLimit !== null && futureYearCount >= futureLimit) {
				const context: SemesterProcessContext = {
					yearIndex: lastYearIndex,
					semIdx: 0,
					isLastMeaningful: true,
				};
				this.addWarning(
					warnings,
					context,
					`Existen ${carryForward.length} cursos adicionales que no se muestran porque se alcanzó el límite de ${futureLimit} año(s).`,
				);
			} else {
				const extraSemester: SemesterDto = {
					label: 'Semestre adicional',
					courses: carryForward.map((course) => this.cloneCourse(course)),
				};
				result.push({
					yearIndex: lastYearIndex + 1,
					title: `Año adicional ${lastYearIndex + 1}`,
					semesters: [this.enrichSemester(extraSemester, courseMeta)],
				});
			}
		}

		return result;
	}

	private processSemester(
		semester: SemesterDto,
		context: SemesterProcessContext,
		runtime: SimulationRuntime,
		courseMeta: Map<string, CourseMeta>,
		warnings: WarningDto[],
	): { semester: SemesterDto; carryForward: CourseBoxDto[] } {
		const processed: ProcessedCourse[] = [];

		semester.courses.forEach((course, index) => {
			const normalizedCode = this.normalize(course.code);
			const enrichedCourse = this.enrichCourse(course, courseMeta);
			if (!normalizedCode) {
				processed.push({
					course: enrichedCourse,
					meta: undefined,
					status: 'VACANTE',
					blocked: false,
					reasons: [],
					originalIndex: index,
				});
				return;
			}

			const meta = courseMeta.get(normalizedCode);
			let status = this.normalizePlanStatus(enrichedCourse.status);
			const hasException = this.hasExceptionStatus(enrichedCourse.status);
			const reasons: string[] = [];

			if (!meta) {
				reasons.push('Curso no encontrado en la malla');
				status = 'BLOQUEADO';
			}

			if (meta && status !== 'REPROBADO') {
				if (!hasException) {
					if (runtime.approved.has(normalizedCode)) {
						reasons.push('Curso ya aprobado en períodos anteriores');
						status = 'BLOQUEADO';
					}

					const missing = meta.prereqs.filter((pr) => !runtime.approved.has(pr));
					if (missing.length > 0) {
						reasons.push(`Prerequisitos pendientes: ${missing.join(', ')}`);
						status = 'BLOQUEADO';
					}

					const blockedByFailures = meta.prereqs.filter((pr) => runtime.pendingFailures.has(pr));
					if (blockedByFailures.length > 0) {
						reasons.push(`Prerequisitos reprobados sin recuperar: ${blockedByFailures.join(', ')}`);
						status = 'BLOQUEADO';
					}

					const allowedLevel = runtime.maxLevel + 2;
					if (meta.level > allowedLevel) {
						reasons.push(`Nivel ${meta.level} supera el máximo permitido (${allowedLevel})`);
						status = 'BLOQUEADO';
					}

					if (meta.creditRequirement > runtime.approvedCredits) {
						reasons.push(`Requiere ${meta.creditRequirement} créditos aprobados`);
						status = 'BLOQUEADO';
					}

					if (meta.minLevelRequirement > runtime.maxLevel) {
						reasons.push(`Requiere nivel ${meta.minLevelRequirement}`);
						status = 'BLOQUEADO';
					}
				}
			}

			processed.push({
				course: enrichedCourse,
				meta,
				status,
				blocked: status === 'BLOQUEADO',
				reasons,
				originalIndex: index,
			});
		});

		const tituloIndices = processed
			.map((item, idx) => ({ item, idx }))
			.filter(({ item }) => !item.blocked && item.meta?.isTitulo)
			.map(({ idx }) => idx);

		if (tituloIndices.length > 0) {
			const keepIdx = tituloIndices[0];
			processed.forEach((item, idx) => {
				if (idx === keepIdx) return;
				if (item.meta && item.meta.credits > 0 && !item.blocked) {
					item.blocked = true;
					item.status = 'BLOQUEADO';
					item.reasons.push('Un curso de 30 créditos bloquea el semestre');
					this.addWarning(warnings, context, `${item.meta.name} se bloquea por coexistir con un curso de 30 créditos`);
				}
			});
		}

		let creditSum = processed.reduce((acc, item) => {
			if (item.blocked || !item.meta) return acc;
			if (item.status === 'BLOQUEADO') return acc;
			return acc + (item.meta.credits || 0);
		}, 0);

		for (let i = processed.length - 1; i >= 0 && creditSum > 30; i--) {
			const item = processed[i];
			if (item.blocked || !item.meta) continue;
			if (item.meta.credits <= 0) continue;
			item.blocked = true;
			item.status = 'BLOQUEADO';
			item.reasons.push('Se excede el máximo de 30 créditos');
			creditSum -= item.meta.credits;
			this.addWarning(warnings, context, `${item.meta.name} excede el máximo de 30 créditos en el semestre`);
		}

		if (creditSum > 0 && creditSum < 12 && !context.isLastMeaningful) {
			this.addWarning(warnings, context, 'El semestre tiene menos de 12 créditos (mínimo requerido)');
		}

		if (creditSum === 0) {
			this.addWarning(warnings, context, 'Semestre sin créditos asignados no es válido');
		}

		const carryMap = new Map<string, CourseBoxDto>();

		processed.forEach((item) => {
			const code = this.normalize(item.course.code);
			if (!code) return;
			const meta = item.meta;
			const finalStatus = this.selectFinalStatus(item.status, item.blocked);
			item.course.status = finalStatus;

			if (item.blocked && meta) {
				item.reasons.forEach((reason) => this.addWarning(warnings, context, `${meta.name}: ${reason}`));
			}

			if (!item.blocked) {
				if (finalStatus === 'APROBADO' || finalStatus === 'CONVALIDADO') {
					this.registerApproval(runtime, code, meta);
				}

				if (finalStatus === 'REPROBADO') {
					this.registerFailure(runtime, code, meta, context, warnings);
				}
			}

			const shouldCarry =
				finalStatus === 'REPROBADO' || finalStatus === 'VACANTE' || finalStatus === 'BLOQUEADO';
			if (shouldCarry && meta && !carryMap.has(code)) {
				const carryCourse: CourseBoxDto = {
					id: this.makeId(),
					code: meta.code,
					status: 'VACANTE',
					creditos: meta.credits,
					name: meta.name,
				};
				carryMap.set(code, carryCourse);
			}
		});

		semester.courses = processed
			.sort((a, b) => a.originalIndex - b.originalIndex)
			.map((item) => ({ ...item.course }));

		const carryForward = Array.from(carryMap.values());
		return { semester, carryForward };
	}

	private consumeActualSemester(
		semester: SemesterDto,
		runtime: SimulationRuntime,
		courseMeta: Map<string, CourseMeta>,
	): void {
		semester.courses = semester.courses.map((course) => {
			const enriched = this.enrichCourse(course, courseMeta);
			const code = this.normalize(enriched.code);
			if (!code) return enriched;
			const meta = courseMeta.get(code);
			const status = this.normalizePlanStatus(enriched.status);
			if (status === 'APROBADO' || status === 'CONVALIDADO') {
				this.registerApproval(runtime, code, meta);
			} else if (status === 'REPROBADO') {
				this.registerFailure(runtime, code, meta, { yearIndex: 0, semIdx: 0, isLastMeaningful: false }, []);
			}
			return enriched;
		});
	}

	private registerApproval(runtime: SimulationRuntime, code: string, meta?: CourseMeta): void {
		if (runtime.approved.has(code)) return;
		runtime.approved.add(code);
		runtime.pendingFailures.delete(code);
		if (meta) {
			runtime.approvedCredits += meta.credits;
			if (meta.level > runtime.maxLevel) runtime.maxLevel = meta.level;
		}
	}

	private registerFailure(
		runtime: SimulationRuntime,
		code: string,
		meta: CourseMeta | undefined,
		context: SemesterProcessContext,
		warnings: WarningDto[],
	): void {
		const current = runtime.failures.get(code) ?? 0;
		const updated = current + 1;
		runtime.failures.set(code, updated);
		runtime.pendingFailures.add(code);

		if (updated >= 3 && !runtime.thirdFailureWarned.has(code)) {
			this.addWarning(
				warnings,
				context,
				`${meta?.name || code} alcanza una tercera reprobación (proyección inválida)`,
			);
			runtime.thirdFailureWarned.add(code);
		}

		if (updated === 2) {
			runtime.secondChanceCount += 1;
		}

		if (runtime.secondChanceCount > 4 && !runtime.secondChanceLimitWarned) {
			this.addWarning(
				warnings,
				context,
				'Más de cuatro cursos alcanzan segunda reprobación (proyección inválida)',
			);
			runtime.secondChanceLimitWarned = true;
		}
	}

	private mergeCarryIntoSemester(
		semester: SemesterDto,
		carry: CourseBoxDto[],
		courseMeta: Map<string, CourseMeta>,
	): SemesterDto {
		if (carry.length === 0) return this.enrichSemester(semester, courseMeta);
		const mergedCourses = semester.courses.map((course) => this.cloneCourse(course));
		const existing = new Set(mergedCourses.map((course) => this.normalize(course.code)));
		carry.forEach((course) => {
			const code = this.normalize(course.code);
			if (!code || existing.has(code)) return;
			mergedCourses.push(this.cloneCourse(course));
			existing.add(code);
		});
		return this.enrichSemester({ ...semester, courses: mergedCourses }, courseMeta);
	}

	private mergeCarryLists(current: CourseBoxDto[], next: CourseBoxDto[]): CourseBoxDto[] {
		if (next.length === 0) return current;
		const merged = current.map((course) => this.cloneCourse(course));
		const existing = new Set(merged.map((course) => this.normalize(course.code)));
		next.forEach((course) => {
			const code = this.normalize(course.code);
			if (!code || existing.has(code)) return;
			merged.push(this.cloneCourse(course));
			existing.add(code);
		});
		return merged;
	}

	private findLastSemesterWithCourses(years: YearDto[]): { yearIndex: number; semIdx: number } {
		let last = { yearIndex: 0, semIdx: 0 };
		years.forEach((year) => {
			year.semesters.forEach((semester, index) => {
				const hasContent = semester.courses.some((course) => !!this.normalize(course.code));
				if (hasContent) {
					if (year.yearIndex > last.yearIndex || (year.yearIndex === last.yearIndex && index >= last.semIdx)) {
						last = { yearIndex: year.yearIndex, semIdx: index };
					}
				}
			});
		});
		return last;
	}

	private isLastMeaningful(yearIndex: number, semIdx: number, last: { yearIndex: number; semIdx: number }): boolean {
		return yearIndex === last.yearIndex && semIdx === last.semIdx;
	}

	private enrichSemester(semester: SemesterDto, courseMeta: Map<string, CourseMeta>): SemesterDto {
		return {
			...semester,
			courses: semester.courses.map((course) => this.enrichCourse(course, courseMeta)),
		};
	}

	private enrichCourse(course: CourseBoxDto, courseMeta: Map<string, CourseMeta>): CourseBoxDto {
		const cloned = this.cloneCourse(course);
		if (!cloned.id) cloned.id = this.makeId();
		const code = this.normalize(cloned.code);
		if (!code) return cloned;
		const meta = courseMeta.get(code);
		if (meta) {
			cloned.code = meta.code;
			if (!cloned.name) cloned.name = meta.name;
			if (meta.credits > 0) cloned.creditos = meta.credits;
		}
		return cloned;
	}

	private cloneYear(year: YearDto): YearDto {
		return {
			...year,
			semesters: year.semesters.map((semester) => this.cloneSemester(semester)),
		};
	}

	private cloneSemester(semester: SemesterDto): SemesterDto {
		return {
			...semester,
			courses: semester.courses.map((course) => this.cloneCourse(course)),
		};
	}

	private cloneCourse(course: CourseBoxDto): CourseBoxDto {
		return { ...course };
	}

	private addWarning(warnings: WarningDto[], context: SemesterProcessContext, message: string): void {
		warnings.push({ yearIndex: context.yearIndex, semIdx: context.semIdx, message });
	}

	private normalize(value?: string | null): string {
		if (!value) return '';
		return value.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
	}

	private parsePrereqs(prereq?: string): string[] {
		if (!prereq) return [];
		return prereq
			.split(',')
			.map((token) => this.normalize(token))
			.filter(Boolean);
	}

	private normalizePlanStatus(status?: string | null): CourseStatus {
		const raw = this.normalize(status);
		if (raw.includes('APROB')) return 'APROBADO';
		if (raw.includes('CONVALID')) return 'CONVALIDADO';
		if (raw.includes('REPROB') || raw.includes('FAIL')) return 'REPROBADO';
		if (raw.includes('INSCR')) return 'INSCRITO';
		if (raw.includes('VACANTE')) return 'VACANTE';
		if (raw.includes('BLOQUE')) return 'BLOQUEADO';
		if (raw.includes('EXCE')) return 'EXCEPCION';
		if (!raw) return 'VACANTE';
		return 'UNKNOWN';
	}

	private normalizeRecordStatus(status?: string | null, inscriptionType?: string | null): CourseStatus {
		const normalizedInscription = this.normalize(inscriptionType);
		if (normalizedInscription.includes('CONVALID') || normalizedInscription.includes('REGULAR')) {
			return 'CONVALIDADO';
		}
		return this.normalizePlanStatus(status);
	}

	private hasExceptionStatus(status?: string | null): boolean {
		const raw = this.normalize(status);
		return raw.includes('EXCEPC');
	}

	private selectFinalStatus(initial: CourseStatus, blocked: boolean): CourseStatus {
		if (blocked) return 'BLOQUEADO';
		if (initial === 'UNKNOWN') return 'VACANTE';
		return initial;
	}

	private getSemesterLabel(period?: string): string {
		const value = (period || '').toString();
		if (value.length < 6) return `Periodo ${value || 'desconocido'}`;
		const year = value.substring(0, 4);
		const suffix = value.substring(4);
		switch (suffix) {
			case '10':
				return `Primer Semestre ${year}`;
			case '15':
				return `Curso de Invierno ${year}`;
			case '20':
				return `Segundo Semestre ${year}`;
			case '25':
				return `Curso de Verano ${year}`;
			default:
				return `Periodo ${value}`;
		}
	}

	private makeId(): string {
		return Math.random().toString(36).slice(2, 9);
	}
}
