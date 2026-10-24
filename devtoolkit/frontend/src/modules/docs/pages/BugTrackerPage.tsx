import React, { useState, useEffect, useRef } from 'react';
import { 
  Bug, 
  Plus, 
  Search, 
  Filter, 
  ExternalLink, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  AlertCircle, 
  Check, 
  ArrowRight, 
  Upload, 
  X, 
  Image as ImageIcon, 
  Paperclip, 
  Download, 
  ZoomIn, 
  FileText, 
  FileSpreadsheet, 
  File as FileIcon,
  Eye, 
  RefreshCw, 
  LayoutGrid, 
  List,
  Sparkles,
  Link as LinkIcon,
  User,
  ShieldAlert
} from 'lucide-react';
import { bugsApi, resolveApiUrl } from '../../../services/api';
import { BugItem, BugStats, BugType, BugStatus, BugSeverity, BugAttachment } from '../../../types';
import { SearchableSelect, SelectOption } from '../../../components/ui';
import { toast } from 'react-hot-toast';

const statusFilterOptions: SelectOption<string>[] = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'todo', label: 'Chưa fix (Todo)', badge: 'Todo', badgeColor: 'bg-muted text-muted-foreground' },
  { value: 'in_progress', label: 'Đang fix (In Progress)', badge: 'In Progress', badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  { value: 'resolved', label: 'Đã fix (Resolved)', badge: 'Resolved', badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
];

const typeFilterOptions: SelectOption<string>[] = [
  { value: 'all', label: 'Tất cả loại' },
  { value: 'FE', label: 'Frontend (FE)', badge: 'FE', badgeColor: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
  { value: 'BE', label: 'Backend (BE)', badge: 'BE', badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
];

const severityFilterOptions: SelectOption<string>[] = [
  { value: 'all', label: 'Mọi mức độ' },
  { value: 'critical', label: 'Khẩn cấp', badge: 'Critical', badgeColor: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  { value: 'high', label: 'Cao', badge: 'High', badgeColor: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
  { value: 'medium', label: 'Trung bình', badge: 'Medium', badgeColor: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' },
  { value: 'low', label: 'Thấp', badge: 'Low', badgeColor: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' },
];

const formStatusOptions: SelectOption<BugStatus>[] = [
  { value: 'todo', label: 'Chưa fix (Todo)' },
  { value: 'in_progress', label: 'Đang fix (In Progress)' },
  { value: 'resolved', label: 'Đã fix (Resolved)' },
];

const formSeverityOptions: SelectOption<BugSeverity>[] = [
  { value: 'critical', label: 'Khẩn cấp (Critical)', badge: 'Critical', badgeColor: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  { value: 'high', label: 'Cao (High)', badge: 'High', badgeColor: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
  { value: 'medium', label: 'Trung bình (Medium)', badge: 'Medium', badgeColor: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' },
  { value: 'low', label: 'Thấp (Low)', badge: 'Low', badgeColor: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' },
];

export const BugTrackerPage: React.FC = () => {
  const [bugs, setBugs] = useState<BugItem[]>([]);
  const [stats, setStats] = useState<BugStats>({
    total: 0,
    todo: 0,
    in_progress: 0,
    resolved: 0,
    fe_count: 0,
    be_count: 0,
    both_count: 0
  });
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingBug, setEditingBug] = useState<BugItem | null>(null);
  const [selectedBug, setSelectedBug] = useState<BugItem | null>(null);

  // Image preview lightbox
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Form inputs
  const [formTitle, setFormTitle] = useState('');
  const [formUsKey, setFormUsKey] = useState('');
  const [formUsLink, setFormUsLink] = useState('');
  const [formType, setFormType] = useState<BugType>('FE');
  const [formStatus, setFormStatus] = useState<BugStatus>('todo');
  const [formSeverity, setFormSeverity] = useState<BugSeverity>('medium');
  const [formDescription, setFormDescription] = useState('');
  const [formFixSolution, setFormFixSolution] = useState('');
  const [formCreatedBy, setFormCreatedBy] = useState('QA/QC');
  const [formAssignedTo, setFormAssignedTo] = useState('');
  const [formAttachments, setFormAttachments] = useState<BugAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBugs();
  }, [statusFilter, typeFilter, severityFilter]);

  const loadBugs = async () => {
    setLoading(true);
    try {
      const res = await bugsApi.getAll({
        search: searchQuery,
        status: statusFilter,
        type: typeFilter,
        severity: severityFilter
      });
      setBugs(res.data.bugs || []);
      setStats(res.data.stats || {
        total: 0,
        todo: 0,
        in_progress: 0,
        resolved: 0,
        fe_count: 0,
        be_count: 0,
        both_count: 0
      });
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải danh sách bug');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadBugs();
  };

  const openCreateModal = () => {
    setEditingBug(null);
    setFormTitle('');
    setFormUsKey('');
    setFormUsLink('');
    setFormType('FE');
    setFormStatus('todo');
    setFormSeverity('medium');
    setFormDescription('');
    setFormFixSolution('');
    setFormCreatedBy('QA/QC');
    setFormAssignedTo('');
    setFormAttachments([]);
    setIsFormModalOpen(true);
  };

  const openEditModal = (bug: BugItem) => {
    setEditingBug(bug);
    setFormTitle(bug.title);
    setFormUsKey(bug.us_key || '');
    setFormUsLink(bug.us_link || '');
    setFormType(bug.type);
    setFormStatus(bug.status);
    setFormSeverity(bug.severity);
    setFormDescription(bug.description || '');
    setFormFixSolution(bug.fix_solution || '');
    setFormCreatedBy(bug.created_by || 'QA/QC');
    setFormAssignedTo(bug.assigned_to || '');
    setFormAttachments(bug.attachments || []);
    setIsFormModalOpen(true);
  };

  const openDetailModal = (bug: BugItem) => {
    setSelectedBug(bug);
    setIsDetailModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        const res = await bugsApi.upload(formData);
        const uploaded = res.data;
        setFormAttachments(prev => [...prev, uploaded]);
      }
      toast.success(`Đã tải lên ${files.length} tệp`);
    } catch (err: any) {
      toast.error('Tải tệp lên thất bại: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setFormAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error('Vui lòng nhập tiêu đề bug');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: formTitle.trim(),
        us_key: formUsKey.trim() || null,
        us_link: formUsLink.trim() || null,
        type: formType,
        status: formStatus,
        severity: formSeverity,
        description: formDescription,
        fix_solution: formFixSolution,
        attachments: formAttachments,
        created_by: formCreatedBy.trim() || null,
        assigned_to: formAssignedTo.trim() || null
      };

      if (editingBug) {
        await bugsApi.update(editingBug.id, payload);
        toast.success('Đã cập nhật thông tin bug!');
      } else {
        await bugsApi.create(payload);
        toast.success('Đã ghi nhận bug mới thành công!');
      }

      setIsFormModalOpen(false);
      loadBugs();
    } catch (err: any) {
      toast.error('Lưu thông tin thất bại: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (bugId: number, nextStatus: BugStatus, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await bugsApi.updateStatus(bugId, nextStatus);
      toast.success(`Đã chuyển trạng thái sang ${getStatusLabel(nextStatus)}`);
      loadBugs();
      if (selectedBug && selectedBug.id === bugId) {
        setSelectedBug(prev => prev ? { ...prev, status: nextStatus } : null);
      }
    } catch (err: any) {
      toast.error('Không thể đổi trạng thái');
    }
  };

  const handleDeleteBug = async (bugId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xóa bug này khỏi danh sách?')) return;

    try {
      await bugsApi.delete(bugId);
      toast.success('Đã xóa bug!');
      loadBugs();
      if (selectedBug && selectedBug.id === bugId) {
        setIsDetailModalOpen(false);
      }
    } catch (err: any) {
      toast.error('Xóa bug thất bại');
    }
  };

  const getStatusLabel = (st: BugStatus) => {
    switch (st) {
      case 'todo': return 'Chưa fix';
      case 'in_progress': return 'Đang fix';
      case 'resolved': return 'Đã fix';
      default: return st;
    }
  };

  const getStatusBadge = (st: BugStatus) => {
    switch (st) {
      case 'todo':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Chưa fix</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Đang fix</span>
          </span>
        );
      case 'resolved':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Đã fix</span>
          </span>
        );
    }
  };

  const getTypeBadge = (type: BugType) => {
    switch (type) {
      case 'FE':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25">
            FE BUG
          </span>
        );
      case 'BE':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
            BE BUG
          </span>
        );
      case 'BOTH':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
            FULLSTACK
          </span>
        );
    }
  };

  const getSeverityBadge = (sev: BugSeverity) => {
    switch (sev) {
      case 'critical':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-500/15 text-red-600 dark:text-red-400 flex items-center gap-0.5">
            <ShieldAlert className="w-3 h-3" />
            <span>Khẩn cấp</span>
          </span>
        );
      case 'high':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center gap-0.5">
            <AlertTriangle className="w-3 h-3" />
            <span>Cao</span>
          </span>
        );
      case 'medium':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
            Trung bình
          </span>
        );
      case 'low':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
            Thấp
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-card border border-border rounded-3xl p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <Bug className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                  Quản Lý Bug (Fix Notes)
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                  BA & QA/QC
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Note danh sách các bug cần fix, phân loại FE/BE, đính kèm hình ảnh lỗi và theo dõi giải pháp khắc phục.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Báo Cáo Bug Mới</span>
            </button>
            <button
              onClick={loadBugs}
              disabled={loading}
              className="p-2.5 rounded-xl border border-border bg-background hover:bg-accent text-muted-foreground hover:text-foreground transition"
              title="Làm mới"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Statistics Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-border/80">
          <div className="bg-muted/30 border border-border/60 rounded-2xl p-3.5 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground block">Tổng số Bug</span>
            <span className="text-xl font-black text-foreground font-mono">{stats.total}</span>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3.5 space-y-1">
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 block">Chưa Fix (Todo)</span>
            <span className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">{stats.todo}</span>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-3.5 space-y-1">
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 block">Đang Fix</span>
            <span className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">{stats.in_progress}</span>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3.5 space-y-1">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">Đã Fix</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{stats.resolved}</span>
          </div>

          <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-3.5 space-y-1">
            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 block">Lỗi Frontend (FE)</span>
            <span className="text-xl font-black text-purple-600 dark:text-purple-400 font-mono">{stats.fe_count}</span>
          </div>

          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-3.5 space-y-1">
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 block">Lỗi Backend (BE)</span>
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">{stats.be_count}</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tiêu đề, US key (EMSPRO2-...), mô tả, cách fix..."
            className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-primary transition"
          />
        </form>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Status filter */}
          <div className="w-40 sm:w-44">
            <SearchableSelect
              options={statusFilterOptions}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              placeholder="Trạng thái..."
              searchable={false}
              size="sm"
            />
          </div>

          {/* Type filter */}
          <div className="w-36 sm:w-40">
            <SearchableSelect
              options={typeFilterOptions}
              value={typeFilter}
              onChange={(val) => setTypeFilter(val)}
              placeholder="Loại bug..."
              searchable={false}
              size="sm"
            />
          </div>

          {/* Severity filter */}
          <div className="w-36 sm:w-40">
            <SearchableSelect
              options={severityFilterOptions}
              value={severityFilter}
              onChange={(val) => setSeverityFilter(val)}
              placeholder="Mức độ..."
              searchable={false}
              size="sm"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'board' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
              title="Xem dạng bảng Kanban"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'list' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
              title="Xem dạng danh sách"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <span>Đang tải danh sách bug...</span>
        </div>
      ) : bugs.length === 0 ? (
        <div className="py-16 text-center bg-card border border-dashed border-border rounded-3xl p-8 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-muted/60 text-muted-foreground mx-auto flex items-center justify-center">
            <Bug className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-sm text-foreground">Không tìm thấy bug nào</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Chưa có bug nào được ghi nhận hoặc không có kết quả phù hợp với bộ lọc hiện tại. Bấm nút bên dưới để tạo ghi chú bug mới.
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 transition shadow-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Bug Mới</span>
          </button>
        </div>
      ) : viewMode === 'board' ? (
        /* KANBAN BOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          {/* COLUMN 1: CHƯA FIX (TODO) */}
          <div className="bg-muted/20 border border-border rounded-3xl p-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-foreground">
                  Chưa Fix ({bugs.filter(b => b.status === 'todo').length})
                </h3>
              </div>
            </div>

            <div className="space-y-3">
              {bugs.filter(b => b.status === 'todo').map(bug => (
                <BugCard
                  key={bug.id}
                  bug={bug}
                  onClick={() => openDetailModal(bug)}
                  onEdit={() => openEditModal(bug)}
                  onDelete={(e) => handleDeleteBug(bug.id, e)}
                  onStatusChange={(nextStatus, e) => handleQuickStatusChange(bug.id, nextStatus, e)}
                  getTypeBadge={getTypeBadge}
                  getSeverityBadge={getSeverityBadge}
                  onPreviewImage={setPreviewImage}
                />
              ))}
              {bugs.filter(b => b.status === 'todo').length === 0 && (
                <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border/80 rounded-2xl">
                  Không có bug chưa fix
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 2: ĐANG FIX (IN PROGRESS) */}
          <div className="bg-muted/20 border border-border rounded-3xl p-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-foreground">
                  Đang Fix ({bugs.filter(b => b.status === 'in_progress').length})
                </h3>
              </div>
            </div>

            <div className="space-y-3">
              {bugs.filter(b => b.status === 'in_progress').map(bug => (
                <BugCard
                  key={bug.id}
                  bug={bug}
                  onClick={() => openDetailModal(bug)}
                  onEdit={() => openEditModal(bug)}
                  onDelete={(e) => handleDeleteBug(bug.id, e)}
                  onStatusChange={(nextStatus, e) => handleQuickStatusChange(bug.id, nextStatus, e)}
                  getTypeBadge={getTypeBadge}
                  getSeverityBadge={getSeverityBadge}
                  onPreviewImage={setPreviewImage}
                />
              ))}
              {bugs.filter(b => b.status === 'in_progress').length === 0 && (
                <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border/80 rounded-2xl">
                  Không có bug đang fix
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 3: ĐÃ FIX (RESOLVED) */}
          <div className="bg-muted/20 border border-border rounded-3xl p-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-foreground">
                  Đã Fix ({bugs.filter(b => b.status === 'resolved').length})
                </h3>
              </div>
            </div>

            <div className="space-y-3">
              {bugs.filter(b => b.status === 'resolved').map(bug => (
                <BugCard
                  key={bug.id}
                  bug={bug}
                  onClick={() => openDetailModal(bug)}
                  onEdit={() => openEditModal(bug)}
                  onDelete={(e) => handleDeleteBug(bug.id, e)}
                  onStatusChange={(nextStatus, e) => handleQuickStatusChange(bug.id, nextStatus, e)}
                  getTypeBadge={getTypeBadge}
                  getSeverityBadge={getSeverityBadge}
                  onPreviewImage={setPreviewImage}
                />
              ))}
              {bugs.filter(b => b.status === 'resolved').length === 0 && (
                <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border/80 rounded-2xl">
                  Chưa có bug nào đã fix
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* LIST / TABLE VIEW */
        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] font-bold">
                <tr>
                  <th className="py-3 px-4">#ID</th>
                  <th className="py-3 px-4">Tiêu Đề Bug</th>
                  <th className="py-3 px-4">Loại</th>
                  <th className="py-3 px-4">US Liên Quan</th>
                  <th className="py-3 px-4">Mức Độ</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4">Người Báo / Dev</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {bugs.map((bug) => (
                  <tr
                    key={bug.id}
                    onClick={() => openDetailModal(bug)}
                    className="hover:bg-accent/40 transition cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-muted-foreground">
                      #{bug.id}
                    </td>
                    <td className="py-3 px-4 min-w-[200px]">
                      <div className="font-bold text-foreground group-hover:text-primary transition line-clamp-1">
                        {bug.title}
                      </div>
                      {bug.fix_solution && (
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate max-w-sm">
                          💡 Cách fix: {bug.fix_solution}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getTypeBadge(bug.type)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {bug.us_key ? (
                        bug.us_link ? (
                          <a
                            href={bug.us_link}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 bg-blue-500/10 px-2 py-0.5 rounded"
                          >
                            <span>{bug.us_key}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="font-mono font-bold text-foreground bg-accent px-2 py-0.5 rounded">
                            {bug.us_key}
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground italic">Không có</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getSeverityBadge(bug.severity)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getStatusBadge(bug.status)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-muted-foreground text-[11px]">
                      <div>Tạo: {bug.created_by || 'QA'}</div>
                      {bug.assigned_to && <div>Dev: {bug.assigned_to}</div>}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(bug)}
                          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition"
                          title="Chỉnh sửa"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteBug(bug.id, e)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition"
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT BUG MODAL */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
            <div className="p-4 sm:p-6 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <Bug className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base sm:text-lg text-foreground">
                    {editingBug ? 'Chỉnh Sửa Bug' : 'Báo Cáo Bug Mới'}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Ghi chép thông tin lỗi, đính kèm ảnh và mô tả cách sửa.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
              {/* Tiêu đề bug */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground block">
                  Tiêu đề Bug <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ví dụ: [FE] Lỗi không hiển thị danh sách lớp học sau khi chọn cơ sở"
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold focus:outline-none focus:border-primary transition"
                />
              </div>

              {/* Phân loại FE vs BE & Trạng thái */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Type */}
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block">Phân loại Bug</label>
                  <div className="grid grid-cols-3 gap-1 bg-muted/40 p-1 rounded-xl border border-border">
                    {(['FE', 'BE', 'BOTH'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormType(t)}
                        className={`py-1.5 text-center font-bold text-xs rounded-lg transition ${
                          formType === t
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {t === 'BOTH' ? 'Cả hai' : t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block">Trạng thái</label>
                  <SearchableSelect<BugStatus>
                    options={formStatusOptions}
                    value={formStatus}
                    onChange={(val) => setFormStatus(val)}
                    placeholder="Chọn trạng thái..."
                    searchable={false}
                    size="sm"
                  />
                </div>

                {/* Severity */}
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block">Mức độ nghiêm trọng</label>
                  <SearchableSelect<BugSeverity>
                    options={formSeverityOptions}
                    value={formSeverity}
                    onChange={(val) => setFormSeverity(val)}
                    placeholder="Chọn mức độ..."
                    searchable={false}
                    size="sm"
                  />
                </div>
              </div>

              {/* US Key & US Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block">
                    Mã User Story (US Key)
                  </label>
                  <input
                    type="text"
                    value={formUsKey}
                    onChange={(e) => setFormUsKey(e.target.value)}
                    placeholder="VD: EMSPRO2-10030"
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 font-mono text-xs focus:outline-none focus:border-primary transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block">
                    Đường link đến US (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={formUsLink}
                    onChange={(e) => setFormUsLink(e.target.value)}
                    placeholder="https://task.ascvn.com.vn/browse/..."
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-primary transition"
                  />
                </div>
              </div>

              {/* Người báo cáo & Dev phụ trách */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block">Người log bug (BA / QA)</label>
                  <input
                    type="text"
                    value={formCreatedBy}
                    onChange={(e) => setFormCreatedBy(e.target.value)}
                    placeholder="Tên QA hoặc BA"
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-primary transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block">Dev được phân công fix</label>
                  <input
                    type="text"
                    value={formAssignedTo}
                    onChange={(e) => setFormAssignedTo(e.target.value)}
                    placeholder="Tên Dev (nếu đã phân công)"
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-primary transition"
                  />
                </div>
              </div>

              {/* Editor Mô tả Bug */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground flex items-center justify-between">
                  <span>Mô tả chi tiết Bug & Các bước tái hiện</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Hỗ trợ Markdown</span>
                </label>
                <textarea
                  rows={4}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Mô tả hiện tượng lỗi, các bước tái hiện (Steps to reproduce), kết quả mong muốn (Expected) và kết quả thực tế (Actual)..."
                  className="w-full bg-background border border-border rounded-xl p-3 text-xs leading-relaxed focus:outline-none focus:border-primary resize-y transition"
                />
              </div>

              {/* Mô tả cách fix (Fix solution) */}
              <div className="space-y-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3.5">
                <label className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Mô tả giải pháp fix / Cách fix (Dành cho Dev)</span>
                </label>
                <textarea
                  rows={2}
                  value={formFixSolution}
                  onChange={(e) => setFormFixSolution(e.target.value)}
                  placeholder="Ghi lại nguyên nhân lỗi và giải pháp fix (Ví dụ: Thiếu await trong hook useEffect, đã fix tại commit #abc...)"
                  className="w-full bg-background border border-border rounded-xl p-3 text-xs leading-relaxed focus:outline-none focus:border-emerald-500 resize-y transition"
                />
              </div>

              {/* Upload hình ảnh / File đính kèm */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-foreground flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-primary" />
                    <span>Hình ảnh minh họa / Tệp lỗi ({formAttachments.length})</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploading ? 'Đang tải lên...' : 'Tải tệp / ảnh lên'}</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.log,.txt,.json,.pdf,.xlsx,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {formAttachments.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                    {formAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="rounded-xl border border-border bg-background p-2 relative flex items-center gap-2 group"
                      >
                        {att.isImage ? (
                          <img
                            src={resolveApiUrl(att.url)}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover bg-muted shrink-0 cursor-pointer"
                            onClick={() => setPreviewImage({ url: resolveApiUrl(att.url), title: att.originalName })}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <FileIcon className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-foreground truncate block text-[11px]" title={att.originalName}>
                            {att.originalName}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatBytes(att.size)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(att.id)}
                          className="p-1 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition shrink-0"
                          title="Xóa tệp"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-accent font-bold transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formTitle.trim()}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : editingBug ? 'Lưu Thay Đổi' : 'Ghi Nhận Bug'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BUG DETAIL MODAL */}
      {isDetailModalOpen && selectedBug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
            <div className="p-4 sm:p-6 border-b border-border bg-muted/30 flex items-start justify-between gap-3">
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-foreground bg-accent px-2 py-0.5 rounded-md">
                    #{selectedBug.id}
                  </span>
                  {getTypeBadge(selectedBug.type)}
                  {getStatusBadge(selectedBug.status)}
                  {getSeverityBadge(selectedBug.severity)}
                </div>
                <h2 className="text-base sm:text-lg font-bold text-foreground leading-snug break-words">
                  {selectedBug.title}
                </h2>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    openEditModal(selectedBug);
                  }}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition"
                  title="Chỉnh sửa bug"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteBug(selectedBug.id)}
                  className="p-2 rounded-xl text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition"
                  title="Xóa bug"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition"
                  title="Đóng"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Meta Bar */}
            <div className="px-4 sm:px-6 py-2.5 border-b border-border bg-card flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                {selectedBug.us_key && (
                  <div className="flex items-center gap-1.5">
                    <span>US:</span>
                    {selectedBug.us_link ? (
                      <a
                        href={selectedBug.us_link}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>{selectedBug.us_key}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="font-mono font-bold text-foreground">{selectedBug.us_key}</span>
                    )}
                  </div>
                )}
                <div>Người tạo: <span className="font-semibold text-foreground">{selectedBug.created_by || 'QA'}</span></div>
                {selectedBug.assigned_to && (
                  <div>Dev: <span className="font-semibold text-foreground">{selectedBug.assigned_to}</span></div>
                )}
              </div>

              {/* Quick Status Action Buttons */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">Chuyển sang:</span>
                {selectedBug.status !== 'todo' && (
                  <button
                    type="button"
                    onClick={() => handleQuickStatusChange(selectedBug.id, 'todo')}
                    className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition"
                  >
                    Chưa fix
                  </button>
                )}
                {selectedBug.status !== 'in_progress' && (
                  <button
                    type="button"
                    onClick={() => handleQuickStatusChange(selectedBug.id, 'in_progress')}
                    className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition"
                  >
                    Đang fix
                  </button>
                )}
                {selectedBug.status !== 'resolved' && (
                  <button
                    type="button"
                    onClick={() => handleQuickStatusChange(selectedBug.id, 'resolved')}
                    className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition"
                  >
                    Đã fix
                  </button>
                )}
              </div>
            </div>

            {/* Detail Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs sm:text-sm">
              {/* Mô tả lỗi */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                  Mô tả lỗi & Các bước tái hiện
                </h4>
                <div className="bg-background border border-border rounded-2xl p-4 whitespace-pre-wrap leading-relaxed text-foreground min-h-[80px]">
                  {selectedBug.description || <span className="text-muted-foreground italic">Chưa có mô tả chi tiết.</span>}
                </div>
              </div>

              {/* Giải pháp Fix */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Giải pháp fix / Cách fix</span>
                </h4>
                <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-2xl p-4 whitespace-pre-wrap leading-relaxed text-foreground min-h-[60px]">
                  {selectedBug.fix_solution ? (
                    selectedBug.fix_solution
                  ) : (
                    <span className="text-muted-foreground italic">Chưa ghi nhận giải pháp fix cho bug này.</span>
                  )}
                </div>
              </div>

              {/* Hình ảnh & Tệp đính kèm */}
              {selectedBug.attachments && selectedBug.attachments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-primary" />
                    <span>Hình ảnh & Tệp đính kèm ({selectedBug.attachments.length})</span>
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {selectedBug.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="rounded-xl border border-border bg-card overflow-hidden p-2 flex flex-col justify-between group hover:border-primary transition"
                      >
                        {att.isImage ? (
                          <div
                            onClick={() => setPreviewImage({ url: resolveApiUrl(att.url), title: att.originalName })}
                            className="aspect-video w-full bg-muted/30 rounded-lg overflow-hidden cursor-pointer relative mb-1.5"
                          >
                            <img src={resolveApiUrl(att.url)} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                              <ZoomIn className="w-4 h-4" />
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-video w-full bg-muted/40 rounded-lg flex items-center justify-center mb-1.5">
                            <FileIcon className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-foreground truncate" title={att.originalName}>
                            {att.originalName}
                          </span>
                          <a
                            href={resolveApiUrl(att.url)}
                            download={att.originalName}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition"
                            title="Tải về"
                          >
                            <Download className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN IMAGE LIGHTBOX */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex flex-col animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="p-4 flex items-center justify-between text-white shrink-0 bg-gradient-to-b from-black/80 to-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 min-w-0">
              <ImageIcon className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-bold truncate max-w-md">{previewImage.title}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={previewImage.url}
                download
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition flex items-center gap-1.5 text-xs font-semibold"
                title="Tải ảnh về máy"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Tải về</span>
              </a>
              <a
                href={previewImage.url}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition flex items-center gap-1.5 text-xs font-semibold"
                title="Mở tab mới"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">Mở gốc</span>
              </a>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            <img
              src={previewImage.url}
              alt={previewImage.title}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full object-contain rounded-xl shadow-2xl select-none"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component: Bug Card for Kanban board
interface BugCardProps {
  bug: BugItem;
  onClick: () => void;
  onEdit: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onStatusChange: (nextStatus: BugStatus, e: React.MouseEvent) => void;
  getTypeBadge: (type: BugType) => React.ReactNode;
  getSeverityBadge: (sev: BugSeverity) => React.ReactNode;
  onPreviewImage: (img: { url: string; title: string }) => void;
}

const BugCard: React.FC<BugCardProps> = ({
  bug,
  onClick,
  onEdit,
  onDelete,
  onStatusChange,
  getTypeBadge,
  getSeverityBadge,
  onPreviewImage
}) => {
  const images = bug.attachments?.filter(a => a.isImage) || [];

  return (
    <div
      onClick={onClick}
      className="p-3.5 rounded-2xl bg-card border border-border hover:border-primary/50 transition cursor-pointer shadow-2xs hover:shadow-sm space-y-2.5 group"
    >
      {/* Top Meta: Badges & Actions */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-bold text-muted-foreground">
            #{bug.id}
          </span>
          {getTypeBadge(bug.type)}
          {getSeverityBadge(bug.severity)}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onEdit}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition"
            title="Sửa bug"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition"
            title="Xóa bug"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Title */}
      <h4 className="font-bold text-xs sm:text-sm text-foreground leading-snug line-clamp-2 group-hover:text-primary transition">
        {bug.title}
      </h4>

      {/* Description Snippet */}
      {bug.description && (
        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
          {bug.description}
        </p>
      )}

      {/* First image thumbnail preview if any */}
      {images.length > 0 && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onPreviewImage({ url: images[0].url, title: images[0].originalName });
          }}
          className="aspect-video w-full rounded-xl overflow-hidden bg-muted/30 relative border border-border/60"
        >
          <img src={images[0].url} alt="" className="w-full h-full object-cover group-hover:scale-102 transition duration-200" />
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-bold">
            {images.length} ảnh
          </div>
        </div>
      )}

      {/* Fix solution preview if available */}
      {bug.fix_solution && (
        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-400">
          <div className="font-bold flex items-center gap-1 mb-0.5">
            <Sparkles className="w-3 h-3" />
            <span>Cách fix:</span>
          </div>
          <p className="line-clamp-2">{bug.fix_solution}</p>
        </div>
      )}

      {/* Bottom Footer: US Key, Attachments count, Quick Next Status */}
      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          {bug.us_key && (
            bug.us_link ? (
              <a
                href={bug.us_link}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 bg-blue-500/10 px-1.5 py-0.5 rounded"
              >
                <span>{bug.us_key}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ) : (
              <span className="font-mono font-bold text-foreground bg-accent px-1.5 py-0.5 rounded">
                {bug.us_key}
              </span>
            )
          )}
          {bug.attachments && bug.attachments.length > 0 && (
            <span className="flex items-center gap-0.5 text-muted-foreground">
              <Paperclip className="w-3 h-3" />
              <span>{bug.attachments.length}</span>
            </span>
          )}
        </div>

        {/* Quick Transition buttons */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {bug.status === 'todo' && (
            <button
              type="button"
              onClick={(e) => onStatusChange('in_progress', e)}
              className="px-2 py-0.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-[10px] transition"
              title="Chuyển sang Đang fix"
            >
              Fix ngay →
            </button>
          )}
          {bug.status === 'in_progress' && (
            <button
              type="button"
              onClick={(e) => onStatusChange('resolved', e)}
              className="px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] transition"
              title="Đánh dấu Đã fix"
            >
              Đã fix ✓
            </button>
          )}
          {bug.status === 'resolved' && (
            <button
              type="button"
              onClick={(e) => onStatusChange('todo', e)}
              className="px-2 py-0.5 rounded-lg bg-muted hover:bg-accent text-muted-foreground font-semibold text-[10px] transition"
              title="Mở lại bug"
            >
              Mở lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
