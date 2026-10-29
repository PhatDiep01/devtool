import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Bookmark, 
  Clock, 
  User, 
  AlertCircle, 
  Sparkles, 
  Tag, 
  FileText,
  Save,
  CheckCircle2,
  UserCheck
} from 'lucide-react';
import { jiraApi } from '../../../services/api';
import { JiraIssue, JiraPriority, JiraAssignableUser } from '../../../types';
import { ConfirmModal, SearchableSelect, SelectOption } from '../../../components/ui';
import { useJiraAuthStore } from '../../../stores/jira-auth.store';
import { formatSecondsToDuration } from '../../../utils/jiraTime';
import { toast } from 'react-hot-toast';

export interface EditStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  story: JiraIssue | null;
}

function extractPlainDescription(desc: any): string {
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  if (Array.isArray(desc.content)) {
    return desc.content
      .map((c: any) => {
        if (c.type === 'paragraph' && Array.isArray(c.content)) {
          return c.content.map((n: any) => n.text || '').join('');
        }
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }
  return '';
}

export const EditStoryModal: React.FC<EditStoryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  story
}) => {
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [storyPoints, setStoryPoints] = useState<string>('');
  const [originalEstimate, setOriginalEstimate] = useState<string>('');
  const [priorityId, setPriorityId] = useState<string>('');
  const [assignee, setAssignee] = useState<string>('');

  const [priorities, setPriorities] = useState<JiraPriority[]>([]);
  const [assignees, setAssignees] = useState<JiraAssignableUser[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const { user } = useJiraAuthStore();

  // Find current user object among project assignees
  const currentUser = useMemo(() => {
    if (!user || !assignees.length) return null;
    return assignees.find(
      a => (a.name && user.username && a.name.toLowerCase() === user.username.toLowerCase()) ||
           (a.key && user.username && a.key.toLowerCase() === user.username.toLowerCase()) ||
           (a.displayName && user.displayName && a.displayName.toLowerCase() === user.displayName.toLowerCase()) ||
           (a.emailAddress && user.emailAddress && a.emailAddress.toLowerCase() === user.emailAddress.toLowerCase()) ||
           (a.name && user.displayName && user.displayName.toLowerCase().includes(a.name.toLowerCase())) ||
           (a.accountId && (a.accountId === user.username || a.accountId === (user as any).accountId))
    ) || null;
  }, [user, assignees]);

  // Clickable Assign to me action
  const handleAssignToMe = () => {
    if (currentUser) {
      setAssignee(currentUser.name || currentUser.key || currentUser.accountId || '');
    } else if (user?.username) {
      setAssignee(user.username);
    }
  };

  // Assignee options with "Assign to me" at the top
  const assigneeOptions = useMemo<SelectOption<string>[]>(() => {
    const list: SelectOption<string>[] = [
      { 
        value: '', 
        label: 'Chưa gán (Unassigned)',
        sublabel: 'Không phân công người thực hiện'
      }
    ];

    // Priority "Assign to me" option at the top of the list
    if (currentUser) {
      const myVal = currentUser.name || currentUser.key || currentUser.accountId || '';
      list.push({
        value: myVal,
        label: `⚡ Assign to me (${currentUser.displayName})`,
        sublabel: currentUser.name ? `@${currentUser.name}` : currentUser.emailAddress,
        avatarUrl: currentUser.avatarUrls?.['24x24'] || currentUser.avatarUrls?.['32x32'],
        badge: 'Tôi',
        badgeColor: 'bg-primary/15 text-primary border border-primary/25 font-bold'
      });
    } else if (user?.displayName || user?.username) {
      list.push({
        value: user.username || '',
        label: `⚡ Assign to me (${user.displayName || user.username})`,
        sublabel: user.username ? `@${user.username}` : user.emailAddress,
        avatarUrl: user.avatarUrl,
        badge: 'Tôi',
        badgeColor: 'bg-primary/15 text-primary border border-primary/25 font-bold'
      });
    }

    // All project assignees
    assignees.forEach((u) => {
      const val = u.name || u.key || u.accountId || '';
      list.push({
        value: val,
        label: u.displayName,
        sublabel: u.name && u.name !== u.displayName ? `@${u.name}` : u.emailAddress,
        avatarUrl: u.avatarUrls?.['24x24'] || u.avatarUrls?.['32x32']
      });
    });

    return list;
  }, [assignees, currentUser, user]);

  useEffect(() => {
    if (isOpen && story) {
      setSummary(story.fields.summary || '');
      setDescription(extractPlainDescription(story.fields.description));
      
      const pts = story.fields.customfield_10016 ?? story.fields.customfield_10026 ?? story.fields.storyPoints;
      setStoryPoints(pts !== undefined && pts !== null ? String(pts) : '');

      const estSec = story.fields.timetracking?.originalEstimateSeconds || story.fields.timeoriginalestimate;
      const estStr = estSec ? formatSecondsToDuration(estSec) : (story.fields.timetracking?.originalEstimate || '');
      setOriginalEstimate(estStr && estStr !== 'None' ? estStr : '');

      setPriorityId(story.fields.priority?.id || '');
      
      const assignVal = story.fields.assignee?.name || story.fields.assignee?.key || story.fields.assignee?.accountId || '';
      setAssignee(assignVal);

      setShowConfirmModal(false);
      loadMetadata(story);
    }
  }, [isOpen, story]);

  const loadMetadata = async (curStory: JiraIssue) => {
    setLoadingMeta(true);
    try {
      const projectKey = curStory.fields.project?.key || curStory.key.split('-')[0];
      const [priosRes, usersRes] = await Promise.all([
        jiraApi.getPriorities().catch(() => ({ data: [] })),
        jiraApi.getAssignableUsers({ project: projectKey, issueKey: curStory.key }).catch(() => ({ data: [] }))
      ]);
      setPriorities(priosRes.data || []);
      setAssignees(usersRes.data || []);
    } catch (err) {
      console.warn('Could not load edit story metadata:', err);
    } finally {
      setLoadingMeta(false);
    }
  };

  if (!isOpen || !story) return null;

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) {
      toast.error('Vui lòng nhập Tiêu đề / Summary cho User Story');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    setSubmitting(true);
    try {
      const payload: any = {
        summary: summary.trim(),
        description: description.trim() || '',
        storyPoints: storyPoints.trim() ? parseFloat(storyPoints.trim()) : null,
        originalEstimate: originalEstimate.trim() || undefined,
        priorityId: priorityId || undefined,
        assignee: assignee || null
      };

      await jiraApi.updateIssue(story.key, payload);
      toast.success(`Đã cập nhật User Story ${story.key} thành công!`);
      setShowConfirmModal(false);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Cập nhật thất bại';
      toast.error(`Lỗi cập nhật: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return typeof document !== 'undefined' ? createPortal(
    <div 
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-card border border-border rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs bg-accent text-foreground px-2 py-0.5 rounded">
                  {story.key}
                </span>
                <span className="text-xs text-muted-foreground font-semibold">User Story</span>
              </div>
              <h3 className="font-bold text-sm sm:text-base text-foreground truncate max-w-sm">
                Chỉnh sửa User Story
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleOpenConfirm} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Summary */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>Tiêu đề User Story (Summary) *</span>
              <span className="text-[10px] text-muted-foreground font-normal">Bắt buộc</span>
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Nhập tiêu đề User Story..."
              required
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:border-primary transition"
              autoFocus
            />
          </div>

          {/* Row: Story Points & Original Estimate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Story Points */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">Story Points</label>
                <div className="flex items-center gap-1">
                  {['1', '2', '3', '5', '8'].map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setStoryPoints(pt)}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono transition ${
                        storyPoints === pt
                          ? 'bg-primary text-primary-foreground font-bold'
                          : 'bg-muted hover:bg-accent text-muted-foreground'
                      }`}
                    >
                      {pt}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                step="0.5"
                min="0"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                placeholder="e.g. 1, 2, 3, 5, 8"
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-primary transition"
              />
            </div>

            {/* Original Estimate */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-500" />
                  <span>Estimate</span>
                </label>
                <div className="flex items-center gap-1">
                  {['1h', '2h', '4h', '8h'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setOriginalEstimate(preset)}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono transition ${
                        originalEstimate === preset
                          ? 'bg-amber-500 text-white font-bold'
                          : 'bg-muted hover:bg-accent text-muted-foreground'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                value={originalEstimate}
                onChange={(e) => setOriginalEstimate(e.target.value)}
                placeholder="Ví dụ: 4h, 1d, 2h 30m"
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-primary transition"
              />
            </div>
          </div>

          {/* Row: Priority & Assignee */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Mức độ ưu tiên (Priority)</label>
              <select
                value={priorityId}
                onChange={(e) => setPriorityId(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-primary transition cursor-pointer"
              >
                <option value="">(Mặc định)</option>
                {priorities.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-500" />
                  <span>Người thực hiện (Assignee)</span>
                </label>
                <button
                  type="button"
                  onClick={handleAssignToMe}
                  className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 transition cursor-pointer"
                  title="Gán nhanh cho chính bạn"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Assign to me</span>
                </button>
              </div>
              <SearchableSelect
                options={assigneeOptions}
                value={assignee}
                onChange={(val) => setAssignee(String(val || ''))}
                placeholder="Chọn người thực hiện..."
                searchPlaceholder="Tìm theo tên thành viên..."
                size="sm"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3 text-muted-foreground" />
                <span>Mô tả chi tiết (Description)</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-normal">Tùy chọn</span>
            </label>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Nhập mô tả nghiệp vụ hoặc tiêu chuẩn hoàn thành (Acceptance Criteria)..."
              className="w-full bg-background border border-border rounded-xl p-3 text-xs leading-relaxed focus:outline-none focus:border-primary transition resize-y"
            />
          </div>

          {/* Actions Footer */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting || !summary.trim()}
              className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal when saving edit */}
      <ConfirmModal
        isOpen={showConfirmModal}
        title={`Xác nhận cập nhật User Story ${story.key}`}
        description={(
          <div className="space-y-1.5">
            <p>
              Bạn có chắc chắn muốn cập nhật thông tin cho User Story <strong className="text-foreground">{story.key}</strong> không?
            </p>
            <div className="p-2.5 rounded-xl bg-muted/60 border border-border text-[11px] space-y-1">
              <div>
                <span className="text-muted-foreground">Tiêu đề mới:</span>{' '}
                <span className="font-semibold text-foreground">{summary}</span>
              </div>
              {storyPoints && (
                <div>
                  <span className="text-muted-foreground">Story Points:</span>{' '}
                  <span className="font-mono font-bold text-foreground">{storyPoints} pts</span>
                </div>
              )}
              {originalEstimate && (
                <div>
                  <span className="text-muted-foreground">Estimate:</span>{' '}
                  <span className="font-mono font-bold text-foreground">{originalEstimate}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Assignee:</span>{' '}
                <span className="font-semibold text-foreground">
                  {assignee
                    ? (assignees.find(u => (u.name || u.key || u.accountId) === assignee)?.displayName || (assignee === currentUser?.name ? currentUser?.displayName : assignee))
                    : <span className="italic text-muted-foreground font-normal">Chưa gán (Unassigned)</span>}
                </span>
              </div>
            </div>
          </div>
        )}
        confirmText="Xác nhận lưu"
        cancelText="Quay lại"
        variant="primary"
        loading={submitting}
        onConfirm={handleConfirmSave}
        onClose={() => setShowConfirmModal(false)}
      />
    </div>,
    document.body
  ) : null;
};
