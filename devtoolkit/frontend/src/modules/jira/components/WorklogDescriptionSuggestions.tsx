import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Check } from 'lucide-react';

export type WorklogRole = 'BE' | 'FE' | 'BA';

const STORAGE_KEY = 'jira_worklog_desc_role';

export const ROLE_SUGGESTIONS: Record<WorklogRole, string[]> = {
  BE: [
    'Phát triển API / xử lý nghiệp vụ theo subtask',
    'Thiết kế, cập nhật database / migration',
    'Viết, tối ưu query và hiệu năng',
    'Fix bug theo ticket',
    'Phân tích log, xử lý lỗi hệ thống',
    'Viết unit test / self-test API',
    'Hỗ trợ FE tích hợp API',
    'Review code, xử lý comment review',
    'Build, deploy lên môi trường test'
  ],
  FE: [
    'Phát triển màn hình / component theo subtask',
    'Làm giao diện theo thiết kế (UI/UX)',
    'Tích hợp API với backend',
    'Xử lý validate form, luồng nhập liệu',
    'Fix bug giao diện / logic theo ticket',
    'Tối ưu hiệu năng, responsive',
    'Self-test chức năng trên trình duyệt',
    'Review code, xử lý comment review',
    'Hỗ trợ QA test, sửa theo feedback'
  ],
  BA: [
    'Phân tích yêu cầu nghiệp vụ',
    'Viết / cập nhật tài liệu đặc tả',
    'Họp trao đổi yêu cầu với khách hàng / team',
    'Giải đáp thắc mắc cho dev',
    'Vẽ luồng nghiệp vụ, wireframe',
    'Viết test case / hỗ trợ UAT',
    'Review, nghiệm thu chức năng với dev',
    'Quản lý, cập nhật backlog / ticket'
  ]
};

const ALL_KNOWN_OPTIONS: string[] = [
  ...ROLE_SUGGESTIONS.BE,
  ...ROLE_SUGGESTIONS.FE,
  ...ROLE_SUGGESTIONS.BA
];

interface WorklogDescriptionSuggestionsProps {
  subtaskTitle?: string;
  comment: string;
  onCommentChange: (newComment: string) => void;
  className?: string;
}

export const WorklogDescriptionSuggestions: React.FC<WorklogDescriptionSuggestionsProps> = ({
  subtaskTitle = '',
  comment,
  onCommentChange,
  className = ''
}) => {
  // 1. Role Toggle with persistent memory (BE | FE | BA)
  const [selectedRole, setSelectedRole] = useState<WorklogRole>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'BE' || saved === 'FE' || saved === 'BA') {
        return saved;
      }
    } catch {}
    return 'BE';
  });

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [lastAppliedSnippet, setLastAppliedSnippet] = useState<string | null>(null);
  const prevSubtaskTitleRef = useRef<string>(subtaskTitle || '');

  // Persist role change
  const handleRoleChange = (role: WorklogRole) => {
    setSelectedRole(role);
    try {
      localStorage.setItem(STORAGE_KEY, role);
    } catch {}
  };

  // 2. Synchronize selectedOption if comment is cleared or changed externally
  useEffect(() => {
    const trimmed = comment ? comment.trim() : '';
    if (!trimmed) {
      setSelectedOption(null);
      setLastAppliedSnippet(null);
      return;
    }

    // If comment still contains lastAppliedSnippet, keep selectedOption
    if (lastAppliedSnippet && comment.includes(lastAppliedSnippet)) {
      return;
    }

    // Otherwise, check if comment starts with or contains any known option
    let matchedOption: string | null = null;
    for (const opt of ALL_KNOWN_OPTIONS) {
      if (comment.startsWith(`${opt}:`) || comment === opt || comment.includes(`${opt}:`)) {
        matchedOption = opt;
        break;
      }
    }
    setSelectedOption(matchedOption);
  }, [comment, lastAppliedSnippet]);

  // 3. Auto-update subtask title when user picks/changes subtask after selecting an option
  useEffect(() => {
    const currentTitle = (subtaskTitle || '').trim();
    const prevTitle = prevSubtaskTitleRef.current.trim();
    prevSubtaskTitleRef.current = currentTitle;

    if (!selectedOption) return;

    // If subtask title changed from empty to a title, or from one title to another
    if (currentTitle !== prevTitle) {
      const oldSnippet = prevTitle ? `${selectedOption}: ${prevTitle}` : selectedOption;
      const newSnippet = currentTitle ? `${selectedOption}: ${currentTitle}` : selectedOption;

      if (comment.includes(oldSnippet)) {
        const next = comment.replace(oldSnippet, newSnippet);
        onCommentChange(next);
        setLastAppliedSnippet(newSnippet);
      } else if (lastAppliedSnippet && comment.includes(lastAppliedSnippet)) {
        const next = comment.replace(lastAppliedSnippet, newSnippet);
        onCommentChange(next);
        setLastAppliedSnippet(newSnippet);
      }
    }
  }, [subtaskTitle, selectedOption, comment, lastAppliedSnippet, onCommentChange]);

  // 4. Handle Option Chip Click
  const handleSelectOption = (option: string) => {
    const cleanTitle = (subtaskTitle || '').trim();
    const newSnippet = cleanTitle ? `${option}: ${cleanTitle}` : option;

    // Toggle off if clicking the already selected option
    if (selectedOption === option) {
      let updated = comment;
      if (lastAppliedSnippet && updated.includes(lastAppliedSnippet)) {
        updated = updated.replace(lastAppliedSnippet, '').trim();
      } else if (updated.includes(newSnippet)) {
        updated = updated.replace(newSnippet, '').trim();
      }
      onCommentChange(updated);
      setSelectedOption(null);
      setLastAppliedSnippet(null);
      return;
    }

    // Replace old option with new option
    let nextComment = comment || '';

    // Step A: If lastAppliedSnippet is found in comment, directly replace it
    if (lastAppliedSnippet && nextComment.includes(lastAppliedSnippet)) {
      nextComment = nextComment.replace(lastAppliedSnippet, newSnippet);
    } else {
      // Step B: Search if any known option from all roles exists in comment
      let replaced = false;

      // Check if candidate with subtask title exists
      for (const opt of ALL_KNOWN_OPTIONS) {
        const candidateWithTitle = cleanTitle ? `${opt}: ${cleanTitle}` : null;
        if (candidateWithTitle && nextComment.includes(candidateWithTitle)) {
          nextComment = nextComment.replace(candidateWithTitle, newSnippet);
          replaced = true;
          break;
        }
      }

      // Check prefix with colon e.g. "Fix bug theo ticket: ..."
      if (!replaced) {
        for (const opt of ALL_KNOWN_OPTIONS) {
          const prefix = `${opt}:`;
          const prefixIdx = nextComment.indexOf(prefix);
          if (prefixIdx !== -1) {
            // Find end of this suggestion (newline or end of string)
            const newlineIdx = nextComment.indexOf('\n', prefixIdx);
            const targetLength = newlineIdx === -1 ? nextComment.length - prefixIdx : newlineIdx - prefixIdx;
            const targetStr = nextComment.substring(prefixIdx, prefixIdx + targetLength);
            nextComment = nextComment.replace(targetStr, newSnippet);
            replaced = true;
            break;
          } else if (nextComment.includes(opt)) {
            nextComment = nextComment.replace(opt, newSnippet);
            replaced = true;
            break;
          }
        }
      }

      // Step C: If no prior option was found, replace or fill
      if (!replaced) {
        nextComment = newSnippet;
      }
    }

    onCommentChange(nextComment);
    setSelectedOption(option);
    setLastAppliedSnippet(newSnippet);
  };

  const currentOptions = ROLE_SUGGESTIONS[selectedRole] || [];

  return (
    <div className={`space-y-2 rounded-xl bg-muted/30 border border-border/70 p-2.5 ${className}`}>
      {/* Header: Label + 3 Segmented Toggle Buttons (BE | FE | BA) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Gợi ý mô tả:</span>
        </div>

        {/* Toggle BE | FE | BA */}
        <div className="flex items-center gap-1 p-0.5 bg-muted/80 rounded-lg border border-border text-xs">
          {(['BE', 'FE', 'BA'] as const).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => handleRoleChange(role)}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                selectedRole === role
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
              title={`Gợi ý cho ${role === 'BE' ? 'Dev BE' : role === 'FE' ? 'Dev FE' : 'BA'}`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Suggestion Chips */}
      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
        {currentOptions.map((option) => {
          const isSelected = selectedOption === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => handleSelectOption(option)}
              className={`text-[11px] px-2.5 py-1 rounded-lg border transition text-left flex items-center gap-1.5 cursor-pointer leading-snug ${
                isSelected
                  ? 'bg-primary/10 border-primary text-primary font-bold shadow-2xs'
                  : 'bg-background hover:bg-accent text-foreground/85 hover:text-foreground border-border/80'
              }`}
              title={`Bấm để chọn: ${option}${subtaskTitle ? `: ${subtaskTitle}` : ''}`}
            >
              {isSelected ? (
                <Check className="w-3 h-3 shrink-0 text-primary stroke-[3]" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
              )}
              <span>{option}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
