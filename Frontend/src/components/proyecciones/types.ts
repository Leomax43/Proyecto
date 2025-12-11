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
