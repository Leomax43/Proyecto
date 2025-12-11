import React from 'react';
import './course-card.css';

export type CourseStatus = 'VACANTE' | 'APROBADO' | 'REPROBADO';

interface CourseCardProps {
  code: string;
  name?: string;
  creditos?: number;
  notaFinal?: number | null;
  status?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  className?: string;
}

const CourseCard: React.FC<CourseCardProps> = ({ code, name, creditos, notaFinal = null, status, onClick, onMouseEnter, onMouseLeave, className = '' }) => {
  const leftMeta = notaFinal != null ? `NF: ${notaFinal}` : (status ?? '');
  return (
    <div
      className={`course-card ${className}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <div className="course-code">{code}</div>
      <div className="course-name">{name}</div>
      <div className="course-nf">{leftMeta}</div>
      <div className="course-creditos">{creditos ?? 0} SCT</div>
    </div>
  );
};

export default CourseCard;
