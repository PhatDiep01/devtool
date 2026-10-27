import React, { useState } from 'react';
import { AnnotationItem } from '../../../../types';
import { Eye, EyeOff, Layers } from 'lucide-react';

interface AnnotationOverlayViewProps {
  imageSrc: string;
  imageAlt?: string;
  annotations?: AnnotationItem[];
  className?: string;
  showToggle?: boolean;
  fit?: 'cover' | 'contain';
  onClick?: () => void;
}

export const AnnotationOverlayView: React.FC<AnnotationOverlayViewProps> = ({
  imageSrc,
  imageAlt = '',
  annotations = [],
  className = '',
  showToggle = true,
  fit = 'cover',
  onClick,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  return (
    <div className={`relative overflow-hidden group select-none ${className}`} onClick={onClick}>
      <img
        src={imageSrc}
        alt={imageAlt}
        className={`w-full h-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} transition`}
      />

      {/* SVG Layer */}
      {isVisible && annotations.length > 0 && (
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          <defs>
            {['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#A855F7', '#EC4899', '#FFFFFF', '#0F172A'].map((col) => (
              <marker
                key={col}
                id={`ov-arrow-${col.replace('#', '')}`}
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill={col} />
              </marker>
            ))}
          </defs>

          {annotations.map((ann) => {
            const x = ann.x * 1000;
            const y = ann.y * 1000;
            const w = (ann.width || 0) * 1000;
            const h = (ann.height || 0) * 1000;
            const strokeVal = (ann.strokeWidth || 3) * 1.5;
            const markerId = `ov-arrow-${(ann.color || '#EF4444').replace('#', '')}`;

            if (ann.type === 'rect') {
              return (
                <g key={ann.id}>
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    stroke={ann.color}
                    strokeWidth={strokeVal}
                    fill={ann.color}
                    fillOpacity={ann.fillOpacity || 0.12}
                    rx={4}
                  />
                  <circle cx={x} cy={y} r={12} fill={ann.color} stroke="#FFFFFF" strokeWidth={1.5} />
                  <text x={x} y={y + 3} fill="#FFFFFF" fontSize={10} fontWeight="bold" textAnchor="middle">
                    {ann.sequence}
                  </text>
                </g>
              );
            }
            if (ann.type === 'circle') {
              return (
                <g key={ann.id}>
                  <ellipse
                    cx={x + w / 2}
                    cy={y + h / 2}
                    rx={Math.abs(w) / 2}
                    ry={Math.abs(h) / 2}
                    stroke={ann.color}
                    strokeWidth={strokeVal}
                    fill={ann.color}
                    fillOpacity={ann.fillOpacity || 0.12}
                  />
                  <circle cx={x} cy={y} r={12} fill={ann.color} stroke="#FFFFFF" strokeWidth={1.5} />
                  <text x={x} y={y + 3} fill="#FFFFFF" fontSize={10} fontWeight="bold" textAnchor="middle">
                    {ann.sequence}
                  </text>
                </g>
              );
            }
            if (ann.type === 'highlight') {
              return (
                <g key={ann.id}>
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    stroke={ann.color}
                    strokeWidth={strokeVal}
                    fill={ann.color}
                    fillOpacity={0.35}
                  />
                  <circle cx={x} cy={y} r={12} fill={ann.color} stroke="#FFFFFF" strokeWidth={1.5} />
                  <text x={x} y={y + 3} fill="#FFFFFF" fontSize={10} fontWeight="bold" textAnchor="middle">
                    {ann.sequence}
                  </text>
                </g>
              );
            }
            if (ann.type === 'arrow' || ann.type === 'line') {
              return (
                <g key={ann.id}>
                  <line
                    x1={x}
                    y1={y}
                    x2={(ann.x2 !== undefined ? ann.x2 : ann.x) * 1000}
                    y2={(ann.y2 !== undefined ? ann.y2 : ann.y) * 1000}
                    stroke={ann.color}
                    strokeWidth={strokeVal}
                    markerEnd={ann.type === 'arrow' ? `url(#${markerId})` : undefined}
                  />
                  <circle cx={x} cy={y} r={12} fill={ann.color} stroke="#FFFFFF" strokeWidth={1.5} />
                  <text x={x} y={y + 3} fill="#FFFFFF" fontSize={10} fontWeight="bold" textAnchor="middle">
                    {ann.sequence}
                  </text>
                </g>
              );
            }
            if (ann.type === 'badge') {
              return (
                <g key={ann.id} transform={`translate(${x}, ${y})`}>
                  <circle cx={0} cy={0} r={16} fill={ann.color} stroke="#FFFFFF" strokeWidth={2} />
                  <text x={0} y={4} fill="#FFFFFF" fontSize={13} fontWeight="bold" textAnchor="middle">
                    {ann.sequence}
                  </text>
                </g>
              );
            }
            if (ann.type === 'text') {
              return (
                <g key={ann.id} transform={`translate(${x}, ${y})`}>
                  <rect
                    x={0}
                    y={0}
                    width={Math.max(w, 120)}
                    height={Math.max(h, 28)}
                    fill="rgba(15, 23, 42, 0.85)"
                    stroke={ann.color}
                    strokeWidth={1.5}
                    rx={4}
                  />
                  <text x={6} y={18} fill="#FFFFFF" fontSize={11} fontWeight="600">
                    {ann.note || ann.title || 'Ghi chú'}
                  </text>
                  <circle cx={-2} cy={-2} r={10} fill={ann.color} stroke="#FFFFFF" strokeWidth={1.5} />
                  <text x={-2} y={1} fill="#FFFFFF" fontSize={9} fontWeight="bold" textAnchor="middle">
                    {ann.sequence}
                  </text>
                </g>
              );
            }
            return null;
          })}
        </svg>
      )}

      {/* Layer Toggle Badge on hover */}
      {showToggle && annotations.length > 0 && (
        <div
          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setIsVisible(!isVisible)}
            className="p-1 rounded-md bg-black/70 hover:bg-black/90 text-white text-[10px] flex items-center gap-1 shadow-md"
            title={isVisible ? 'Ẩn lớp đánh dấu' : 'Hiện lớp đánh dấu'}
          >
            {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>{annotations.length}</span>
          </button>
        </div>
      )}
    </div>
  );
};
