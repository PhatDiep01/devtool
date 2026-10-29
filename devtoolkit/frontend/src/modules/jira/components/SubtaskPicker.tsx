import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Layers,
  ChevronDown,
  Check,
  Calendar
} from 'lucide-react';
import { jiraApi } from '../../../services/api';
import { JiraAssignedSubtask } from '../../../types';
import { extractSubtaskEstimates } from '../../../utils/jiraTime';

interface SubtaskPickerProps {
  selectedKey: string;
  onSelectSubtask: (subtask: JiraAssignedSubtask) => void;
  onClearSelection?: () => void;
}

export const SubtaskPicker: React.FC<SubtaskPickerProps> = ({
  selectedKey,
  onSelectSubtask,
  onClearSelection
}) => {
  const [subtasks, setSubtasks] = useState<JiraAssignedSubtask[]>([]);
  const [loading, setLoading] = useState(false);
  // Default filter: 'active' (Todo / In Progress) as requested by user to avoid done/reject
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'done'>('active');
  const [dueTodayOnly, setDueTodayOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const getTodayStr = (): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const todayStr = getTodayStr();

  useEffect(() => {
    loadSubtasks();
  }, [statusFilter, dueTodayOnly]);

  const loadSubtasks = async () => {
    setLoading(true);
    try {
      const res = await jiraApi.getMySubtasks({
        status: statusFilter,
        limit: 50,
        dueToday: dueTodayOnly || undefined
      });
      setSubtasks(res.data || []);
    } catch (err) {
      console.error('Failed to load assigned subtasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubtasks = subtasks.filter((st) => {
    if (dueTodayOnly) {
      if (!st.duedate || !st.duedate.startsWith(todayStr)) {
        return false;
      }
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      st.key.toLowerCase().includes(q) ||
      st.summary.toLowerCase().includes(q) ||
      (st.parent && st.parent.key.toLowerCase().includes(q)) ||
      (st.parent && st.parent.summary.toLowerCase().includes(q))
    );
  });

  const dueTodayCount = subtasks.filter(st => st.duedate && st.duedate.startsWith(todayStr)).length;

  const selectedSubtask = subtasks.find(s => s.key === selectedKey);
  const isSelectedDone = selectedSubtask?.status?.statusCategory?.key === 'done' || 
    ['done', 'rejected', 'cancelled', 'close', 'closed'].includes((selectedSubtask?.status?.name || '').toLowerCase());

  // Helper for status badge colors
  const getStatusBadgeClass = (statusCat?: string, statusName: string = '') => {
    const sLow = statusName.toLowerCase();
    if (statusCat === 'done' || sLow.includes('done') || sLow.includes('cancel') || sLow.includes('reject')) {
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    }
    if (sLow.includes('fe') || sLow.includes('be') || sLow.includes('progress') || sLow.includes('dev')) {
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    }
    if (sLow.includes('review') || sLow.includes('test')) {
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    }
    return 'bg-muted text-muted-foreground border-border';
  };

  return (
    <div className="space-y-2">
      {/* Label & Status Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <GitBranch className="w-3.5 h-3.5 text-indigo-500" />
          <span>Chọn Subtask được Assign *</span>
        </label>

        {/* Status Filter Tabs (Default: Đang làm - To Do / In Progress) */}
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-xl border border-border text-[10px]">
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-2 py-0.8 rounded-lg font-bold transition ${
              statusFilter === 'active'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Mặc định: Chỉ hiện các Subtask To Do, In Progress (tránh Done/Reject)"
          >
            Đang làm (Todo/In Progress)
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2 py-0.8 rounded-lg font-semibold transition ${
              statusFilter === 'all'
                ? 'bg-card text-foreground font-bold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('done')}
            className={`px-2 py-0.8 rounded-lg font-semibold transition ${
              statusFilter === 'done'
                ? 'bg-card text-foreground font-bold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Đã Done
          </button>
        </div>
      </div>

      {/* Due Today Filter Checkbox */}
      <div className="flex items-center justify-between p-2 rounded-xl bg-accent/40 border border-border/80">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs text-foreground group">
          <input
            type="checkbox"
            checked={dueTodayOnly}
            onChange={(e) => setDueTodayOnly(e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer mt-0.5 shrink-0"
          />
          <span className="font-semibold flex items-center gap-1.5 group-hover:text-primary transition-colors">
            <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Ngày hôm nay (Chỉ lọc subtask có Due Date là hôm nay)</span>
          </span>
        </label>
        {dueTodayCount > 0 ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
            {dueTodayCount} hôm nay
          </span>
        ) : null}
      </div>

      {/* Main Select Button / Trigger */}
      <div className="relative">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full bg-background border rounded-2xl p-3 text-left transition cursor-pointer flex items-center justify-between gap-2 shadow-xs ${
            isOpen ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-border/80'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <GitBranch className="w-4 h-4" />
            </div>

            {selectedKey ? (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-xs text-foreground bg-accent px-2 py-0.5 rounded">
                    {selectedKey}
                  </span>
                  {selectedSubtask && (
                    <>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                        getStatusBadgeClass(selectedSubtask.status?.statusCategory?.key, selectedSubtask.status?.name)
                      }`}>
                        {selectedSubtask.status?.name}
                      </span>
                      {selectedSubtask.duedate && (
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border flex items-center gap-1 ${
                          selectedSubtask.duedate.startsWith(todayStr)
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}>
                          <Calendar className="w-2.5 h-2.5 text-amber-500" />
                          <span>Due: {selectedSubtask.duedate}{selectedSubtask.duedate.startsWith(todayStr) ? ' (Hôm nay)' : ''}</span>
                        </span>
                      )}
                      {(() => {
                        const ests = extractSubtaskEstimates(selectedSubtask.timetracking);
                        return ests.estimate ? (
                          <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded shrink-0" title="Thời gian ước tính (Estimate)">
                            Est: {ests.estimate}
                          </span>
                        ) : null;
                      })()}
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {selectedSubtask?.summary || 'Đã chọn issue'}
                </p>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Nhấn để chọn Subtask được giao cho bạn...</span>
                <span className="block text-[10px] opacity-70">
                  {loading ? 'Đang tải danh sách subtask...' : `${filteredSubtasks.length} subtask phù hợp`}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180 text-primary' : ''}`} />
          </div>
        </div>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Search Input */}
            <div className="p-2.5 border-b border-border bg-muted/30">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo mã subtask, tên công việc hoặc story cha..."
                  className="w-full bg-background border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-primary"
                  autoFocus
                />
              </div>
            </div>

            {/* Subtasks List */}
            <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
              {loading ? (
                <div className="p-6 text-center text-xs text-muted-foreground flex flex-col items-center justify-center space-y-2">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span>Đang tải subtask từ Jira...</span>
                </div>
              ) : filteredSubtasks.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground space-y-1.5">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto opacity-70" />
                  <p className="font-medium text-foreground">Không tìm thấy subtask nào</p>
                  <p className="text-[11px]">
                    {dueTodayOnly
                      ? 'Không có Subtask nào có hạn chót (Due date) được đặt là hôm nay.'
                      : statusFilter === 'active'
                      ? 'Bạn hiện không có subtask nào ở trạng thái Todo/In Progress. Bạn có thể bấm tab "Tất cả" phía trên để xem các subtask khác.'
                      : 'Không có subtask nào khớp với từ khóa tìm kiếm.'}
                  </p>
                  {dueTodayOnly && (
                    <button
                      type="button"
                      onClick={() => setDueTodayOnly(false)}
                      className="px-3 py-1 bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/30 text-[11px] font-bold rounded-lg mt-1"
                    >
                      Bỏ lọc hôm nay
                    </button>
                  )}
                  {!dueTodayOnly && statusFilter === 'active' && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter('all')}
                      className="px-3 py-1 bg-accent hover:bg-accent/80 text-foreground text-[11px] font-bold rounded-lg mt-1"
                    >
                      Chuyển sang "Tất cả"
                    </button>
                  )}
                </div>
              ) : (
                filteredSubtasks.map((st) => {
                  const isCurSelected = st.key === selectedKey;
                  const isStDone = st.status?.statusCategory?.key === 'done' || 
                    ['done', 'rejected', 'cancelled', 'close', 'closed'].includes((st.status?.name || '').toLowerCase());

                  return (
                    <div
                      key={st.key}
                      onClick={() => {
                        onSelectSubtask(st);
                        setIsOpen(false);
                      }}
                      className={`p-2.5 rounded-xl border transition cursor-pointer text-left space-y-1.5 group ${
                        isCurSelected
                          ? 'bg-primary/10 border-primary shadow-xs'
                          : 'bg-card border-transparent hover:border-border hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono font-bold text-xs text-primary group-hover:underline">
                            {st.key}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                            getStatusBadgeClass(st.status?.statusCategory?.key, st.status?.name)
                          }`}>
                            {st.status?.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          {st.duedate && (
                            <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded border flex items-center gap-1 ${
                              st.duedate.startsWith(todayStr)
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold'
                                : 'bg-muted text-muted-foreground border-border'
                            }`}>
                              <Calendar className="w-2.5 h-2.5 text-amber-500" />
                              <span>Due: {st.duedate}{st.duedate.startsWith(todayStr) ? ' (Hôm nay)' : ''}</span>
                            </span>
                          )}
                          {st.timetracking?.timeSpent && (
                            <span className="text-[10px] font-mono font-semibold text-muted-foreground bg-muted px-1.5 py-0.2 rounded shrink-0">
                              Logged: {st.timetracking.timeSpent}
                            </span>
                          )}
                          {(() => {
                            const ests = extractSubtaskEstimates(st.timetracking);
                            return ests.estimate ? (
                              <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded shrink-0" title="Thời gian ước tính (Estimate)">
                                Est: {ests.estimate}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>

                      {/* Summary */}
                      <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">
                        {st.summary}
                      </p>

                      {/* Parent Story Info */}
                      {st.parent && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-0.5 truncate">
                          <Layers className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span className="font-mono font-medium">{st.parent.key}:</span>
                          <span className="truncate">{st.parent.summary}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer with Refresh */}
            <div className="p-2 border-t border-border bg-muted/40 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{filteredSubtasks.length} subtasks</span>
              <button
                type="button"
                onClick={loadSubtasks}
                className="hover:text-foreground flex items-center gap-1 font-semibold"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Làm mới</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Safeguard Warning Banner if Selected Task is Done or Rejected */}
      {selectedKey && isSelectedDone && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2.5 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
          <div className="space-y-0.5">
            <span className="font-bold block">
              Lưu ý: Task [{selectedKey}] đang ở trạng thái "{selectedSubtask?.status?.name || 'Done'}"!
            </span>
            <p className="text-[11px] opacity-90 leading-relaxed">
              Bạn đang chọn một task đã hoàn tất hoặc bị reject. Hãy chắc chắn rằng bạn muốn log time bổ sung vào task này để tránh nhầm lẫn tiến độ.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
