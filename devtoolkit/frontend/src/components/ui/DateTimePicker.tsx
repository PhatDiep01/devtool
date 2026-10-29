import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Check, 
  Sparkles 
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  isValid,
  setHours,
  setMinutes,
} from 'date-fns';

export interface DateTimePickerProps {
  value?: string; // ISO string e.g. "2026-10-24T15:30:00.000Z" or "2026-10-24T15:30"
  onChange: (value: string) => void;
  showTime?: boolean; // defaults to true
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
  minDate?: Date;
  maxDate?: Date;
  id?: string;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  showTime = true,
  label,
  placeholder = 'Chọn ngày giờ...',
  disabled = false,
  className = '',
  allowClear = false,
  minDate,
  maxDate,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePlacement = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // If space below is less than 400px and space above has more room, flip popover upwards
      if (spaceBelow < 400 && spaceAbove > 300) {
        setPlacement('top');
      } else {
        setPlacement('bottom');
      }
    }
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePlacement();
    }
    setIsOpen(!isOpen);
  };

  // Parse initial date
  const parsedDate = useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    if (isValid(d)) return d;
    try {
      const iso = parseISO(value);
      if (isValid(iso)) return iso;
    } catch {}
    return null;
  }, [value]);

  // Current calendar view month
  const [currentMonth, setCurrentMonth] = useState<Date>(() => parsedDate || new Date());
  // Selected date
  const [selectedDate, setSelectedDate] = useState<Date>(() => parsedDate || new Date());

  // Synchronize when value changes from outside
  useEffect(() => {
    if (parsedDate) {
      setSelectedDate(parsedDate);
      setCurrentMonth(parsedDate);
    }
  }, [parsedDate]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Days in current view
  const daysInMonth = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    // Start week on Monday (weekStartsOn: 1)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  // Format value to return: "YYYY-MM-DDTHH:mm"
  const emitChange = (dateToEmit: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = dateToEmit.getFullYear();
    const m = pad(dateToEmit.getMonth() + 1);
    const d = pad(dateToEmit.getDate());
    const h = pad(dateToEmit.getHours());
    const min = pad(dateToEmit.getMinutes());

    const result = showTime ? `${y}-${m}-${d}T${h}:${min}` : `${y}-${m}-${d}`;
    onChange(result);
  };

  const handleSelectDay = (day: Date) => {
    // Preserve current time
    let updated = setHours(day, selectedDate.getHours());
    updated = setMinutes(updated, selectedDate.getMinutes());
    setSelectedDate(updated);
    emitChange(updated);
  };

  const handleHourChange = (newHour: number) => {
    const updated = setHours(selectedDate, newHour);
    setSelectedDate(updated);
    emitChange(updated);
  };

  const handleMinuteChange = (newMinute: number) => {
    const updated = setMinutes(selectedDate, newMinute);
    setSelectedDate(updated);
    emitChange(updated);
  };

  const handlePresetDate = (daysOffset: number) => {
    const now = new Date();
    now.setDate(now.getDate() + daysOffset);
    let updated = setHours(now, selectedDate.getHours());
    updated = setMinutes(updated, selectedDate.getMinutes());
    setSelectedDate(updated);
    setCurrentMonth(updated);
    emitChange(updated);
  };

  const handlePresetTime = (hour: number, minute: number) => {
    let updated = setHours(selectedDate, hour);
    updated = setMinutes(updated, minute);
    setSelectedDate(updated);
    emitChange(updated);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  // Formatted trigger text
  const formattedTriggerText = useMemo(() => {
    if (!parsedDate) return null;
    try {
      if (showTime) {
        return format(parsedDate, 'dd/MM/yyyy HH:mm');
      }
      return format(parsedDate, 'dd/MM/yyyy');
    } catch {
      return value;
    }
  }, [parsedDate, showTime, value]);

  const isSelectedDayToday = parsedDate ? isToday(parsedDate) : false;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-bold text-foreground mb-1.5 flex items-center justify-between"
        >
          <span>{label}</span>
        </label>
      )}

      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full flex items-center justify-between gap-2 text-left bg-background border px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all select-none ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-muted/30 border-border'
            : isOpen
            ? 'border-primary ring-2 ring-primary/20 shadow-xs'
            : 'border-border hover:border-primary/50 shadow-2xs hover:shadow-xs'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <CalendarIcon className="w-4 h-4 text-primary shrink-0" />
          {formattedTriggerText ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-mono text-foreground font-bold tracking-tight">
                {formattedTriggerText}
              </span>
              {isSelectedDayToday && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 shrink-0">
                  Hôm nay
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground font-normal">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {allowClear && formattedTriggerText && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition"
              title="Xóa ngày"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />
        </div>
      </button>

      {/* Modern Popover Calendar with Smart Flipping (never stretches page) */}
      {isOpen && (
        <div
          className={`absolute left-0 z-50 bg-card border border-border rounded-2xl shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-150 w-[320px] sm:w-[340px] max-h-[min(500px,85vh)] overflow-y-auto ${
            placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-1.5'
          }`}
        >
          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 pb-3 border-b border-border/60 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => handlePresetDate(0)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-muted/60 hover:bg-primary/15 hover:text-primary transition shrink-0"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => handlePresetDate(-1)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-muted/60 hover:bg-primary/15 hover:text-primary transition shrink-0"
            >
              Hôm qua
            </button>
            <button
              type="button"
              onClick={() => handlePresetDate(1)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-muted/60 hover:bg-primary/15 hover:text-primary transition shrink-0"
            >
              Ngày mai
            </button>
            {showTime && (
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setSelectedDate(now);
                  setCurrentMonth(now);
                  emitChange(now);
                }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition shrink-0 flex items-center gap-1 ml-auto"
              >
                <Sparkles className="w-3 h-3" /> Bây giờ
              </button>
            )}
          </div>

          {/* Month & Year Navigator */}
          <div className="flex items-center justify-between py-3">
            <button
              type="button"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition"
              title="Tháng trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-extrabold text-foreground tracking-tight">
              {format(currentMonth, 'MMMM yyyy')}
            </span>

            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition"
              title="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((w, idx) => (
              <span
                key={w}
                className={`text-[10px] font-bold ${
                  idx >= 5 ? 'text-amber-500' : 'text-muted-foreground'
                }`}
              >
                {w}
              </span>
            ))}
          </div>

          {/* Calendar Days Matrix */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {daysInMonth.map((day) => {
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentDay = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-8 w-8 mx-auto rounded-xl text-xs font-semibold transition-all flex items-center justify-center relative ${
                    isSelected
                      ? 'bg-primary text-primary-foreground font-bold shadow-md scale-105'
                      : isCurrentDay
                      ? 'border border-primary text-primary hover:bg-primary/10 font-bold'
                      : isCurrentMonth
                      ? 'text-foreground hover:bg-muted/80'
                      : 'text-muted-foreground/30 hover:bg-muted/40'
                  }`}
                >
                  {format(day, 'd')}
                  {isCurrentDay && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Time Selector (if showTime) */}
          {showTime && (
            <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span>Giờ & Phút:</span>
                </span>
                <span className="font-mono text-primary font-extrabold text-sm">
                  {String(selectedDate.getHours()).padStart(2, '0')}:
                  {String(selectedDate.getMinutes()).padStart(2, '0')}
                </span>
              </div>

              {/* Quick time chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { label: '08:30', h: 8, m: 30 },
                  { label: '11:30', h: 11, m: 30 },
                  { label: '13:30', h: 13, m: 30 },
                  { label: '17:30', h: 17, m: 30 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handlePresetTime(preset.h, preset.m)}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-muted/60 hover:bg-primary/15 hover:text-primary transition"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Time inputs */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-bold block">
                    Giờ (0 - 23)
                  </label>
                  <select
                    value={selectedDate.getHours()}
                    onChange={(e) => handleHourChange(Number(e.target.value))}
                    className="w-full bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs font-bold font-mono focus:outline-none focus:border-primary"
                  >
                    {Array.from({ length: 24 }).map((_, i) => (
                      <option key={i} value={i}>
                        {String(i).padStart(2, '0')} : 00
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-bold block">
                    Phút (0 - 59)
                  </label>
                  <select
                    value={selectedDate.getMinutes()}
                    onChange={(e) => handleMinuteChange(Number(e.target.value))}
                    className="w-full bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs font-bold font-mono focus:outline-none focus:border-primary"
                  >
                    {Array.from({ length: 60 }).map((_, i) => (
                      <option key={i} value={i}>
                        {String(i).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Footer Done button */}
          <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 transition shadow-xs flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Xong</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
