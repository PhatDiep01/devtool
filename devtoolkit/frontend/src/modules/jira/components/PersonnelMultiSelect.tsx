import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Check, 
  ChevronDown, 
  X
} from 'lucide-react';
import { ActivityStreamUserAgg } from '../../../types';
import { JiraAvatar } from './JiraAvatar';

interface PersonnelMultiSelectProps {
  users: ActivityStreamUserAgg[];
  selectedUserNames: Set<string>;
  onChange: (selected: Set<string>) => void;
  className?: string;
}

export const PersonnelMultiSelect: React.FC<PersonnelMultiSelectProps> = ({
  users,
  selectedUserNames,
  onChange,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Filter users by search term
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const term = searchTerm.trim().toLowerCase();
    return users.filter((u) => 
      u.displayName.toLowerCase().includes(term) ||
      u.name.toLowerCase().includes(term) ||
      (u.emailAddress && u.emailAddress.toLowerCase().includes(term))
    );
  }, [users, searchTerm]);

  // Determine selection state (empty set = All users selected)
  const isAllSelected = selectedUserNames.size === 0 || selectedUserNames.size === users.length;
  const isFiltered = !isAllSelected && selectedUserNames.size > 0;

  // Toggle single user
  const handleToggleUser = (userName: string) => {
    if (isAllSelected) {
      // If currently all selected, clicking one person filters to ONLY that person
      onChange(new Set([userName]));
    } else {
      const next = new Set(selectedUserNames);
      if (next.has(userName)) {
        next.delete(userName);
        // If all deselected, revert to All
        onChange(next);
      } else {
        next.add(userName);
        // If all users are now selected, reset to All (empty set)
        if (next.size === users.length) {
          onChange(new Set());
        } else {
          onChange(next);
        }
      }
    }
  };

  // Select only this specific user
  const handleSelectOnly = (userName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(new Set([userName]));
  };

  // Reset to All
  const handleSelectAll = () => {
    onChange(new Set());
    setSearchTerm('');
  };

  // Get currently selected user objects for preview
  const selectedUserObjects = useMemo(() => {
    if (isAllSelected) return [];
    return users.filter(u => selectedUserNames.has(u.name));
  }, [users, selectedUserNames, isAllSelected]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm border transition bg-background hover:bg-accent/40 ${
          isOpen ? 'border-primary ring-1 ring-primary/30' : 'border-border'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Users className="w-4 h-4 text-primary shrink-0" />
          
          {isAllSelected ? (
            <span className="font-medium text-foreground truncate">
              Tất cả nhân sự ({users.length})
            </span>
          ) : selectedUserObjects.length === 1 ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <JiraAvatar
                avatarUrl={selectedUserObjects[0].avatarUrl}
                displayName={selectedUserObjects[0].displayName}
                className="w-4 h-4"
                sizeText="text-[8px]"
              />
              <span className="font-semibold text-foreground truncate">
                {selectedUserObjects[0].displayName}
              </span>
              <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
                ({selectedUserObjects[0].formattedTime})
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              {/* Mini avatar stack */}
              <div className="flex -space-x-1.5 shrink-0">
                {selectedUserObjects.slice(0, 3).map((u) => (
                  <JiraAvatar
                    key={u.name}
                    avatarUrl={u.avatarUrl}
                    displayName={u.displayName}
                    className="w-4 h-4 ring-1 ring-card"
                    sizeText="text-[7px]"
                  />
                ))}
              </div>
              <span className="font-semibold text-foreground truncate">
                {selectedUserObjects.length} nhân sự đã chọn
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isFiltered && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleSelectAll();
              }}
              className="p-0.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
              title="Đặt lại (Chọn tất cả)"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 sm:right-0 sm:left-auto mt-1.5 z-50 w-80 sm:w-96 rounded-2xl bg-card border border-border shadow-xl p-3 space-y-2.5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm nhân sự theo tên, username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Header: Quick toggles */}
          <div className="flex items-center justify-between text-xs px-1 pt-1 pb-1 border-b border-border/60">
            <span className="text-muted-foreground font-medium">
              {isAllSelected ? (
                <span>Đang chọn: <strong>Tất cả ({users.length})</strong></span>
              ) : (
                <span>Đã chọn: <strong className="text-primary">{selectedUserObjects.length}</strong>/{users.length}</span>
              )}
            </span>

            <div className="flex items-center gap-2">
              {!isAllSelected && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] font-semibold text-primary hover:underline transition"
                >
                  Chọn tất cả
                </button>
              )}
              {isFiltered && (
                <button
                  type="button"
                  onClick={() => onChange(new Set())}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition"
                >
                  Xóa lọc
                </button>
              )}
            </div>
          </div>

          {/* User List with Checkboxes */}
          <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
            {filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground italic">
                Không tìm thấy nhân sự phù hợp với "{searchTerm}"
              </div>
            ) : (
              filteredUsers.map((u) => {
                const checked = isAllSelected || selectedUserNames.has(u.name);

                return (
                  <div
                    key={u.name}
                    onClick={() => handleToggleUser(u.name)}
                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition select-none group ${
                      checked 
                        ? 'bg-primary/5 hover:bg-primary/10 border border-primary/20' 
                        : 'hover:bg-accent/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Checkbox Icon */}
                      <div className={`w-4 h-4 rounded-md flex items-center justify-center transition shrink-0 ${
                        checked
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border/80 group-hover:border-primary/50'
                      }`}>
                        {checked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      {/* Avatar */}
                      <JiraAvatar
                        avatarUrl={u.avatarUrl}
                        displayName={u.displayName}
                        className="w-6 h-6 shrink-0"
                        sizeText="text-[10px]"
                      />

                      {/* Name & username */}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-foreground truncate">
                          {u.displayName}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {u.name}
                        </div>
                      </div>
                    </div>

                    {/* Right: Quick action "Chỉ người này" + Stats */}
                    <div className="flex items-center gap-2 shrink-0 pl-2">
                      <button
                        type="button"
                        onClick={(e) => handleSelectOnly(u.name, e)}
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-primary hover:underline transition font-semibold hidden sm:inline"
                        title={`Chỉ xem log time của ${u.displayName}`}
                      >
                        Chỉ người này
                      </button>

                      <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 tabular-nums">
                        {u.formattedTime}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Bấm vào để chọn nhiều</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="font-semibold text-primary hover:underline"
            >
              Hoàn tất
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
