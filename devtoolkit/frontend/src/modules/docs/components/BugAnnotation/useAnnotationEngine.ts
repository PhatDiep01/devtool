import { useState, useRef, useCallback, useEffect } from 'react';
import { AnnotationItem, AnnotationType, AnnotationStatus, NormalizedPoint } from '../../../../types';
import { ANNOTATION_COLORS } from './constants';
import { clamp01, clamp } from './mathUtils';

export interface AnnotationEngineOptions {
  initialAnnotations?: AnnotationItem[];
  onAutoSave?: (annotations: AnnotationItem[]) => Promise<void>;
  autoSaveDelay?: number;
}

export function useAnnotationEngine({
  initialAnnotations = [],
  onAutoSave,
  autoSaveDelay = 1000
}: AnnotationEngineOptions = {}) {
  const [annotations, setAnnotations] = useState<AnnotationItem[]>(initialAnnotations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<AnnotationType | 'select'>('rect');
  const [activeColor, setActiveColor] = useState<string>(ANNOTATION_COLORS[0].value);
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [fontSize, setFontSize] = useState<number>(14);

  // Undo / Redo history
  const [history, setHistory] = useState<AnnotationItem[][]>([]);
  const [future, setFuture] = useState<AnnotationItem[][]>([]);

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Auto-save status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Active drawing/editing draft
  const [activeDraft, setActiveDraft] = useState<AnnotationItem | null>(null);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const annotationsRef = useRef<AnnotationItem[]>(annotations);
  annotationsRef.current = annotations;

  // Initialize annotations when prop changes
  const resetWithAnnotations = useCallback((newItems: AnnotationItem[]) => {
    setAnnotations(newItems);
    setHistory([]);
    setFuture([]);
    setSelectedId(null);
    setSaveStatus('saved');
  }, []);

  // Push new state to history for Undo
  const pushHistory = useCallback((current: AnnotationItem[]) => {
    setHistory((prev) => [...prev.slice(-49), current]);
    setFuture([]);
    setSaveStatus('dirty');
  }, []);

  // Trigger debounced auto-save
  const triggerAutoSave = useCallback(() => {
    if (!onAutoSave) return;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    setSaveStatus('dirty');
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        await onAutoSave(annotationsRef.current);
        setSaveStatus('saved');
        setLastSavedAt(new Date());
      } catch (err) {
        console.error('Auto-save failed:', err);
        setSaveStatus('error');
      }
    }, autoSaveDelay);
  }, [onAutoSave, autoSaveDelay]);

  // Undo
  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setFuture((prev) => [annotations, ...prev]);
    setAnnotations(previous);
    triggerAutoSave();
  }, [history, annotations, triggerAutoSave]);

  // Redo
  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setHistory((prev) => [...prev, annotations]);
    setAnnotations(next);
    triggerAutoSave();
  }, [future, annotations, triggerAutoSave]);

  // Add a new annotation
  const addAnnotation = useCallback((item: Omit<AnnotationItem, 'id' | 'sequence' | 'created_at' | 'updated_at'>) => {
    pushHistory(annotationsRef.current);
    const nextSeq = annotationsRef.current.reduce((max, a) => Math.max(max, a.sequence), 0) + 1;
    const newItem: AnnotationItem = {
      ...item,
      id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sequence: nextSeq,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const nextList = [...annotationsRef.current, newItem];
    setAnnotations(nextList);
    setSelectedId(newItem.id);
    triggerAutoSave();
    return newItem;
  }, [pushHistory, triggerAutoSave]);

  // Update an existing annotation
  const updateAnnotation = useCallback((id: string, updates: Partial<AnnotationItem>, recordHistory = true) => {
    if (recordHistory) {
      pushHistory(annotationsRef.current);
    }
    const nextList = annotationsRef.current.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          ...updates,
          updated_at: new Date().toISOString(),
        };
      }
      return item;
    });
    setAnnotations(nextList);
    triggerAutoSave();
  }, [pushHistory, triggerAutoSave]);

  // Delete an annotation
  const deleteAnnotation = useCallback((id: string) => {
    pushHistory(annotationsRef.current);
    const filtered = annotationsRef.current.filter((item) => item.id !== id);
    // Renumber sequences sequentially
    const renumbered = filtered.map((item, idx) => ({
      ...item,
      sequence: idx + 1,
    }));
    setAnnotations(renumbered);
    if (selectedId === id) {
      setSelectedId(null);
    }
    triggerAutoSave();
  }, [pushHistory, selectedId, triggerAutoSave]);

  // Renumber sequences
  const reorderSequences = useCallback((reorderedList: AnnotationItem[]) => {
    pushHistory(annotationsRef.current);
    const cleanList = reorderedList.map((item, idx) => ({
      ...item,
      sequence: idx + 1,
    }));
    setAnnotations(cleanList);
    triggerAutoSave();
  }, [pushHistory, triggerAutoSave]);

  // Zoom controls
  const zoomIn = useCallback(() => setZoom((z) => Math.min(4.0, Number((z + 0.25).toFixed(2)))), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(0.02, Number((z - 0.25).toFixed(2)))), []);
  const resetZoom = useCallback(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  }, []);
  const fitToScreen = useCallback((targetZoom?: number) => {
    setZoom(targetZoom !== undefined ? targetZoom : 1.0);
    setPan({ x: 0, y: 0 });
  }, []);

  // Save immediately
  const saveNow = useCallback(async () => {
    if (!onAutoSave) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    try {
      setSaveStatus('saving');
      await onAutoSave(annotationsRef.current);
      setSaveStatus('saved');
      setLastSavedAt(new Date());
    } catch (err) {
      console.error('Manual save failed:', err);
      setSaveStatus('error');
    }
  }, [onAutoSave]);

  // Selected item reference
  const selectedAnnotation = annotations.find((a) => a.id === selectedId) || null;

  return {
    annotations,
    selectedId,
    selectedAnnotation,
    activeTool,
    activeColor,
    strokeWidth,
    fontSize,
    history,
    future,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
    zoom,
    pan,
    saveStatus,
    lastSavedAt,
    activeDraft,
    setAnnotations,
    setSelectedId,
    setActiveTool,
    setActiveColor,
    setStrokeWidth,
    setFontSize,
    setZoom,
    setPan,
    setActiveDraft,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    reorderSequences,
    undo,
    redo,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToScreen,
    saveNow,
    resetWithAnnotations,
  };
}
