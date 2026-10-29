import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { AnnotationItem, AnnotationType, NormalizedPoint } from '../../../../types';
import { clamp01, clamp, clampSegmentDelta } from './mathUtils';
import { Trash2, X } from 'lucide-react';

export interface AnnotationCanvasHandle {
  fitToScreen: () => void;
}

export interface AnnotationCanvasProps {
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

export const AnnotationCanvas = forwardRef<AnnotationCanvasHandle, AnnotationCanvasProps>(({
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
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [dragState, setDragState] = useState<DragMode>({ type: 'none' });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Multi-touch tracking for 2-finger pinch-to-zoom & pan
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    initialDist: number;
    initialMid: { x: number; y: number };
    initialZoom: number;
    initialPan: { x: number; y: number };
  } | null>(null);

  // Track space key for desktop pan navigation
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

  // Dynamic fitToScreen calculation: zoom = min(containerW / naturalW, containerH / naturalH, 1.0)
  const fitToScreen = useCallback(() => {
    if (!containerRef.current || !naturalSize.width || !naturalSize.height) {
      if (onZoomChange) onZoomChange(1.0);
      onPanChange({ x: 0, y: 0 });
      return;
    }
    const padding = window.innerWidth < 768 ? 16 : 40;
    const containerW = Math.max(100, containerRef.current.clientWidth - padding);
    const containerH = Math.max(100, containerRef.current.clientHeight - padding);
    const scaleW = containerW / naturalSize.width;
    const scaleH = containerH / naturalSize.height;
    const fitZoom = Math.min(scaleW, scaleH, 1.0);
    const safeZoom = Math.max(0.02, Number(fitZoom.toFixed(3)));
    if (onZoomChange) onZoomChange(safeZoom);
    onPanChange({ x: 0, y: 0 });
  }, [naturalSize, onZoomChange, onPanChange]);

  useImperativeHandle(ref, () => ({
    fitToScreen,
  }), [fitToScreen]);

  // Orientation change and window resize listener: auto re-fit
  useEffect(() => {
    const handleResize = () => {
      if (naturalSize.width > 0 && naturalSize.height > 0) {
        fitToScreen();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fitToScreen, naturalSize]);

  // Image load handler: detect natural dimensions and initial fit
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    setNaturalSize({ width: natW, height: natH });

    if (containerRef.current && natW > 0 && natH > 0) {
      const padding = window.innerWidth < 768 ? 16 : 40;
      const containerW = Math.max(100, containerRef.current.clientWidth - padding);
      const containerH = Math.max(100, containerRef.current.clientHeight - padding);
      const fitZoom = Math.min(containerW / natW, containerH / natH, 1.0);
      const safeZoom = Math.max(0.02, Number(fitZoom.toFixed(3)));
      if (onZoomChange) onZoomChange(safeZoom);
      onPanChange({ x: 0, y: 0 });
    }
  };

  // Cached image check when imageSrc changes
  useEffect(() => {
    if (imageRef.current?.complete && imageRef.current.naturalWidth > 0) {
      const natW = imageRef.current.naturalWidth;
      const natH = imageRef.current.naturalHeight;
      setNaturalSize({ width: natW, height: natH });
      if (containerRef.current) {
        const padding = window.innerWidth < 768 ? 16 : 40;
        const containerW = Math.max(100, containerRef.current.clientWidth - padding);
        const containerH = Math.max(100, containerRef.current.clientHeight - padding);
        const fitZoom = Math.min(containerW / natW, containerH / natH, 1.0);
        const safeZoom = Math.max(0.02, Number(fitZoom.toFixed(3)));
        if (onZoomChange) onZoomChange(safeZoom);
        onPanChange({ x: 0, y: 0 });
      }
    }
  }, [imageSrc, onZoomChange, onPanChange]);

  const getNormalizedPointFromEvent = useCallback((e: { clientX: number; clientY: number }): NormalizedPoint | null => {
    if (!imageRef.current) return null;
    const rect = imageRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = clamp01((e.clientX - rect.left) / rect.width);
    const y = clamp01((e.clientY - rect.top) / rect.height);
    return { x, y };
  }, []);

  // Capture pointerdown at top container before child stopPropagation
  const handlePointerDownCapture = (e: React.PointerEvent) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // 2-Finger Pinch Start Check
    if (activePointers.current.size >= 2) {
      const pts = Array.from(activePointers.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      pinchRef.current = {
        initialDist: Math.max(dist, 1),
        initialMid: mid,
        initialZoom: zoom,
        initialPan: { ...pan },
      };
      setDragState({ type: 'none' });
    }
  };

  // Pointer Down Handler
  const handlePointerDown = (e: React.PointerEvent) => {
    // If multi-touch gesture is active, do not initiate drawing
    if (activePointers.current.size >= 2 || pinchRef.current) {
      return;
    }

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

    if (e.button !== 0 && e.pointerType === 'mouse') return; // Only primary button for mouse
    const point = getNormalizedPointFromEvent(e);
    if (!point) return;

    if (activeTool === 'select') {
      onSelect(null);
      return;
    }

    // Begin drawing new shape (including badge & text - committed on pointerup if not a pinch)
    setDragState({
      type: 'draw',
      start: point,
      current: point
    });
  };

  // Window pointermove, pointerup, pointercancel listeners
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (activePointers.current.has(e.pointerId)) {
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // Handle 2-finger pinch-to-zoom and pan
      // Handle 2-finger pinch-to-zoom and pan with focal-point invariance
      if (activePointers.current.size >= 2 && pinchRef.current) {
        const pts = Array.from(activePointers.current.values());
        const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const currentMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        const scale = currentDist / pinchRef.current.initialDist;
        const targetZoom = Math.min(4.0, Math.max(0.02, Number((pinchRef.current.initialZoom * scale).toFixed(3))));
        
        const cRect = containerRef.current?.getBoundingClientRect();
        const cx = cRect ? cRect.left + cRect.width / 2 : window.innerWidth / 2;
        const cy = cRect ? cRect.top + cRect.height / 2 : window.innerHeight / 2;

        const zoomRatio = targetZoom / pinchRef.current.initialZoom;
        const dx = currentMid.x - pinchRef.current.initialMid.x;
        const dy = currentMid.y - pinchRef.current.initialMid.y;
        const focalDx = (pinchRef.current.initialMid.x - cx) * (zoomRatio - 1);
        const focalDy = (pinchRef.current.initialMid.y - cy) * (zoomRatio - 1);

        onZoomChange?.(targetZoom);
        onPanChange({
          x: pinchRef.current.initialPan.x + dx - focalDx,
          y: pinchRef.current.initialPan.y + dy - focalDy,
        });
        return;
      }

      // Handle single pointer drag (Pan, Draw, Move, Resize)
      if (dragState.type === 'pan') {
        const dx = e.clientX - dragState.startScreen.x;
        const dy = e.clientY - dragState.startScreen.y;
        onPanChange({
          x: dragState.startPan.x + dx,
          y: dragState.startPan.y + dy
        });
        return;
      }

      if (dragState.type === 'none') return;
      const point = getNormalizedPointFromEvent(e);
      if (!point) return;

      if (dragState.type === 'draw') {
        setDragState((prev) => prev.type === 'draw' ? { ...prev, current: point } : prev);
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

    const handleGlobalPointerUp = (e: PointerEvent) => {
      activePointers.current.delete(e.pointerId);

      const wasPinching = pinchRef.current !== null;
      if (activePointers.current.size < 2) {
        pinchRef.current = null;
      }

      if (activePointers.current.size === 0) {
        if (!wasPinching && e.type !== 'pointercancel' && dragState.type === 'draw') {
          const { start, current } = dragState;
          const dist = Math.hypot(current.x - start.x, current.y - start.y);

          if (activeTool === 'badge') {
            onAddAnnotation({
              type: 'badge',
              x: start.x,
              y: start.y,
              color: activeColor,
              strokeWidth,
              note: `Điểm đánh dấu #${annotations.length + 1}`,
              status: 'open'
            });
          } else if (activeTool === 'text') {
            const x1 = Math.min(start.x, current.x);
            const y1 = Math.min(start.y, current.y);
            const w = Math.abs(current.x - start.x);
            const h = Math.abs(current.y - start.y);
            onAddAnnotation({
              type: 'text',
              x: x1,
              y: y1,
              width: Math.max(0.18, w),
              height: Math.max(0.05, h),
              color: activeColor,
              strokeWidth,
              fontSize,
              note: 'Nhập ghi chú tại đây...',
              status: 'open'
            });
          } else if (dist > 0.01) {
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
            }
          }
        } else if (dragState.type === 'move' || dragState.type === 'resize') {
          onUpdateAnnotation(dragState.id, {}, true);
        }

        setDragState({ type: 'none' });
      }
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [dragState, activeTool, activeColor, strokeWidth, fontSize, annotations.length, getNormalizedPointFromEvent, onAddAnnotation, onUpdateAnnotation, onPanChange, onZoomChange]);

  const selectedItem = annotations.find((a) => a.id === selectedId);

  // Calculate unscaled screen coordinates for the Quick-Edit panel
  const getQuickPanelStyle = (): React.CSSProperties => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return {
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '96vw',
        width: 'max-content',
      };
    }

    if (!containerRef.current || !imageRef.current || !selectedItem) {
      return { top: '16px', left: '50%', transform: 'translateX(-50%)' };
    }

    const cRect = containerRef.current.getBoundingClientRect();
    const iRect = imageRef.current.getBoundingClientRect();
    const screenX = iRect.left - cRect.left + (selectedItem.x || 0) * iRect.width;
    const screenY = iRect.top - cRect.top + (selectedItem.y || 0) * iRect.height;

    const panelW = 340;
    const clampedX = Math.max(12, Math.min(cRect.width - panelW - 12, screenX - 20));
    const clampedY = screenY > 60 ? screenY - 50 : Math.min(cRect.height - 50, screenY + 40);

    return {
      top: `${clampedY}px`,
      left: `${clampedX}px`,
    };
  };

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
      onPointerDownCapture={handlePointerDownCapture}
      onPointerDown={handlePointerDown}
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
            onLoad={handleImageLoad}
            style={{
              width: naturalSize.width ? `${naturalSize.width}px` : undefined,
              height: naturalSize.height ? `${naturalSize.height}px` : undefined,
            }}
            className={`block select-none rounded-lg ${naturalSize.width ? 'max-w-none max-h-none' : 'max-h-[85vh] max-w-[85vw]'}`}
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
            {(() => {
              const renderedWidth = naturalSize.width > 0 && zoom > 0 ? naturalSize.width * zoom : 0;
              const vbScale = renderedWidth > 0 ? 1000 / renderedWidth : 1;
              const touchHitSize = Math.max(44, 44 * vbScale);
              const halfHit = touchHitSize / 2;
              const handleVisSize = Math.max(10, 10 * vbScale);
              const endpointHitR = Math.max(24, 24 * vbScale);

              return annotations.map((ann) => {
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
                    onPointerDown={(e) => {
                      if (activePointers.current.size >= 2) return;
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
                        {/* Generous touch target line */}
                        <line
                          x1={x}
                          y1={y}
                          x2={(ann.x2 !== undefined ? ann.x2 : ann.x) * 1000}
                          y2={(ann.y2 !== undefined ? ann.y2 : ann.y) * 1000}
                          stroke="transparent"
                          strokeWidth={Math.max(strokeVal, 28)}
                        />
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
                        {/* Generous touch target line */}
                        <line
                          x1={x}
                          y1={y}
                          x2={(ann.x2 !== undefined ? ann.x2 : ann.x) * 1000}
                          y2={(ann.y2 !== undefined ? ann.y2 : ann.y) * 1000}
                          stroke="transparent"
                          strokeWidth={Math.max(strokeVal, 28)}
                        />
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
                        {/* Hit-area circle for touch */}
                        <circle cx={0} cy={0} r={Math.max(24, 24 * vbScale)} fill="transparent" />
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

                    {/* Selection Bounding Box & Scaled Touch Target Resize Handles (>= 44px) */}
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
                            {/* 8 Resize Handles with at least 44px hit-target */}
                            {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((handle) => {
                              let hx = x;
                              let hy = y;
                              if (handle.includes('e')) hx = x + w;
                              else if (!handle.includes('w')) hx = x + w / 2;
                              if (handle.includes('s')) hy = y + h;
                              else if (!handle.includes('n')) hy = y + h / 2;

                              return (
                                <g key={handle} className="pointer-events-auto">
                                  {/* Invisible >= 44px touch hit-target for fingers */}
                                  <rect
                                    x={hx - halfHit}
                                    y={hy - halfHit}
                                    width={touchHitSize}
                                    height={touchHitSize}
                                    fill="transparent"
                                    className={`cursor-${handle}-resize`}
                                    onPointerDown={(e) => {
                                      if (activePointers.current.size >= 2) return;
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
                                  {/* Visible handle square */}
                                  <rect
                                    x={hx - handleVisSize / 2}
                                    y={hy - handleVisSize / 2}
                                    width={handleVisSize}
                                    height={handleVisSize}
                                    rx={2}
                                    fill="#FFFFFF"
                                    stroke="#3B82F6"
                                    strokeWidth={Math.max(2, 2 * vbScale)}
                                    className="pointer-events-none shadow-sm"
                                  />
                                </g>
                              );
                            })}
                          </>
                        )}

                        {/* Arrow / Line Control Endpoints with >= 48px hit-target */}
                        {(ann.type === 'arrow' || ann.type === 'line') && (
                          <>
                            <g className="pointer-events-auto">
                              {/* Invisible touch hit-target */}
                              <circle
                                cx={x}
                                cy={y}
                                r={endpointHitR}
                                fill="transparent"
                                className="cursor-move"
                                onPointerDown={(e) => {
                                  if (activePointers.current.size >= 2) return;
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
                              {/* Visible endpoint circle */}
                              <circle
                                cx={x}
                                cy={y}
                                r={Math.max(6, 6 * vbScale)}
                                fill="#FFFFFF"
                                stroke="#3B82F6"
                                strokeWidth={Math.max(2, 2 * vbScale)}
                                className="pointer-events-none shadow-sm"
                              />
                            </g>

                            <g className="pointer-events-auto">
                              {/* Invisible touch hit-target */}
                              <circle
                                cx={(ann.x2 !== undefined ? ann.x2 : ann.x) * 1000}
                                cy={(ann.y2 !== undefined ? ann.y2 : ann.y) * 1000}
                                r={endpointHitR}
                                fill="transparent"
                                className="cursor-move"
                                onPointerDown={(e) => {
                                  if (activePointers.current.size >= 2) return;
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
                              {/* Visible endpoint circle */}
                              <circle
                                cx={(ann.x2 !== undefined ? ann.x2 : ann.x) * 1000}
                                cy={(ann.y2 !== undefined ? ann.y2 : ann.y) * 1000}
                                r={Math.max(6, 6 * vbScale)}
                                fill="#FFFFFF"
                                stroke="#3B82F6"
                                strokeWidth={Math.max(2, 2 * vbScale)}
                                className="pointer-events-none shadow-sm"
                              />
                            </g>
                          </>
                        )}
                      </g>
                    )}
                  </g>
                );
              });
            })()}

            {/* Active Drawing Draft */}
            {renderDrawingDraft()}
          </svg>
        </div>
      </div>

      {/* Floating Quick-Edit Panel (Rendered OUTSIDE scaled workspace at unscaled 1.0x size) */}
      {selectedItem && (
        <div
          className="absolute z-40 pointer-events-auto leading-normal bg-card/95 backdrop-blur-md border border-primary/50 shadow-2xl rounded-2xl p-1.5 sm:p-2 flex items-center gap-1.5 sm:gap-2 text-foreground text-xs animate-in fade-in zoom-in-95 duration-150 max-w-[95vw] overflow-x-auto scrollbar-none"
          style={getQuickPanelStyle()}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
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
            className="text-[11px] font-bold px-2 py-1 rounded-lg border border-border/80 bg-background text-foreground cursor-pointer focus:outline-none shrink-0"
          >
            <option value="open">🔴 Chưa fix</option>
            <option value="fixing">🔵 Đang fix</option>
            <option value="resolved">🟢 Đã fix</option>
          </select>

          {/* Color dots */}
          <div className="flex items-center gap-1 border-x border-border/60 px-1.5 shrink-0">
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
            className="w-28 sm:w-36 text-xs px-2 py-1 rounded-lg border border-border/80 bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary shrink-0"
          />

          {/* Delete button */}
          <button
            type="button"
            onClick={() => onDeleteAnnotation(selectedItem.id)}
            className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition shrink-0"
            title="Xóa điểm đánh dấu"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Close selection */}
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition shrink-0"
            title="Bỏ chọn"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
});

AnnotationCanvas.displayName = 'AnnotationCanvas';
