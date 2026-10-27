import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Plus, 
  Layers, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  User,
  Tag,
  FolderKanban,
  GitBranch,
  Clock,
  Check
} from 'lucide-react';
import { jiraApi } from '../../../services/api';
import { useJiraAuthStore } from '../../../stores/jira-auth.store';
import { 
  JiraProject, 
  JiraIssueType, 
  JiraPriority, 
  JiraAssignableUser 
} from '../../../types';
import { SearchableSelect, SelectOption } from '../../../components/ui';
import { toast } from 'react-hot-toast';

interface CreateIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (key: string) => void;
  defaultParentKey?: string;
  defaultProjectKey?: string;
  isSubtaskOnly?: boolean;
}

export const SUBTASK_TYPE_OPTIONS = [
  { id: '', label: 'None (Mặc định)' },
  { id: '10016', label: 'Developing' },
  { id: '10200', label: 'Testing' },
  { id: '10015', label: 'Create Document' },
  { id: '10031', label: 'Review Document' },
  { id: '10030', label: 'Meeting' },
  { id: '10034', label: 'Setup Environment' },
  { id: '10032', label: 'Self-learning' },
  { id: '10040', label: 'Training - Transfer' },
];

export const CreateIssueModal: React.FC<CreateIssueModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultParentKey = '',
  defaultProjectKey = '',
  isSubtaskOnly = false
}) => {
  const { user } = useJiraAuthStore();

  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [selectedProject, setSelectedProject] = useState(defaultProjectKey);
  const [issueTypes, setIssueTypes] = useState<JiraIssueType[]>([]);
  const [selectedIssueTypeId, setSelectedIssueTypeId] = useState('');
  const [priorities, setPriorities] = useState<JiraPriority[]>([]);
  const [selectedPriorityId, setSelectedPriorityId] = useState('');
  const [assignees, setAssignees] = useState<JiraAssignableUser[]>([]);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [selectedReporter, setSelectedReporter] = useState('');
  
  // Custom fields
  const [selectedSubtaskType, setSelectedSubtaskType] = useState('');
  const [originalEstimate, setOriginalEstimate] = useState('');

  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [parentKey, setParentKey] = useState(defaultParentKey);
  const [storyPoints, setStoryPoints] = useState<string>('');
  
  const [createAnother, setCreateAnother] = useState(false);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);
  
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      resetFormFields();
      setParentKey(defaultParentKey);
    }
  }, [isOpen, defaultParentKey, defaultProjectKey]);

  const resetFormFields = () => {
    setSummary('');
    setDescription('');
    setStoryPoints('');
    setOriginalEstimate('');
    setSelectedSubtaskType('');
    setSelectedAssigneeId('');
    setCreateAnother(false);
    setShowConfirmDiscard(false);
  };

  const loadInitialData = async () => {
    setLoadingMeta(true);
    try {
      const [projRes, prioRes] = await Promise.all([
        jiraApi.getProjects().catch(() => ({ data: [] })),
        jiraApi.getPriorities().catch(() => ({ data: [] }))
      ]);

      setProjects(projRes.data || []);
      setPriorities(prioRes.data || []);

      const resolvedProj = defaultProjectKey || (defaultParentKey ? defaultParentKey.split('-')[0] : '') || projRes.data?.[0]?.key || '';
      setSelectedProject(resolvedProj);

      if (prioRes.data?.length > 0) {
        // Default to Low/Medium
        const defPrio = prioRes.data.find(p => p.name.toLowerCase() === 'low') || 
                        prioRes.data.find(p => p.name.toLowerCase() === 'medium') || 
                        prioRes.data[0];
        setSelectedPriorityId(defPrio.id);
      }

      if (resolvedProj) {
        await loadProjectMeta(resolvedProj);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMeta(false);
    }
  };

  const loadProjectMeta = async (projKey: string) => {
    try {
      const [itRes, userRes] = await Promise.all([
        jiraApi.getProjectIssueTypes(projKey).catch(() => ({ data: [] })),
        jiraApi.getAssignableUsers({ project: projKey }).catch(() => ({ data: [] }))
      ]);

      const allTypes: JiraIssueType[] = itRes.data || [];
      const userList: JiraAssignableUser[] = userRes.data || [];
      setIssueTypes(allTypes);
      setAssignees(userList);

      const isSubtask = Boolean(defaultParentKey || isSubtaskOnly);
      const filteredTypes = allTypes.filter(t => isSubtask ? t.subtask : !t.subtask);
      
      if (filteredTypes.length > 0) {
        setSelectedIssueTypeId(filteredTypes[0].id);
      } else if (allTypes.length > 0) {
        setSelectedIssueTypeId(allTypes[0].id);
      }

      // Default reporter to current user if found in userList
      if (user?.displayName) {
        const foundUser = userList.find(
          u => u.displayName === user.displayName || 
               u.emailAddress === user.emailAddress ||
               (u.name && user.displayName.toLowerCase().includes(u.name.toLowerCase()))
        );
        if (foundUser) {
          setSelectedReporter(foundUser.name || foundUser.accountId);
        } else if (userList.length > 0) {
          setSelectedReporter(userList[0].name || userList[0].accountId);
        }
      } else if (userList.length > 0) {
        setSelectedReporter(userList[0].name || userList[0].accountId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleProjectChange = async (newProjKey: string) => {
    setSelectedProject(newProjKey);
    await loadProjectMeta(newProjKey);
  };

  // Assign to me helper
  const handleAssignToMe = () => {
    if (user?.displayName && assignees.length > 0) {
      const me = assignees.find(
        a => (a.displayName && a.displayName === user.displayName) ||
             (a.emailAddress && a.emailAddress === user.emailAddress) ||
             (a.name && user.displayName.toLowerCase().includes(a.name.toLowerCase()))
      );
      if (me) {
        setSelectedAssigneeId(me.name || me.accountId);
        return;
      }
    }
    // Fallback
    if (assignees.length > 0) {
      setSelectedAssigneeId(assignees[0].name || assignees[0].accountId);
    }
  };

  // Check if form has unsaved modifications
  const isFormDirty = (): boolean => {
    if (summary.trim().length > 0) return true;
    if (description.trim().length > 0) return true;
    if (originalEstimate.trim().length > 0) return true;
    if (selectedSubtaskType !== '') return true;
    if (storyPoints.trim().length > 0) return true;
    if (selectedAssigneeId !== '') return true;
    return false;
  };

  const handleRequestClose = () => {
    if (isFormDirty()) {
      setShowConfirmDiscard(true);
    } else {
      handleForceClose();
    }
  };

  const handleForceClose = () => {
    setShowConfirmDiscard(false);
    resetFormFields();
    onClose();
  };

  if (!isOpen) return null;

  const isSubtask = Boolean(parentKey || isSubtaskOnly);
  const availableTypes = issueTypes.filter(t => isSubtask ? t.subtask : !t.subtask);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) {
      toast.error('Vui lòng chọn Project');
      return;
    }
    if (!summary.trim()) {
      toast.error('Vui lòng nhập Summary / Tiêu đề');
      return;
    }
    if (isSubtask && !parentKey.trim()) {
      toast.error('Sub-task bắt buộc phải có Parent Key (ví dụ: EMSPRO2-12975)');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        projectKey: selectedProject,
        issueTypeId: selectedIssueTypeId,
        summary: summary.trim(),
        description: description.trim() || undefined,
        priorityId: selectedPriorityId || undefined,
        assigneeAccountId: selectedAssigneeId || undefined,
        assignee: selectedAssigneeId || undefined,
        reporter: selectedReporter || undefined,
        parentKey: isSubtask ? parentKey.trim().toUpperCase() : undefined,
        storyPoints: storyPoints ? parseFloat(storyPoints) : undefined,
        originalEstimate: originalEstimate.trim() || undefined,
        subtaskTypeId: isSubtask && selectedSubtaskType ? selectedSubtaskType : undefined
      };

      const res = await jiraApi.createIssue(payload);
      const createdKey = res.data?.key;

      toast.success(`Đã tạo thành công ${createdKey}!`);
      onSuccess?.(createdKey);

      if (createAnother) {
        // Reset inputs for next task but keep parent/project/assignee/reporter
        setSummary('');
        setDescription('');
        setOriginalEstimate('');
        setSelectedSubtaskType('');
      } else {
        resetFormFields();
        onClose();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Không thể tạo task trong Jira';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const projectOptions = useMemo<SelectOption<string>[]>(() => {
    return projects.map((p) => ({
      value: p.key,
      label: p.name,
      sublabel: p.key,
    }));
  }, [projects]);

  const issueTypeOptions = useMemo<SelectOption<string>[]>(() => {
    const list = availableTypes.length > 0 ? availableTypes : issueTypes;
    return list.map((t) => ({
      value: t.id,
      label: t.name,
      badge: t.subtask ? 'Subtask' : undefined,
      badgeColor: t.subtask ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' : undefined,
    }));
  }, [availableTypes, issueTypes]);

  const subtaskTypeOptions = useMemo<SelectOption<string>[]>(() => {
    return SUBTASK_TYPE_OPTIONS.map((opt) => ({
      value: opt.id,
      label: opt.label,
    }));
  }, []);

  const assigneeOptions = useMemo<SelectOption<string>[]>(() => {
    return [
      { value: '', label: 'Automatic / Unassigned' },
      ...assignees.map((u) => {
        const val = u.name || u.accountId || '';
        return {
          value: val,
          label: u.displayName,
          sublabel: u.name && u.name !== u.displayName ? `@${u.name}` : undefined,
          avatarUrl: u.avatarUrls?.['24x24'] || u.avatarUrls?.['32x32'],
        };
      }),
    ];
  }, [assignees]);

  const reporterOptions = useMemo<SelectOption<string>[]>(() => {
    return assignees.map((u) => {
      const val = u.name || u.accountId || '';
      return {
        value: val,
        label: u.displayName,
        sublabel: u.name && u.name !== u.displayName ? `@${u.name}` : undefined,
        avatarUrl: u.avatarUrls?.['24x24'] || u.avatarUrls?.['32x32'],
      };
    });
  }, [assignees]);

  const priorityOptions = useMemo<SelectOption<string>[]>(() => {
    return priorities.map((p) => ({
      value: p.id,
      label: p.name,
    }));
  }, [priorities]);

  return typeof document !== 'undefined' ? createPortal(
    <>
      <div 
        className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
      >
        <div 
          className="bg-card border border-border rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-muted/30 gap-2 shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                isSubtask 
                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' 
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              }`}>
                {isSubtask ? <GitBranch className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-foreground truncate">
                    {isSubtask ? `Create Subtask : ${parentKey || defaultParentKey}` : 'Create Issue / User Story'}
                  </h3>
                  {isSubtask && parentKey && (
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      {parentKey}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {isSubtask 
                    ? `Tạo công việc con liên kết với task chính ${parentKey || defaultParentKey}` 
                    : 'Tạo mới User Story hoặc standard task trong dự án'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRequestClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition shrink-0"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
            {/* Project (only show if not standard subtask modal) */}
            {!isSubtask && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FolderKanban className="w-3.5 h-3.5 text-blue-500" />
                  <span>Project *</span>
                </label>
                <SearchableSelect
                  options={projectOptions}
                  value={selectedProject}
                  onChange={(val) => handleProjectChange(val)}
                  placeholder="Chọn dự án..."
                  searchPlaceholder="Tìm kiếm dự án..."
                  size="sm"
                />
              </div>
            )}

            {/* Row 1: Issue Type & Sub-task Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Issue Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-500" />
                  <span>Issue Type *</span>
                </label>
                <SearchableSelect
                  options={issueTypeOptions}
                  value={selectedIssueTypeId}
                  onChange={(val) => setSelectedIssueTypeId(val)}
                  placeholder="Chọn issue type..."
                  searchable={issueTypeOptions.length > 5}
                  size="sm"
                />
              </div>

              {/* Sub-task Type (Custom Field customfield_10214) */}
              {isSubtask ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-purple-500" />
                    <span>Sub-task Type</span>
                  </label>
                  <SearchableSelect
                    options={subtaskTypeOptions}
                    value={selectedSubtaskType}
                    onChange={(val) => setSelectedSubtaskType(val)}
                    placeholder="Chọn subtask type..."
                    searchable={false}
                    size="sm"
                  />
                </div>
              ) : (
                /* Story points for US */
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Story Points</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={storyPoints}
                    onChange={(e) => setStoryPoints(e.target.value)}
                    placeholder="e.g. 1, 2, 3, 5, 8"
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-primary transition"
                  />
                </div>
              )}
            </div>

            {/* Parent Key (if not preset or editable) */}
            {isSubtask && !defaultParentKey && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-purple-500" />
                  <span>Parent Issue Key *</span>
                </label>
                <input
                  type="text"
                  value={parentKey}
                  onChange={(e) => setParentKey(e.target.value.toUpperCase())}
                  placeholder="e.g. EMSPRO2-12975"
                  required
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs font-mono uppercase focus:outline-none focus:border-primary transition"
                />
              </div>
            )}

            {/* Row 2: Summary / Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Summary *</span>
                <span className="text-[11px] text-muted-foreground font-normal">Tiêu đề ngắn gọn của task</span>
              </label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder={isSubtask ? "e.g. [Review Code] Review Code và Manual code FE" : "e.g. Implement questionnaire survey results download"}
                required
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-primary transition"
              />
            </div>

            {/* Row 3: Assignee & Reporter */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Assignee */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-purple-500" />
                    <span>Assignee</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAssignToMe}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                  >
                    Assign to me
                  </button>
                </div>
                <SearchableSelect
                  options={assigneeOptions}
                  value={selectedAssigneeId}
                  onChange={(val) => setSelectedAssigneeId(val)}
                  placeholder="Automatic / Unassigned"
                  searchPlaceholder="Tìm theo tên thành viên..."
                  size="sm"
                />
              </div>

              {/* Reporter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Reporter *</span>
                </label>
                <SearchableSelect
                  options={reporterOptions}
                  value={selectedReporter}
                  onChange={(val) => setSelectedReporter(val)}
                  placeholder="Chọn reporter..."
                  searchPlaceholder="Tìm theo tên reporter..."
                  size="sm"
                />
              </div>
            </div>

            {/* Row 4: Original Estimate & Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Original Estimate */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Original Estimate</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    (e.g. 4h, 1d 4h, 30m)
                  </span>
                </label>
                <input
                  type="text"
                  value={originalEstimate}
                  onChange={(e) => setOriginalEstimate(e.target.value)}
                  placeholder="eg. 3w 4d 12h, 4h, 1d..."
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-primary transition font-mono"
                />
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Priority</label>
                <SearchableSelect
                  options={priorityOptions}
                  value={selectedPriorityId}
                  onChange={(val) => setSelectedPriorityId(val)}
                  placeholder="Chọn priority..."
                  searchable={false}
                  size="sm"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Description</span>
                <span className="text-[11px] text-muted-foreground font-normal">Mô tả công việc cần làm</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Nhập chi tiết mô tả sub-task, tiêu chí hoàn thành, lưu ý kỹ thuật..."
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-primary resize-none transition"
              />
            </div>

            {/* Footer / Action Buttons */}
            <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={createAnother}
                  onChange={(e) => setCreateAnother(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-0 cursor-pointer"
                />
                <span>Create another (Tạo tiếp sub-task khác sau khi lưu)</span>
              </label>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleRequestClose}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !summary.trim() || (isSubtask && !parentKey.trim())}
                  className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs transition shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      <span>Creating in Jira...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>{isSubtask ? 'Create Sub-task' : 'Create Issue'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Dirty Check Discard Confirmation Modal */}
      {showConfirmDiscard && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowConfirmDiscard(false)}
        >
          <div 
            className="bg-card border border-border rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 min-w-0 flex-1">
                <h4 className="text-sm sm:text-base font-extrabold text-foreground">
                  Xác nhận hủy thay đổi?
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Bạn có các thông tin đã nhập vào form tạo Sub-task. Nếu đóng bây giờ, toàn bộ nội dung bạn đã nhập sẽ bị mất và không thể khôi phục.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowConfirmDiscard(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-accent hover:bg-accent/80 text-foreground transition"
              >
                Tiếp tục chỉnh sửa
              </button>
              <button
                type="button"
                onClick={handleForceClose}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white transition shadow-sm"
              >
                Đóng và Bỏ thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  ) : null;
};
