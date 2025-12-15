export type CourseBox = {
  id: string;
  code?: string;
  status?: string;
  creditos?: number;
  name?: string;
};

export type SemesterSim = {
  label: string;
  courses: CourseBox[];
};

export type YearSim = {
  yearIndex: number;
  semesters: SemesterSim[];
  title?: string;
};

export type Projection = {
  id: string;
  title: string;
  createdAt: number;
  years: YearSim[];
};

export type SimulationLoad = 'LOW' | 'MEDIUM' | 'HIGH';
export type SimulationPriority = 'PENDING_FIRST' | 'NEW_FIRST' | 'BALANCED';
export type SimulationPreferences = {
  maxCoursesPerSemester?: number | null;
  targetLoad?: SimulationLoad | null;
  priority?: SimulationPriority | null;
  unlockFocus?: boolean;
  levelDispersion?: number | null;
  semesterLimit?: number | null;
};
