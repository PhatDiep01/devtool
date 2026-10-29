import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Clock, 
  Calendar as CalendarIcon, 
  FileText, 
  Sparkles, 
  Check, 
  AlertCircle,
  AlertTriangle 
} from 'lucide-react';
import { jiraApi } from '../../../services/api';
import { DateTimePicker } from '../../../components/ui';
import { WorklogDescriptionSuggestions } from './WorklogDescriptionSuggestions';
import { toast } from 'react-hot-toast';

import { parseTimePreview } from '../../../utils/jiraTime';

export interface EditableWorklog {
  id: string;
  issueKey: string;
  issueSummary?: string;
  timeSpent: string;
  started?: string;
  comment?: any;
  commentText?: string;
}

interface EditWorklogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  worklog: EditableWorklog | null;
}

function extractCommentText(raw: any): string {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  if (raw.body && typeof raw.body === 'string') return raw.body;
  if (Array.isArray(raw.content)) {
    return raw.content.map((c: any) => {
      if (c.type === 'paragraph' && Array.isArray(c.content)) {
        return c.content.map((n: any) => n.text || '').join('');
      }
      return '';
    }).filter(Boolean).join('\n');
  }
  return '';
}

export const EditWorklogModal: React.FC<EditWorklogModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  worklog
}) => {
  const [timeSpent, setTimeSpent] = useState('');
  const [started, setStarted] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && worklog) {
      setTimeSpent(worklog.timeSpent || '');
      const initStarted = worklog.started 
        ? new Date(worklog.started).toISOString().slice(0, 16)
        : new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setStarted(initStarted);
      const text = worklog.commentText || extractCommentText(worklog.comment);
      setComment(text);
    }
  }, [isOpen, worklog]);

  if (!isOpen || !worklog) return null;

  const preview = parseTimePreview(timeSpent);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timeSpent.trim()) {
      toast.error('Vui lòng nhập thời gian làm việc (Time Spent)');
      return;
    }

    if (!preview.valid || preview.seconds <= 0) {
      toast.error('Thời gian làm việc không hợp lệ');
      return;
    }

    setLoading(true);
    try {
      let startedIso: string;
      try {
        startedIso = new Date(started).toISOString();
      } catch {
        startedIso = new Date().toISOString();
      }

      await jiraApi.updateWorklog(worklog.issueKey, worklog.id, {
        timeSpent: timeSpent.trim(),
        started: startedIso,
        comment: comment.trim()
      });

      toast.success(`Đã cập nhật log work thành công cho ${worklog.issueKey}!`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Cập nhật log work thất bại';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return typeof document !== 'undefined' ? createPortal(
    <div 
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-foreground truncate">
                  Chỉnh sửa Log Work
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-accent text-primary font-bold shrink-0">
                  {worklog.issueKey}
                </span>
              </div>
              {worklog.issueSummary && (
                <p className="text-xs text-muted-foreground truncate mt-0.5" title={worklog.issueSummary}>
                  {worklog.issueSummary}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Time Spent */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <label className="text-xs font-bold text-foreground">
                Thời gian làm việc (Time Spent) *
              </label>
              <div className="flex items-center gap-1 flex-wrap">
                {['30m', '1h', '1h 30m', '2h', '3h 30m', '4h', '4h 30m', '8h'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTimeSpent(preset)}
                    className={`text-[10px] px-2 py-0.5 rounded-md font-mono transition ${
                      timeSpent === preset
                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                        : 'bg-muted hover:bg-accent text-foreground'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={timeSpent}
              onChange={(e) => setTimeSpent(e.target.value)}
              placeholder="Ví dụ: 4h 30m, 1h 30m, 45m, 4.5h, 2h"
              required
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-primary transition"
            />
            {!preview.valid && timeSpent.trim() && (
              <p className="text-[11px] text-rose-500 dark:text-rose-400 font-medium flex items-center gap-1 pt-0.5">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>Định dạng chưa đúng (ví dụ: "4h 30m", "1h 30m", "45m", "2h", "4.5h")</span>
              </p>
            )}
          </div>

          {/* Date & Started Time */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Ngày & Giờ Bắt Đầu (Started Time) *</span>
              </label>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setStarted(new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
                  }}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-muted hover:bg-accent text-foreground font-semibold transition flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  <span>Bây giờ</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setHours(8, 30, 0, 0);
                    setStarted(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
                  }}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-muted hover:bg-accent text-foreground font-semibold transition"
                >
                  8:30 sáng nay
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setHours(13, 30, 0, 0);
                    setStarted(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
                  }}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-muted hover:bg-accent text-foreground font-semibold transition"
                >
                  13:30 chiều nay
                </button>
              </div>
            </div>
            <DateTimePicker
              value={started}
              onChange={(newVal) => setStarted(newVal)}
              placeholder="Chọn ngày và giờ bắt đầu..."
            />
          </div>

          {/* Description / Comment with Suggestions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Mô tả công việc (Work Description)</span>
              </label>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-normal">Tùy chọn</span>
            </div>

            <WorklogDescriptionSuggestions
              subtaskTitle={worklog.issueSummary}
              comment={comment}
              onCommentChange={setComment}
            />

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ghi chú nội dung công việc đã làm..."
              rows={3}
              className="w-full bg-background border border-border rounded-xl p-3 text-sm focus:outline-none focus:border-primary transition resize-none leading-relaxed"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading || !timeSpent.trim() || !preview.valid}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Cập nhật Log Work</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  ) : null;
};
