import React from 'react';
import type { CourseBox as CourseBoxType } from './types';

type Props = {
  box: CourseBoxType;
  onClick: (id: string) => void;
};

const CourseBox: React.FC<Props> = ({ box, onClick }) => {
  const statusClass = box.status ? `status-${box.status.toLowerCase()}` : '';
  return (
    <div className={`avance-course ${statusClass}`} onClick={() => onClick(box.id)}>
      <div className="course-code">{box.code || '—'}</div>
      <div className="course-status">{box.status || 'VACANTE'}</div>
    </div>
  );
};

export default CourseBox;
