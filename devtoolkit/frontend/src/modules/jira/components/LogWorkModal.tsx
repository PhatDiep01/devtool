import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Clock, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Search, 
  ExternalLink,
  GitBranch,
  AlertTriangle
} from 'lucide-react';
import { jiraApi } from '../../../services/api';
import { JiraIssue, JiraAssignedSubtask } from '../../../types';
import { SubtaskPicker } from './SubtaskPicker';
import { WorklogDescriptionSuggestions } from './WorklogDescriptionSuggestions';
import { toast } from 'react-hot-toast';
import { DateTimePicker } from '../../../components/ui';

import { 
  parseTimePreview, 
  formatSecondsToDuration, 
  extractSubtaskEstimates 
} from '../../../utils/jiraTime';

interface LogWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialIssueKey?: string;
  initialIssueSummary?: string;
}

export const LogWorkModal: React.FC<LogWorkModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialIssueKey = '',
  initialIssueSummary = ''
}) => {
  const [issueKey, setIssueKey] = useState(initialIssueKey);
  const [issueSummary, setIssueSummary] = useState(initialIssueSummary);
  const [issueStatus, setIssueStatus] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'subtask' | 'manual'>(initialIssueKey ? 'manual' : 'subtask');
  const [timeSpent, setTimeSpent] = useState('1h');
  const [suggestedEstimate, setSuggestedEstimate] = useState<string | null>(null);
  const [suggestedRemaining, setSuggestedRemaining] = useState<string | null>(null);
  const [started, setStarted] = useState(() => {
    const now = new Date();
    // format as YYYY-MM-DDTHH:mm
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [myIssues, setMyIssues] = useState<JiraIssue[]>([]);
  const [taskTimetracking, setTaskTimetracking] = useState<{ timeSpent?: string; remainingEstimate?: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIssueKey(initialIssueKey);
      setIssueSummary(initialIssueSummary);
      setInputMode(initialIssueKey ? 'manual' : 'subtask');
      setSuggestedEstimate(null);
      setSuggestedRemaining(null);
      if (initialIssueKey) {
        fetchIssueTimetracking(initialIssueKey);
      } else {
        loadMyIssues();
      }
    }
  }, [isOpen, initialIssueKey, initialIssueSummary]);

  const fetchIssueTimetracking = async (key: string) => {
    try {
      const res = await jiraApi.getIssue(key);
      const tt = res.data?.fields?.timetracking;
      setIssueStatus(res.data?.fields?.status?.name || null);
      const origSec = typeof tt?.originalEstimateSeconds === 'number'
        ? tt.originalEstimateSeconds
        : (typeof res.data?.fields?.timeoriginalestimate === 'number' ? res.data.fields.timeoriginalestimate : 0);
      const remSec = typeof tt?.remainingEstimateSeconds === 'number'
        ? tt.remainingEstimateSeconds
        : (typeof res.data?.fields?.timeestimate === 'number' ? res.data.fields.timeestimate : 0);
      const spentSec = typeof tt?.timeSpentSeconds === 'number'
        ? tt.timeSpentSeconds
        : (typeof res.data?.fields?.timespent === 'number' ? res.data.fields.timespent : 0);

      const origStr = tt?.originalEstimate || (origSec > 0 ? formatSecondsToDuration(origSec) : undefined);
      const remStr = tt?.remainingEstimate || (res.data?.fields?.timeestimate !== undefined && res.data?.fields?.timeestimate !== null ? formatSecondsToDuration(remSec) : undefined);
      const spentStr = tt?.timeSpent || (spentSec > 0 ? formatSecondsToDuration(spentSec) : undefined);

      setTaskTimetracking({
        timeSpent: spentStr,
        remainingEstimate: remStr
      });

      const { estimate, remaining } = extractSubtaskEstimates({
        originalEstimate: origStr,
        remainingEstimate: remStr,
        originalEstimateSeconds: origSec,
        remainingEstimateSeconds: remSec
      });

      setSuggestedEstimate(estimate);
      setSuggestedRemaining(remaining);
      if (estimate && (!timeSpent || timeSpent === '1h')) {
        setTimeSpent(estimate);
      }
    } catch {
      // ignore
    }
  };

  const loadMyIssues = async () => {
    try {
      const res = await jiraApi.getMyIssues();
      const list = res.data || [];
      setMyIssues(list);
    } catch {
      // ignore
    }
  };

  const handleSelectSubtask = (st: JiraAssignedSubtask) => {
    setIssueKey(st.key);
    setIssueSummary(st.summary);
    setIssueStatus(st.status?.name || null);
    if (st.timetracking) {
      setTaskTimetracking({
        timeSpent: st.timetracking.timeSpent,
        remainingEstimate: st.timetracking.remainingEstimate
      });
      const { estimate, remaining } = extractSubtaskEstimates(st.timetracking);
      setSuggestedEstimate(estimate);
      setSuggestedRemaining(remaining);
      if (estimate) {
        setTimeSpent(estimate);
      }
    } else {
      setSuggestedEstimate(null);
      setSuggestedRemaining(null);
    }
    fetchIssueTimetracking(st.key);
  };

  if (!isOpen) return null;

  const preview = parseTimePreview(timeSpent);
  const isStatusDone = issueStatus && ['done', 'rejected', 'cancelled', 'close', 'closed'].includes(issueStatus.toLowerCase());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = issueKey.trim().toUpperCase();

    if (!cleanKey) {
      toast.error('Vui lòng chọn hoặc nhập mã Jira Issue Key');
      return;
    }

    if (!preview.valid || preview.seconds <= 0) {
      toast.error('Vui lòng nhập định dạng thời gian hợp lệ (ví dụ: "1h 30m", "45m")');
      return;
    }

    if (!started || !started.trim() || isNaN(new Date(started).getTime())) {
      toast.error('Vui lòng chọn ngày và giờ bắt đầu hợp lệ');
      return;
    }

    setLoading(true);
    try {
      const hasEstimate = Boolean(
        taskTimetracking?.remainingEstimate &&
        taskTimetracking.remainingEstimate !== 'Chưa đặt' &&
        taskTimetracking.remainingEstimate !== 'Not set' &&
        taskTimetracking.remainingEstimate !== '0m' &&
        taskTimetracking.remainingEstimate !== '0h'
      );

      await jiraApi.createWorklog(cleanKey, {
        timeSpent: timeSpent.trim(),
        timeSpentSeconds: preview.seconds,
        started: new Date(started).toISOString(),
        comment: comment.trim() || undefined,
        adjustEstimate: hasEstimate ? 'auto' : 'leave'
      });

      toast.success(`Đã ghi log thành công ${timeSpent} cho ${cleanKey}!`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Lỗi ghi log work vào Jira';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return typeof document !== 'undefined' ? createPortal(
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div 
        className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Log Work / Timesheet</h3>
              <p className="text-xs text-muted-foreground">Đồng bộ giờ làm việc trực tiếp vào Jira</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border text-xs">
            <button
              type="button"
              onClick={() => setInputMode('subtask')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
                inputMode === 'subtask'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Subtask của tôi</span>
            </button>
            <button
              type="button"
              onClick={() => setInputMode('manual')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
                inputMode === 'manual'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Nhập mã tự do</span>
            </button>
          </div>

          {/* Subtask Picker Mode */}
          {inputMode === 'subtask' ? (
            <SubtaskPicker
              selectedKey={issueKey}
              onSelectSubtask={handleSelectSubtask}
            />
          ) : (
            /* Manual Input Mode */
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Issue Key *</span>
                {issueSummary && (
                  <span className="text-[11px] text-muted-foreground truncate max-w-[240px] font-normal">
                    {issueSummary}
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={issueKey}
                  onChange={(e) => setIssueKey(e.target.value.toUpperCase())}
                  onBlur={() => {
                    if (issueKey.trim()) fetchIssueTimetracking(issueKey.trim().toUpperCase());
                  }}
                  placeholder="e.g. EMSPRO2-13222, SURV-101"
                  required
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-primary transition"
                />
              </div>

              {/* Task Time Spent & Remaining Estimate Badge */}
              {taskTimetracking && (
                <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium border border-blue-500/20">
                    <span className="text-[10px] opacity-80">Đã log:</span>
                    <span className="font-bold font-mono">{taskTimetracking.timeSpent || '0m'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20">
                    <span className="text-[10px] opacity-80">Còn lại:</span>
                    <span className="font-bold font-mono">{taskTimetracking.remainingEstimate || 'Chưa đặt'}</span>
                  </div>
                </div>
              )}

              {/* Quick Pick from My Issues */}
              {!initialIssueKey && myIssues.length > 0 && (
                <div className="pt-1.5">
                  <span className="text-[11px] text-muted-foreground block mb-1">Issue được assign gần đây:</span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {myIssues.slice(0, 6).map((iss) => (
                      <button
                        key={iss.key}
                        type="button"
                        onClick={() => {
                          setIssueKey(iss.key);
                          setIssueSummary(iss.fields.summary);
                          fetchIssueTimetracking(iss.key);
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition text-left truncate max-w-[180px] ${
                          issueKey === iss.key
                            ? 'bg-primary text-primary-foreground border-primary font-bold'
                            : 'bg-accent/50 text-foreground border-border hover:bg-accent'
                        }`}
                        title={`${iss.key}: ${iss.fields.summary}`}
                      >
                        <span className="font-mono font-bold mr-1">{iss.key}</span>
                        <span className="opacity-80">{iss.fields.summary}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Safeguard Alert in Manual Mode */}
          {inputMode === 'manual' && isStatusDone && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <span className="font-bold block">Cảnh báo: Task [{issueKey}] đang ở trạng thái "{issueStatus}"</span>
                <span className="text-[11px] opacity-90">Vui lòng kiểm tra lại để tránh log time nhầm vào task đã hoàn tất hoặc bị reject!</span>
              </div>
            </div>
          )}

          {/* Flexible Time Spent Input */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs font-bold text-foreground">Thời gian làm việc (Time Spent) *</label>
                {suggestedEstimate && (
                  <button
                    type="button"
                    onClick={() => setTimeSpent(suggestedEstimate)}
                    className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md transition cursor-pointer border ${
                      timeSpent === suggestedEstimate
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 font-bold shadow-xs'
                        : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20 font-semibold'
                    }`}
                    title="Nhấn để áp dụng thời gian Estimate của Subtask đã chọn"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Estimate: {suggestedEstimate}</span>
                  </button>
                )}
                {suggestedRemaining && suggestedRemaining !== suggestedEstimate && (
                  <button
                    type="button"
                    onClick={() => setTimeSpent(suggestedRemaining)}
                    className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md transition cursor-pointer border ${
                      timeSpent === suggestedRemaining
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 font-bold shadow-xs'
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold'
                    }`}
                    title="Nhấn để áp dụng thời gian Còn lại (Remaining) của Subtask"
                  >
                    <Clock className="w-3 h-3 text-emerald-500" />
                    <span>Còn lại: {suggestedRemaining}</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {['30m', '1h', '1h 30m', '2h', '3h 30m', '4h', '4h 30m', '7h 30m', '8h'].map((preset) => (
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
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Ngày & Giờ bắt đầu *</span>
            </label>
            <DateTimePicker
              value={started}
              onChange={setStarted}
              showTime={true}
              placeholder="Chọn ngày và giờ bắt đầu..."
            />
          </div>

          {/* Work Description Comment - OPTIONAL with Suggestions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Mô tả công việc (Không bắt buộc)</span>
              </label>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-normal">Tùy chọn</span>
            </div>

            <WorklogDescriptionSuggestions
              subtaskTitle={issueSummary}
              comment={comment}
              onCommentChange={setComment}
            />

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Không bắt buộc - Bấm chọn gợi ý bên trên hoặc tự nhập mô tả chi tiết..."
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary resize-none transition"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-border hover:bg-accent text-xs font-bold text-muted-foreground transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || !preview.valid || !issueKey.trim() || !started}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang log...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Xác Nhận Log Work</span>
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
