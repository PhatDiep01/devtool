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
  Check
} from 'lucide-react';
import { jiraApi } from '../../../services/api';
import { JiraAssignedSubtask } from '../../../types';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadSubtasks();
  }, [statusFilter]);

  const loadSubtasks = async () => {
    setLoading(true);
    try {
      const res = await jiraApi.getMySubtasks({
        status: statusFilter,
        limit: 50
      });
      setSubtasks(res.data || []);
    } catch (err) {
      console.error('Failed to load assigned subtasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubtasks = subtasks.filter((st) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      st.key.toLowerCase().includes(q) ||
      st.summary.toLowerCase().includes(q) ||
      (st.parent && st.parent.key.toLowerCase().includes(q)) ||
      (st.parent && st.parent.summary.toLowerCase().includes(q))
    );
  });

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
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-foreground bg-accent px-2 py-0.5 rounded">
                    {selectedKey}
                  </span>
                  {selectedSubtask && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                      getStatusBadgeClass(selectedSubtask.status?.statusCategory?.key, selectedSubtask.status?.name)
                    }`}>
                      {selectedSubtask.status?.name}
                    </span>
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
                  {loading ? 'Đang tải danh sách subtask...' : `${subtasks.length} subtask phù hợp`}
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
                    {statusFilter === 'active'
                      ? 'Bạn hiện không có subtask nào ở trạng thái Todo/In Progress. Bạn có thể bấm tab "Tất cả" phía trên để xem các subtask khác.'
                      : 'Không có subtask nào khớp với từ khóa tìm kiếm.'}
                  </p>
                  {statusFilter === 'active' && (
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

                        {st.timetracking?.timeSpent && (
                          <span className="text-[10px] font-mono font-semibold text-muted-foreground bg-muted px-1.5 py-0.2 rounded shrink-0">
                            Logged: {st.timetracking.timeSpent}
                          </span>
                        )}
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
