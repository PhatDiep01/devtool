import React, { useRef, useState, useEffect, useCallback } from 'react';
import { AnnotationItem, AnnotationType, NormalizedPoint } from '../../../../types';
import { clamp01, clamp, clampSegmentDelta } from './mathUtils';
import { Trash2, X } from 'lucide-react';

interface AnnotationCanvasProps {
  imageSrc: string;
  imageAlt?: string;
  annotations: AnnotationItem[];
  selectedId: string | null;
  activeTool: AnnotationType | 'select';
  activeColor: string;
  strokeWidth: number;
  fontSize: number;
  zoom: number;
  pan: { x: number; y: number };
  onSelect: (id: string | null) => void;
  onAddAnnotation: (item: Omit<AnnotationItem, 'id' | 'sequence' | 'created_at' | 'updated_at'>) => void;
  onUpdateAnnotation: (id: string, updates: Partial<AnnotationItem>, recordHistory?: boolean) => void;
  onDeleteAnnotation: (id: string) => void;
  onPanChange: (pan: { x: number; y: number }) => void;
  onZoomChange?: (zoom: number) => void;
}

type DragMode = 
  | { type: 'none' }
  | { type: 'draw'; start: NormalizedPoint; current: NormalizedPoint }
  | { type: 'move'; id: string; startPoint: NormalizedPoint; originalItem: AnnotationItem }
  | { type: 'resize'; id: string; handle: string; startPoint: NormalizedPoint; originalItem: AnnotationItem }
  | { type: 'pan'; startScreen: { x: number; y: number }; startPan: { x: number; y: number } };

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({
  imageSrc,
  imageAlt = 'Bug Screenshot',
  annotations,
  selectedId,
  activeTool,
  activeColor,
  strokeWidth,
  fontSize,
  zoom,
  pan,
  onSelect,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onPanChange,
  onZoomChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [dragState, setDragState] = useState<DragMode>({ type: 'none' });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Track space key for pan navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const getNormalizedPointFromEvent = useCallback((e: React.MouseEvent | MouseEvent): NormalizedPoint | null => {
    if (!imageRef.current) return null;
    const rect = imageRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = clamp01((e.clientX - rect.left) / rect.width);
    const y = clamp01((e.clientY - rect.top) / rect.height);
    return { x, y };
  }, []);

  // Mouse down handler
  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle click or Space+Click initiates Pan
    if (e.button === 1 || isSpacePressed) {
      e.preventDefault();
      setDragState({
        type: 'pan',
        startScreen: { x: e.clientX, y: e.clientY },
        startPan: { ...pan }
      });
      return;
    }

    if (e.button !== 0) return; // Only primary button
    const point = getNormalizedPointFromEvent(e);
    if (!point) return;

    if (activeTool === 'badge') {
      // Direct placement of number badge
      onAddAnnotation({
        type: 'badge',
        x: point.x,
        y: point.y,
        color: activeColor,
        strokeWidth,
        note: `Điểm đánh dấu #${annotations.length + 1}`,
        status: 'open'
      });
      return;
    }

    if (activeTool === 'text') {
      // Direct placement of text note box
      onAddAnnotation({
        type: 'text',
        x: point.x,
        y: point.y,
        width: 0.18,
        height: 0.05,
        color: activeColor,
        strokeWidth,
        fontSize,
        note: 'Ghi chú...',
        status: 'open'
      });
      return;
    }

    if (activeTool === 'select') {
      // Clicked on empty area -> deselect
      onSelect(null);
      return;
    }

    // Begin drawing new shape
    setDragState({
      type: 'draw',
      start: point,
      current: point
    });
  };

  // Global mouse move & up listeners for smooth dragging outside image
  useEffect(() => {
    if (dragState.type === 'none') return;

    const handleMouseMove = (e: MouseEvent) => {
      if (dragState.type === 'pan') {
        const dx = e.clientX - dragState.startScreen.x;
        const dy = e.clientY - dragState.startScreen.y;
        onPanChange({
          x: dragState.startPan.x + dx,
          y: dragState.startPan.y + dy
        });
        return;
      }

      const point = getNormalizedPointFromEvent(e);
      if (!point) return;

      if (dragState.type === 'draw') {
        setDragState({
          ...dragState,
          current: point
        });
      } else if (dragState.type === 'move') {
        const dx = point.x - dragState.startPoint.x;
        const dy = point.y - dragState.startPoint.y;
        const orig = dragState.originalItem;

        if (orig.type === 'arrow' || orig.type === 'line') {
          const origX2 = orig.x2 !== undefined ? orig.x2 : orig.x;
          const origY2 = orig.y2 !== undefined ? orig.y2 : orig.y;
          const clamped = clampSegmentDelta(dx, dy, orig.x, orig.y, origX2, origY2);
          onUpdateAnnotation(orig.id, {
            x: orig.x + clamped.dx,
            y: orig.y + clamped.dy,
            x2: origX2 + clamped.dx,
            y2: origY2 + clamped.dy,
          }, false);
        } else {
          const w = orig.width || 0.05;
          const h = orig.height || 0.05;
          const newX = clamp(orig.x + dx, 0, 1 - w);
          const newY = clamp(orig.y + dy, 0, 1 - h);
          onUpdateAnnotation(orig.id, { x: newX, y: newY }, false);
        }
      } else if (dragState.type === 'resize') {
        const orig = dragState.originalItem;
        const dx = point.x - dragState.startPoint.x;
        const dy = point.y - dragState.startPoint.y;
        const handle = dragState.handle;

        if (orig.type === 'arrow' || orig.type === 'line') {
          if (handle === 'start') {
            onUpdateAnnotation(orig.id, { x: point.x, y: point.y }, false);
          } else if (handle === 'end') {
            onUpdateAnnotation(orig.id, { x2: point.x, y2: point.y }, false);
          }
        } else {
          let x = orig.x;
          let y = orig.y;
          const origW = orig.width || 0.05;
          const origH = orig.height || 0.05;
          let w = origW;
          let h = origH;

          if (handle.includes('e')) w = clamp(origW + dx, 0.01, 1 - x);
          if (handle.includes('s')) h = clamp(origH + dy, 0.01, 1 - y);
          if (handle.includes('w')) {
            const nextX = clamp(orig.x + dx, 0, orig.x + origW - 0.01);
            w = orig.x + origW - nextX;
            x = nextX;
          }
          if (handle.includes('n')) {
            const nextY = clamp(orig.y + dy, 0, orig.y + origH - 0.01);
            h = orig.y + origH - nextY;
            y = nextY;
          }

          onUpdateAnnotation(orig.id, { x, y, width: w, height: h }, false);
        }
      }
    };

    const handleMouseUp = () => {
      if (dragState.type === 'draw') {
        const { start, current } = dragState;
        const dist = Math.hypot(current.x - start.x, current.y - start.y);

        if (dist > 0.01 || activeTool === 'badge') {
          const x1 = Math.min(start.x, current.x);
          const y1 = Math.min(start.y, current.y);
          const w = Math.abs(current.x - start.x);
          const h = Math.abs(current.y - start.y);

          if (activeTool === 'rect' || activeTool === 'circle' || activeTool === 'highlight') {
            onAddAnnotation({
              type: activeTool,
              x: x1,
              y: y1,
              width: Math.max(0.02, w),
              height: Math.max(0.02, h),
              color: activeColor,
              strokeWidth,
              fillOpacity: activeTool === 'highlight' ? 0.35 : 0.1,
              note: '',
              status: 'open'
            });
          } else if (activeTool === 'arrow' || activeTool === 'line') {
            onAddAnnotation({
              type: activeTool,
              x: start.x,
              y: start.y,
              x2: current.x,
              y2: current.y,
              color: activeColor,
              strokeWidth,
              note: '',
              status: 'open'
            });
          } else if (activeTool === 'text') {
            onAddAnnotation({
              type: 'text',
              x: x1,
              y: y1,
              width: Math.max(0.1, w),
              height: Math.max(0.04, h),
              color: activeColor,
              strokeWidth,
              fontSize,
              note: 'Nhập ghi chú tại đây...',
              status: 'open'
            });
          }
        }
      } else if (dragState.type === 'move' || dragState.type === 'resize') {
        // Record final position into undo stack
        onUpdateAnnotation(dragState.id, {}, true);
      }

      setDragState({ type: 'none' });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, activeTool, activeColor, strokeWidth, fontSize, annotations.length, getNormalizedPointFromEvent, onAddAnnotation, onUpdateAnnotation, onPanChange]);

  const selectedItem = annotations.find((a) => a.id === selectedId);

  // Compute draft shape while drawing
  const renderDrawingDraft = () => {
    if (dragState.type !== 'draw') return null;
    const { start, current } = dragState;
    const x1 = Math.min(start.x, current.x) * 1000;
    const y1 = Math.min(start.y, current.y) * 1000;
    const w = Math.abs(current.x - start.x) * 1000;
    const h = Math.abs(current.y - start.y) * 1000;

    if (activeTool === 'rect' || activeTool === 'highlight') {
      return (
        <rect
          x={x1}
          y={y1}
          width={w}
          height={h}
          stroke={activeColor}
          strokeWidth={strokeWidth * 1.5}
          strokeDasharray="4 4"
          fill={activeTool === 'highlight' ? activeColor : 'none'}
          fillOpacity={activeTool === 'highlight' ? 0.35 : 0.1}
        />
      );
    }
    if (activeTool === 'circle') {
      return (
        <ellipse
          cx={x1 + w / 2}
          cy={y1 + h / 2}
          rx={w / 2}
          ry={h / 2}
          stroke={activeColor}
          strokeWidth={strokeWidth * 1.5}
          strokeDasharray="4 4"
          fill="none"
        />
      );
    }
    if (activeTool === 'arrow' || activeTool === 'line') {
      return (
        <line
          x1={start.x * 1000}
          y1={start.y * 1000}
          x2={current.x * 1000}
          y2={current.y * 1000}
          stroke={activeColor}
          strokeWidth={strokeWidth * 1.5}
          strokeDasharray="4 4"
        />
      );
    }
    if (activeTool === 'text') {
      return (
        <rect
          x={x1}
          y={y1}
          width={w}
          height={h}
          stroke={activeColor}
          strokeWidth={1.5}
          strokeDasharray="3 3"
          fill="rgba(15, 23, 42, 0.4)"
        />
      );
    }
    return null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!onZoomChange) return;
    if (e.deltaY < 0) {
      onZoomChange(Math.min(4.0, Number((zoom + 0.25).toFixed(2))));
    } else if (e.deltaY > 0) {
      onZoomChange(Math.max(0.25, Number((zoom - 0.25).toFixed(2))));
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden flex items-center justify-center select-none bg-slate-950/80 ${
        isSpacePressed || dragState.type === 'pan' ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      style={{ touchAction: 'none' }}
    >
      {/* Zoomable & Pannable Workspace */}
      <div
        className="transition-transform duration-75 will-change-transform flex items-center justify-center pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
        }}
      >
        <div className="relative inline-block leading-[0] shadow-2xl rounded-lg border border-border/40 bg-slate-900 pointer-events-auto">
          {/* Underlying Image */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt={imageAlt}
            onLoad={(e) => {
              const img = e.currentTarget;
              setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
            }}
            className="block max-h-[75vh] max-w-[75vw] w-auto h-auto object-contain rounded-lg select-none"
            draggable={false}
          />

          {/* Scalable SVG Vector Overlay: viewBox="0 0 1000 1000" */}
          <svg
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          >
          <defs>
            {/* Custom arrow marker for each color */}
            {['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#A855F7', '#EC4899', '#FFFFFF', '#0F172A'].map((col) => (
              <marker
                key={col}
                id={`arrowhead-${col.replace('#', '')}`}
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

          {/* Render All Committed Annotations */}
          {annotations.map((ann) => {
            const isSelected = ann.id === selectedId;
            const x = ann.x * 1000;
            const y = ann.y * 1000;
            const w = (ann.width || 0) * 1000;
            const h = (ann.height || 0) * 1000;
            const strokeVal = (ann.strokeWidth || 3) * 1.5;
            const markerId = `arrowhead-${(ann.color || '#EF4444').replace('#', '')}`;

            return (
              <g
                key={ann.id}
                className="cursor-pointer pointer-events-auto transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(ann.id);
                }}
                onMouseDown={(e) => {
                  if (activeTool === 'select' || isSelected) {
                    e.stopPropagation();
                    const point = getNormalizedPointFromEvent(e);
                    if (point) {
                      onSelect(ann.id);
                      setDragState({
                        type: 'move',
                        id: ann.id,
                        startPoint: point,
                        originalItem: { ...ann }
                      });
                    }
                  }
                }}
              >
                {/* Rect */}
                {ann.type === 'rect' && (
                  <>
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
                    {/* Sequence Badge Tag on Top Left */}
                    <g transform={`translate(${x}, ${y})`}>
                      <circle cx={-2} cy={-2} r={14} fill={ann.color} stroke="#FFFFFF" strokeWidth={2} />
                      <text
                        x={-2}
                        y={2}
                        fill="#FFFFFF"
                        fontSize={12}
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {ann.sequence}
                      </text>
                    </g>
                  </>
                )}

                {/* Circle */}
                {ann.type === 'circle' && (
                  <>
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
                    <g transform={`translate(${x}, ${y})`}>
                      <circle cx={-2} cy={-2} r={14} fill={ann.color} stroke="#FFFFFF" strokeWidth={2} />
                      <text
                        x={-2}
                        y={2}
                        fill="#FFFFFF"
                        fontSize={12}
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {ann.sequence}
                      </text>
                    </g>
                  </>
                )}

                {/* Highlight */}
                {ann.type === 'highlight' && (
                  <>
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
                    <g transform={`translate(${x}, ${y})`}>
                      <circle cx={-2} cy={-2} r={14} fill={ann.color} stroke="#FFFFFF" strokeWidth={2} />
                      <text x={-2} y={2} fill="#FFFFFF" fontSize={12} fontWeight="bold" textAnchor="middle">
                        {ann.sequence}
                      </text>
                    </g>
                  </>
                )}

                {/* Arrow */}
                {ann.type === 'arrow' && (
                  <>
                    <line
                      x1={x}
                      y1={y}
                      x2={(ann.x2 !== undefined ? ann.x2 : ann.x) * 1000}
                      y2={(ann.y2 !== undefined ? ann.y2 : ann.y) * 1000}
                      stroke={ann.color}
                      strokeWidth={strokeVal}
                      markerEnd={`url(#${markerId})`}
                    />
                    <g transform={`translate(${x}, ${y})`}>
                      <circle cx={0} cy={0} r={14} fill={ann.color} stroke="#FFFFFF" strokeWidth={2} />
                      <text x={0} y={4} fill="#FFFFFF" fontSize={12} fontWeight="bold" textAnchor="middle">
                        {ann.sequence}
                      </text>
                    </g>
                  </>
                )}

                {/* Line */}
                {ann.type === 'line' && (
                  <>
                    <line
                      x1={x}
                      y1={y}
                      x2={(ann.x2 !== undefined ? ann.x2 : ann.x) * 1000}
                      y2={(ann.y2 !== undefined ? ann.y2 : ann.y) * 1000}
                      stroke={ann.color}
                      strokeWidth={strokeVal}
                    />
                    <g transform={`translate(${x}, ${y})`}>
                      <circle cx={0} cy={0} r={14} fill={ann.color} stroke="#FFFFFF" strokeWidth={2} />
                      <text x={0} y={4} fill="#FFFFFF" fontSize={12} fontWeight="bold" textAnchor="middle">
                        {ann.sequence}
                      </text>
                    </g>
                  </>
                )}

                {/* Number Badge Pin */}
                {ann.type === 'badge' && (
                  <g transform={`translate(${x}, ${y})`}>
                    <circle cx={0} cy={0} r={18} fill={ann.color} stroke="#FFFFFF" strokeWidth={2.5} />
                    <text
                      x={0}
                      y={5}
                      fill="#FFFFFF"
                      fontSize={15}
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {ann.sequence}
                    </text>
                  </g>
                )}

                {/* Text Note Box */}
                {ann.type === 'text' && (
                  <g transform={`translate(${x}, ${y})`}>
                    <rect
                      x={0}
                      y={0}
                      width={Math.max(w, 140)}
                      height={Math.max(h, 36)}
                      fill="rgba(15, 23, 42, 0.88)"
                      stroke={ann.color}
                      strokeWidth={2}
                      rx={6}
                    />
                    <text
                      x={10}
                      y={22}
                      fill="#FFFFFF"
                      fontSize={14}
                      fontWeight="600"
                    >
                      {ann.note || ann.title || 'Ghi chú'}
                    </text>
                    <circle cx={-2} cy={-2} r={12} fill={ann.color} stroke="#FFFFFF" strokeWidth={2} />
                    <text x={-2} y={2} fill="#FFFFFF" fontSize={11} fontWeight="bold" textAnchor="middle">
                      {ann.sequence}
                    </text>
                  </g>
                )}

                {/* Selection Bounding Box & Resize Handles */}
                {isSelected && (
                  <g className="pointer-events-auto">
                    {/* Outline indicator */}
                    {ann.type !== 'arrow' && ann.type !== 'line' && ann.type !== 'badge' && (
                      <>
                        <rect
                          x={x - 4}
                          y={y - 4}
                          width={w + 8}
                          height={h + 8}
                          fill="none"
                          stroke="#3B82F6"
                          strokeWidth={1.5}
                          strokeDasharray="4 4"
                        />
                        {/* 8 Resize Handles */}
                        {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((handle) => {
                          let hx = x;
                          let hy = y;
                          if (handle.includes('e')) hx = x + w;
                          else if (!handle.includes('w')) hx = x + w / 2;
                          if (handle.includes('s')) hy = y + h;
                          else if (!handle.includes('n')) hy = y + h / 2;

                          return (
                            <rect
                              key={handle}
                              x={hx - 5}
                              y={hy - 5}
                              width={10}
                              height={10}
                              fill="#FFFFFF"
                              stroke="#3B82F6"
                              strokeWidth={2}
                              className={`cursor-${handle}-resize`}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                const point = getNormalizedPointFromEvent(e);
                                if (point) {
                                  setDragState({
                                    type: 'resize',
                                    id: ann.id,
                                    handle,
                                    startPoint: point,
                                    originalItem: { ...ann }
                                  });
                                }
                              }}
                            />
                          );
                        })}
                      </>
                    )}

                    {/* Arrow / Line Control Endpoints */}
                    {(ann.type === 'arrow' || ann.type === 'line') && (
                      <>
                        <circle
                          cx={x}
                          cy={y}
                          r={6}
                          fill="#FFFFFF"
                          stroke="#3B82F6"
                          strokeWidth={2}
                          className="cursor-move"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            const point = getNormalizedPointFromEvent(e);
                            if (point) {
                              setDragState({
                                type: 'resize',
                                id: ann.id,
                                handle: 'start',
                                startPoint: point,
                                originalItem: { ...ann }
                              });
                            }
                          }}
                        />
                        <circle
                          cx={(ann.x2 !== undefined ? ann.x2 : ann.x) * 1000}
                          cy={(ann.y2 !== undefined ? ann.y2 : ann.y) * 1000}
                          r={6}
                          fill="#FFFFFF"
                          stroke="#3B82F6"
                          strokeWidth={2}
                          className="cursor-move"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            const point = getNormalizedPointFromEvent(e);
                            if (point) {
                              setDragState({
                                type: 'resize',
                                id: ann.id,
                                handle: 'end',
                                startPoint: point,
                                originalItem: { ...ann }
                              });
                            }
                          }}
                        />
                      </>
                    )}
                  </g>
                )}
              </g>
            );
          })}

          {/* Active Drawing Draft */}
          {renderDrawingDraft()}
        </svg>

        {/* Floating Quick-Edit Panel ("Bảng chỉnh nhanh nổi") */}
        {selectedItem && (
          <div
            className="absolute z-30 pointer-events-auto leading-normal bg-card/95 backdrop-blur-md border border-primary/50 shadow-2xl rounded-2xl p-2 flex items-center gap-2 text-foreground text-xs animate-in fade-in zoom-in-95 duration-150"
            style={{
              top: `${Math.max(8, Math.min(92, (selectedItem.y || 0) * 100 - 6))}%`,
              left: `${Math.max(10, Math.min(80, (selectedItem.x || 0) * 100))}%`,
              transform: 'translate(-10%, -100%)',
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Sequence Badge */}
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[11px] shrink-0 shadow-xs"
              style={{ backgroundColor: selectedItem.color || '#EF4444' }}
            >
              #{selectedItem.sequence}
            </span>

            {/* Status Selector */}
            <select
              value={selectedItem.status}
              onChange={(e) => onUpdateAnnotation(selectedItem.id, { status: e.target.value as any })}
              className="text-[11px] font-bold px-2 py-1 rounded-lg border border-border/80 bg-background text-foreground cursor-pointer focus:outline-none"
            >
              <option value="open">🔴 Chưa fix</option>
              <option value="fixing">🔵 Đang fix</option>
              <option value="resolved">🟢 Đã fix</option>
            </select>

            {/* Color dots */}
            <div className="flex items-center gap-1 border-x border-border/60 px-1.5">
              {['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#A855F7'].map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => onUpdateAnnotation(selectedItem.id, { color: col })}
                  className={`w-3.5 h-3.5 rounded-full border border-white/20 transition ${
                    selectedItem.color === col ? 'scale-125 ring-2 ring-primary ring-offset-1' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>

            {/* Quick Note Input */}
            <input
              type="text"
              value={selectedItem.note || ''}
              onChange={(e) => onUpdateAnnotation(selectedItem.id, { note: e.target.value }, false)}
              placeholder="Ghi chú nhanh..."
              className="w-36 text-xs px-2 py-1 rounded-lg border border-border/80 bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
            />

            {/* Delete button */}
            <button
              type="button"
              onClick={() => onDeleteAnnotation(selectedItem.id)}
              className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition"
              title="Xóa điểm đánh dấu"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {/* Close selection */}
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
              title="Bỏ chọn"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
