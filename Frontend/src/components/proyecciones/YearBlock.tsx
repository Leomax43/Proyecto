import React from 'react';
import type { YearSim, SemesterSim } from './types';
import CourseBox from './CourseBox';

type Props = {
  year: YearSim;
  expanded: boolean;
  onToggle: (yearIndex: number) => void;
  onToggleCourse: (yearIndex: number, semIdx: number, courseId: string) => void;
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
                {s.courses.map(c => (
                  <CourseBox key={c.id} box={c} onClick={(id) => onToggleCourse(year.yearIndex, si, id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default YearBlock;
