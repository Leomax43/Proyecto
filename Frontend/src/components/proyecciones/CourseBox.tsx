import React from 'react';
import type { CourseBox as CourseBoxType } from './types';

type Props = {
  box: CourseBoxType;
  onClick: (key: string) => void; // key will be course code when available
  getCourseName?: (code: string) => string;
};

const CourseBox: React.FC<Props> = ({ box, onClick }) => {
  const statusClass = box.status ? `status-${box.status.toLowerCase()}` : '';
  // Send a composite key with id and code so the parent can choose to toggle by id
  // or add by course code when the box is a simulated candidate.
  const clickKey = `${box.id}||${box.code || ''}`;
  return (
    <div className={`avance-course ${statusClass}`} onClick={() => onClick(clickKey)}>
      <div className="course-code">{box.code || '—'}</div>
      {box.code && (box as any).name ? (
        <div className="course-name">{(box as any).name}</div>
      ) : null}
      <div className="course-status">{box.status || 'VACANTE'}</div>
    </div>
  );
};

export default CourseBox;
