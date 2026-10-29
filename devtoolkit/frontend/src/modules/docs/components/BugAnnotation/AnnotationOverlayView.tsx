import React, { useState } from 'react';
import { AnnotationItem } from '../../../../types';
import { Eye, EyeOff, Layers } from 'lucide-react';
import { getAnnotationTypeName } from './constants';

interface AnnotationOverlayViewProps {
  imageSrc: string;
  imageAlt?: string;
  annotations?: AnnotationItem[];
  className?: string;
  showToggle?: boolean;
  fit?: 'cover' | 'contain';
  onClick?: () => void;
  hoveredId?: string | null;
  selectedId?: string | null;
  onSelectAnnotation?: (ann: AnnotationItem) => void;
  interactive?: boolean;
}

export const AnnotationOverlayView: React.FC<AnnotationOverlayViewProps> = ({
  imageSrc,
  imageAlt = '',
  annotations = [],
  className = '',
  showToggle = true,
  fit = 'cover',
  onClick,
  hoveredId,
  selectedId,
  onSelectAnnotation,
  interactive = true,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [localHoveredAnn, setLocalHoveredAnn] = useState<AnnotationItem | null>(null);

  // Active hovered or selected item
  const activeTooltipAnn = localHoveredAnn || (hoveredId ? annotations.find(a => a.id === hoveredId) : null);

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
            <filter id="ov-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#FFFFFF" floodOpacity="0.8" />
            </filter>
          </defs>

          {annotations.map((ann) => {
            const x = ann.x * 1000;
            const y = ann.y * 1000;
            const w = (ann.width || 0) * 1000;
            const h = (ann.height || 0) * 1000;
            const strokeVal = (ann.strokeWidth || 3) * 1.5;
            const markerId = `ov-arrow-${(ann.color || '#EF4444').replace('#', '')}`;
            const isTargeted = (hoveredId && hoveredId === ann.id) || 
                               (localHoveredAnn && localHoveredAnn.id === ann.id) || 
                               (selectedId && selectedId === ann.id);

            const handleEnter = () => {
              if (interactive) setLocalHoveredAnn(ann);
            };
            const handleLeave = () => {
              if (interactive) setLocalHoveredAnn(null);
            };
            const handleClick = (e: React.MouseEvent) => {
              if (interactive && onSelectAnnotation) {
                e.stopPropagation();
                onSelectAnnotation(ann);
              }
            };

            if (ann.type === 'rect') {
              return (
                <g 
                  key={ann.id} 
                  className={interactive ? 'pointer-events-auto cursor-pointer group/marker' : ''}
                  onMouseEnter={handleEnter}
                  onMouseLeave={handleLeave}
                  onClick={handleClick}
                  filter={isTargeted ? 'url(#ov-glow)' : undefined}
                >
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    stroke={ann.color}
                    strokeWidth={isTargeted ? strokeVal + 2 : strokeVal}
                    fill={ann.color}
                    fillOpacity={isTargeted ? 0.25 : (ann.fillOpacity || 0.12)}
                    rx={4}
                  />
                  {isTargeted && (
                    <circle cx={x} cy={y} r={18} fill="none" stroke="#FFFFFF" strokeWidth={2.5} opacity={0.9} className="animate-ping origin-center" />
                  )}
                  <circle cx={x} cy={y} r={isTargeted ? 14 : 12} fill={ann.color} stroke="#FFFFFF" strokeWidth={isTargeted ? 2 : 1.5} />
                  <text x={x} y={y + 3.5} fill="#FFFFFF" fontSize={isTargeted ? 11 : 10} fontWeight="bold" textAnchor="middle">
                    {ann.sequence}
                  </text>
                </g>
              );
            }
            if (ann.type === 'circle') {
              return (
                <g 
                  key={ann.id} 
                  className={interactive ? 'pointer-events-auto cursor-pointer group/marker' : ''}
                  onMouseEnter={handleEnter}
                  onMouseLeave={handleLeave}
                  onClick={handleClick}
                  filter={isTargeted ? 'url(#ov-glow)' : undefined}
                >
                  <ellipse
                    cx={x + w / 2}
                    cy={y + h / 2}
                    rx={Math.abs(w) / 2}
                    ry={Math.abs(h) / 2}
                    stroke={ann.color}
                    strokeWidth={isTargeted ? strokeVal + 2 : strokeVal}
                    fill={ann.color}
                    fillOpacity={isTargeted ? 0.25 : (ann.fillOpacity || 0.12)}
                  />
                  {isTargeted && (
                    <circle cx={x} cy={y} r={18} fill="none" stroke="#FFFFFF" strokeWidth={2.5} opacity={0.9} className="animate-ping origin-center" />
                  )}
                  <circle cx={x} cy={y} r={isTargeted ? 14 : 12} fill={ann.color} stroke="#FFFFFF" strokeWidth={isTargeted ? 2 : 1.5} />
                  <text x={x} y={y + 3.5} fill="#FFFFFF" fontSize={isTargeted ? 11 : 10} fontWeight="bold" textAnchor="middle">
                    {ann.sequence}
                  </text>
                </g>
              );
            }
            if (ann.type === 'highlight') {
              return (
                <g 
                  key={ann.id} 
                  className={interactive ? 'pointer-events-auto cursor-pointer group/marker' : ''}
                  onMouseEnter={handleEnter}
                  onMouseLeave={handleLeave}
                  onClick={handleClick}
                  filter={isTargeted ? 'url(#ov-glow)' : undefined}
                >
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    stroke={ann.color}
                    strokeWidth={isTargeted ? strokeVal + 2 : strokeVal}
                    fill={ann.color}
                    fillOpacity={isTargeted ? 0.45 : 0.35}
                  />
                  {isTargeted && (
                    <circle cx={x} cy={y} r={18} fill="none" stroke="#FFFFFF" strokeWidth={2.5} opacity={0.9} className="animate-ping origin-center" />
                  )}
                  <circle cx={x} cy={y} r={isTargeted ? 14 : 12} fill={ann.color} stroke="#FFFFFF" strokeWidth={isTargeted ? 2 : 1.5} />
                  <text x={x} y={y + 3.5} fill="#FFFFFF" fontSize={isTargeted ? 11 : 10} fontWeight="bold" textAnchor="middle">
                    {ann.sequence}
                  </text>
                </g>
              );
            }
            if (ann.type === 'arrow' || ann.type === 'line') {
              return (
                <g 
                  key={ann.id} 
                  className={interactive ? 'pointer-events-auto cursor-pointer group/marker' : ''}
                  onMouseEnter={handleEnter}
                  onMouseLeave={handleLeave}
                  onClick={handleClick}
                  filter={isTargeted ? 'url(#ov-glow)' : undefined}
                >
                  <line
                    x1={x}
                    y1={y}
                    x2={(ann.x2 !== undefined ? ann.x2 : ann.x) * 1000}
                    y2={(ann.y2 !== undefined ? ann.y2 : ann.y) * 1000}
                    stroke={ann.color}
                    strokeWidth={isTargeted ? strokeVal + 2 : strokeVal}
                    markerEnd={ann.type === 'arrow' ? `url(#${markerId})` : undefined}
                  />
                  {isTargeted && (
                    <circle cx={x} cy={y} r={18} fill="none" stroke="#FFFFFF" strokeWidth={2.5} opacity={0.9} className="animate-ping origin-center" />
                  )}
                  <circle cx={x} cy={y} r={isTargeted ? 14 : 12} fill={ann.color} stroke="#FFFFFF" strokeWidth={isTargeted ? 2 : 1.5} />
                  <text x={x} y={y + 3.5} fill="#FFFFFF" fontSize={isTargeted ? 11 : 10} fontWeight="bold" textAnchor="middle">
                    {ann.sequence}
                  </text>
                </g>
              );
            }
            if (ann.type === 'badge') {
              return (
                <g 
                  key={ann.id} 
                  transform={`translate(${x}, ${y})`}
                  className={interactive ? 'pointer-events-auto cursor-pointer group/marker' : ''}
                  onMouseEnter={handleEnter}
                  onMouseLeave={handleLeave}
                  onClick={handleClick}
                  filter={isTargeted ? 'url(#ov-glow)' : undefined}
                >
                  {isTargeted && (
                    <circle cx={0} cy={0} r={22} fill="none" stroke="#FFFFFF" strokeWidth={2.5} opacity={0.9} className="animate-ping origin-center" />
                  )}
                  <circle cx={0} cy={0} r={isTargeted ? 18 : 16} fill={ann.color} stroke="#FFFFFF" strokeWidth={isTargeted ? 2.5 : 2} />
                  <text x={0} y={4.5} fill="#FFFFFF" fontSize={isTargeted ? 14 : 13} fontWeight="bold" textAnchor="middle">
                    {ann.sequence}
                  </text>
                </g>
              );
            }
            if (ann.type === 'text') {
              return (
                <g 
                  key={ann.id} 
                  transform={`translate(${x}, ${y})`}
                  className={interactive ? 'pointer-events-auto cursor-pointer group/marker' : ''}
                  onMouseEnter={handleEnter}
                  onMouseLeave={handleLeave}
                  onClick={handleClick}
                  filter={isTargeted ? 'url(#ov-glow)' : undefined}
                >
                  <rect
                    x={0}
                    y={0}
                    width={Math.max(w, 120)}
                    height={Math.max(h, 28)}
                    fill="rgba(15, 23, 42, 0.85)"
                    stroke={ann.color}
                    strokeWidth={isTargeted ? 2 : 1.5}
                    rx={4}
                  />
                  <text x={6} y={18} fill="#FFFFFF" fontSize={11} fontWeight="600">
                    {ann.note || ann.title || 'Ghi chú'}
                  </text>
                  <circle cx={-2} cy={-2} r={10} fill={ann.color} stroke="#FFFFFF" strokeWidth={1.5} />
                  <text x={-2} y={1.5} fill="#FFFFFF" fontSize={9} fontWeight="bold" textAnchor="middle">
                    {ann.sequence}
                  </text>
                </g>
              );
            }
            return null;
          })}
        </svg>
      )}

      {/* Floating Hover Note Tooltip */}
      {interactive && isVisible && activeTooltipAnn && (
        <div
          className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-full mb-3 px-3.5 py-2.5 rounded-2xl bg-slate-950/95 text-white border border-white/20 shadow-2xl backdrop-blur-md max-w-sm animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: `${Math.min(Math.max((activeTooltipAnn.x + (activeTooltipAnn.width ? activeTooltipAnn.width / 2 : 0)) * 100, 15), 85)}%`,
            top: `${Math.max(activeTooltipAnn.y * 100, 10)}%`
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center text-white shrink-0 shadow-sm"
              style={{ backgroundColor: activeTooltipAnn.color }}
            >
              {activeTooltipAnn.sequence}
            </span>
            <span className="text-xs font-bold text-slate-100 truncate">
              {getAnnotationTypeName(activeTooltipAnn.type)} #{activeTooltipAnn.sequence}
            </span>
            <span 
              className="ml-auto text-[9px] font-semibold px-1.5 py-0.2 rounded-full"
              style={{ 
                backgroundColor: `${activeTooltipAnn.color}25`, 
                color: activeTooltipAnn.color,
                border: `1px solid ${activeTooltipAnn.color}50`
              }}
            >
              {activeTooltipAnn.status === 'resolved' ? 'Đã fix' : activeTooltipAnn.status === 'fixing' ? 'Đang fix' : 'Chưa fix'}
            </span>
          </div>
          <p className="text-xs text-slate-200 font-medium leading-relaxed break-words whitespace-pre-wrap pl-7">
            {activeTooltipAnn.note || <span className="italic text-slate-400">Chưa có ghi chú mô tả</span>}
          </p>
        </div>
      )}

      {/* Layer Toggle Badge on hover / always visible on mobile touch */}
      {showToggle && annotations.length > 0 && (
        <div
          className="absolute top-1.5 right-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition flex items-center gap-1 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setIsVisible(!isVisible)}
            className="p-1 rounded-md bg-black/70 hover:bg-black/90 text-white text-[10px] flex items-center gap-1 shadow-md backdrop-blur"
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
