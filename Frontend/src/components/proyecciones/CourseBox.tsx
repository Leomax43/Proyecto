import React from 'react';
import type { CourseBox as CourseBoxType } from './types';
import CourseCard from '../course/CourseCard';
import { normalizeStatus } from '../../utils/statusHelpers';

type Props = {
  box: CourseBoxType;
  onClick: (key: string) => void; // key will be composite id||code
  getCourseName?: (code: string) => string;
};

const CourseBox: React.FC<Props> = ({ box, onClick }) => {
  const clickKey = `${box.id}||${box.code || ''}`;
  const ns = normalizeStatus(box.status, undefined);
  const isBlocked = (box.status || '').toString().toUpperCase() === 'BLOQUEADO';
  const handleClick = () => {
    if (isBlocked) return;
    onClick(clickKey);
  };
  const blockedClass = isBlocked ? ' status-bloqueado' : '';
  return (
    <CourseCard
      code={box.code || '—'}
      name={box.name}
      creditos={box.creditos}
      status={box.status}
      onClick={handleClick}
      className={`avance-course ${ns.spanishClass} ${ns.englishClass}${blockedClass}`}
    />
  );
};

export default CourseBox;
