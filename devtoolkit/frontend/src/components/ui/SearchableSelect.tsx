import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface SelectOption<T = string | number> {
  value: T;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  avatarUrl?: string;
  badge?: string;
  badgeColor?: string;
  group?: string;
  disabled?: boolean;
}

export interface SearchableSelectProps<T = string | number> {
  options: SelectOption<T>[];
  value: T | undefined | null;
  onChange: (value: T) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  label?: string;
  error?: string;
  id?: string;
}

export function SearchableSelect<T = string | number>({
  options,
  value,
  onChange,
  placeholder = 'Chọn một mục...',
  searchPlaceholder = 'Tìm kiếm tùy chọn...',
  searchable,
  allowClear = false,
  disabled = false,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  size = 'md',
  icon,
  label,
  error,
  id,
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-enable search if more than 5 options and searchable not explicitly passed
  const isSearchEnabled = searchable !== undefined ? searchable : options.length > 5;

  // Selected option
  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.trim().toLowerCase();
    return options.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(query);
      const matchSub = opt.sublabel?.toLowerCase().includes(query);
      const matchVal = String(opt.value).toLowerCase().includes(query);
      const matchGroup = opt.group?.toLowerCase().includes(query);
      return matchLabel || matchSub || matchVal || matchGroup;
    });
  }, [options, searchQuery]);

  // Grouped options if any
  const groupedOptions = useMemo(() => {
    const groups: { name?: string; items: SelectOption<T>[] }[] = [];
    const ungrouped: SelectOption<T>[] = [];
    const groupMap = new Map<string, SelectOption<T>[]>();

    filteredOptions.forEach((opt) => {
      if (opt.group) {
        if (!groupMap.has(opt.group)) {
          groupMap.set(opt.group, []);
        }
        groupMap.get(opt.group)!.push(opt);
      } else {
        ungrouped.push(opt);
      }
    });

    if (ungrouped.length > 0) {
      groups.push({ items: ungrouped });
    }

    groupMap.forEach((items, name) => {
      groups.push({ name, items });
    });

    return groups;
  }, [filteredOptions]);

  // Handle outside click to close
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      // Auto focus search input when opened
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (option: SelectOption<T>) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('' as unknown as T);
    setSearchQuery('');
  };

  // Size specific styles
  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs rounded-xl min-h-[32px]',
    md: 'px-3.5 py-2 text-xs font-semibold rounded-xl min-h-[38px]',
    lg: 'px-4 py-2.5 text-sm font-semibold rounded-2xl min-h-[44px]',
  }[size];

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
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 text-left bg-background border transition-all select-none ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-muted/30 border-border'
            : isOpen
            ? 'border-primary ring-2 ring-primary/20 shadow-xs'
            : 'border-border hover:border-primary/50 shadow-2xs hover:shadow-xs'
        } ${sizeClasses} ${triggerClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}

          {selectedOption ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {selectedOption.avatarUrl && (
                <img
                  src={selectedOption.avatarUrl}
                  alt=""
                  className="w-4 h-4 rounded-full object-cover shrink-0 border border-border/80"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              )}
              {selectedOption.icon && (
                <span className="shrink-0">{selectedOption.icon}</span>
              )}
              <span className="text-foreground truncate font-semibold">
                {selectedOption.label}
              </span>
              {selectedOption.sublabel && (
                <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                  {selectedOption.sublabel}
                </span>
              )}
              {selectedOption.badge && (
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    selectedOption.badgeColor || 'bg-muted text-muted-foreground'
                  }`}
                >
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground font-normal truncate">
              {placeholder}
            </span>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {allowClear && selectedOption && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition"
              title="Xóa lựa chọn"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-primary' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 z-50 mt-1.5 bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col min-w-[220px] ${menuClassName}`}
          style={{ maxHeight: '320px' }}
        >
          {/* Search Box */}
          {isSearchEnabled && (
            <div className="p-2 border-b border-border/60 bg-muted/20 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full bg-background border border-border/80 rounded-xl pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary transition"
                  onClick={(e) => e.stopPropagation()}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin flex-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Không tìm thấy kết quả nào
              </div>
            ) : (
              groupedOptions.map((group, gIdx) => (
                <div key={group.name || `group-${gIdx}`} className="space-y-0.5">
                  {group.name && (
                    <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/70">
                      {group.name}
                    </div>
                  )}
                  {group.items.map((opt) => {
                    const isSelected = opt.value === value;
                    return (
                      <button
                        key={String(opt.value)}
                        type="button"
                        disabled={opt.disabled}
                        onClick={() => handleSelect(opt)}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs text-left transition select-none ${
                          opt.disabled
                            ? 'opacity-40 cursor-not-allowed'
                            : isSelected
                            ? 'bg-primary/10 text-primary font-bold'
                            : 'text-foreground hover:bg-muted/80'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {opt.avatarUrl && (
                            <img
                              src={opt.avatarUrl}
                              alt=""
                              className="w-4 h-4 rounded-full object-cover shrink-0 border border-border/80"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          )}
                          {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                          <div className="min-w-0 flex-1">
                            <div className="truncate">{opt.label}</div>
                            {opt.sublabel && (
                              <div className="text-[10px] text-muted-foreground truncate">
                                {opt.sublabel}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                          {opt.badge && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                opt.badgeColor || 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {opt.badge}
                            </span>
                          )}
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}
