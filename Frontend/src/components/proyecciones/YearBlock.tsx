import React from 'react';
import type { YearSim, SemesterSim } from './types';
import CourseBox from './CourseBox';

type Props = {
  year: YearSim;
  expanded: boolean;
  onToggle: (yearIndex: number) => void;
  onToggleCourse: (yearIndex: number, semIdx: number, courseKey: string) => void;
  getCourseName?: (code: string) => string;
};

const YearBlock: React.FC<Props> = ({ year, expanded, onToggle, onToggleCourse }) => {
  return (
    <div className="year-block">
      <div className="year-header" onClick={() => onToggle(year.yearIndex)}>
        <div className="year-title">{year.yearIndex === 0 ? 'Año Actual' : `Año Simulado ${year.yearIndex}`}</div>
        <div className="year-toggle">{expanded ? '−' : '+'}</div>
      </div>

      {expanded && (
        <div className="year-content">
          {year.semesters.map((s: SemesterSim, si: number) => (
            <div key={si} className="semester-row">
              <div className="semester-label">{s.label}</div>
              <div className="semester-courses">
                {s.courses.map(c => {
                  const name = (typeof (c as any).name === 'string') ? (c as any).name : (undefined as string | undefined);
                  const box = name ? { ...c, name } : c;
                  return (
                    <CourseBox key={c.id} box={box} onClick={(key) => onToggleCourse(year.yearIndex, si, key)} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default YearBlock;
