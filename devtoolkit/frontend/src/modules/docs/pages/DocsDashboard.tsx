import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  FolderPlus, 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Plus, 
  ArrowRight,
  TrendingUp,
  FileCheck2,
  RefreshCw,
  Edit2,
  Trash2,
  MoreVertical,
  ExternalLink,
  Tag,
  User,
  Filter,
  Grid,
  List as ListIcon,
  Check,
  X,
  HelpCircle,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { docsApi } from '../../../services/api';
import { SearchableSelect, SelectOption } from '../../../components/ui';
import { Module, Screen, DashboardStats } from '../../../types';

const COLOR_PRESETS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#6366f1', // Indigo
];

const ICON_PRESETS = ['📁', '📊', '📱', '⚙️', '💳', '👥', '🔒', '📦', '📋', '📈', '🔔', '🎯'];

export const DocsDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [modules, setModules] = useState<Module[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filters & View State
  const [selectedModuleId, setSelectedModuleId] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');

  // Modals
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [moduleFormName, setModuleFormName] = useState('');
  const [moduleFormIcon, setModuleFormIcon] = useState('📁');
  const [moduleFormColor, setModuleFormColor] = useState('#3b82f6');
  const [moduleFormDesc, setModuleFormDesc] = useState('');

  // Delete Module Modal
  const [deletingModule, setDeletingModule] = useState<Module | null>(null);
  const [transferTargetId, setTransferTargetId] = useState<string>('');
  const [showDeleteConfirmPopup, setShowDeleteConfirmPopup] = useState<boolean>(false);

  // Delete Screen Modal
  const [deletingScreen, setDeletingScreen] = useState<Screen | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [modRes, statRes, screenRes] = await Promise.all([
        docsApi.getModules(),
        docsApi.getStats(),
        docsApi.getScreens()
      ]);
      setModules(Array.isArray(modRes.data) ? modRes.data : []);
      setStats(statRes.data && typeof statRes.data === 'object' ? statRes.data : null);
      setScreens(Array.isArray(screenRes.data) ? screenRes.data : []);
    } catch (err) {
      console.error('Failed to load docs data:', err);
      toast.error('Không thể tải danh sách tài liệu');
      setModules([]);
      setScreens([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Safe normalized arrays
  const safeScreens = useMemo(() => Array.isArray(screens) ? screens : [], [screens]);
  const safeModules = useMemo(() => Array.isArray(modules) ? modules : [], [modules]);

  // Filtered screens calculation
  const filteredScreens = useMemo(() => {
    return safeScreens.filter((screen) => {
      // Filter by Group
      if (selectedModuleId !== 'all' && String(screen.module_id) !== selectedModuleId) {
        return false;
      }

      // Filter by Status
      if (statusFilter !== 'all' && screen.status !== statusFilter) {
        return false;
      }

      // Filter by Keyword
      if (searchKeyword.trim()) {
        const query = searchKeyword.toLowerCase().trim();
        const matchTitle = screen.title?.toLowerCase().includes(query);
        const matchAuthor = screen.author?.toLowerCase().includes(query);
        const matchJira = screen.jira_key?.toLowerCase().includes(query);
        const matchOverview = screen.overview?.toLowerCase().includes(query);
        const matchTags = Array.isArray(screen.tags) && screen.tags.some(t => t.toLowerCase().includes(query));
        const matchModuleName = screen.module_name?.toLowerCase().includes(query);
        const matchContent = screen.raw_content?.toLowerCase().includes(query);

        if (!matchTitle && !matchAuthor && !matchJira && !matchOverview && !matchTags && !matchModuleName && !matchContent) {
          return false;
        }
      }

      return true;
    });
  }, [screens, selectedModuleId, statusFilter, searchKeyword]);

  // Handle Save / Create Module
  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleFormName.trim()) {
      toast.error('Vui lòng nhập tên nhóm');
      return;
    }

    try {
      if (editingModule) {
        await docsApi.updateModule(editingModule.id, {
          name: moduleFormName.trim(),
          icon: moduleFormIcon,
          color: moduleFormColor,
          description: moduleFormDesc.trim()
        });
        toast.success(`Đã cập nhật nhóm "${moduleFormName}"`);
      } else {
        await docsApi.createModule({
          name: moduleFormName.trim(),
          icon: moduleFormIcon,
          color: moduleFormColor,
          description: moduleFormDesc.trim()
        });
        toast.success(`Tạo mới nhóm "${moduleFormName}" thành công!`);
      }

      setShowModuleModal(false);
      setEditingModule(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Thao tác nhóm thất bại');
    }
  };

  // Open Edit Module Modal
  const handleOpenEditModule = (mod: Module, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingModule(mod);
    setModuleFormName(mod.name);
    setModuleFormIcon(mod.icon || '📁');
    setModuleFormColor(mod.color || '#3b82f6');
    setModuleFormDesc(mod.description || '');
    setShowModuleModal(true);
  };

  // Execute Delete Module
  const executeDeleteModule = async (cascade = false) => {
    if (!deletingModule) return;

    try {
      const targetId = transferTargetId ? Number(transferTargetId) : undefined;
      await docsApi.deleteModule(deletingModule.id, targetId, cascade);
      if (targetId) {
        toast.success(`Đã chuyển màn hình và xóa nhóm "${deletingModule.name}"`);
      } else if (cascade) {
        toast.success(`Đã xóa nhóm "${deletingModule.name}" và toàn bộ màn hình bên trong`);
      } else {
        toast.success(`Đã xóa nhóm "${deletingModule.name}"`);
      }
      if (selectedModuleId === String(deletingModule.id)) {
        setSelectedModuleId('all');
      }
      setDeletingModule(null);
      setTransferTargetId('');
      setShowDeleteConfirmPopup(false);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Không thể xóa nhóm');
    }
  };

  // Handle Delete Module button click
  const handleDeleteModuleClick = () => {
    if (!deletingModule) return;
    const screenCount = safeScreens.filter(s => s.module_id === deletingModule.id).length;

    // Nếu nhóm có màn hình và người dùng không chọn nhóm chuyển tiếp -> mở popup confirm
    if (screenCount > 0 && !transferTargetId) {
      setShowDeleteConfirmPopup(true);
    } else {
      executeDeleteModule(false);
    }
  };

  // Handle Delete Screen
  const handleDeleteScreenConfirm = async () => {
    if (!deletingScreen) return;
    try {
      await docsApi.deleteScreen(deletingScreen.id);
      toast.success(`Đã xóa màn hình "${deletingScreen.title}"`);
      setDeletingScreen(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Không thể xóa màn hình');
    }
  };

  // Handle Sync Disk
  const handleSyncDisk = async () => {
    setSyncing(true);
    const toastId = toast.loading('Đang quét và đồng bộ tài liệu từ ổ đĩa...');
    try {
      const res = await docsApi.sync();
      const count = res.data?.count;
      const defaultMsg = typeof count === 'number'
        ? (count > 0 ? `Đã đồng bộ thành công ${count} tài liệu từ ổ đĩa!` : 'Đã kiểm tra ổ đĩa: tất cả tài liệu đã được đồng bộ mới nhất.')
        : 'Đã đồng bộ tài liệu từ ổ đĩa thành công!';
      toast.success(res.data?.message || defaultMsg, { id: toastId });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Lỗi khi đồng bộ tài liệu từ ổ đĩa', { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* ================= HEADER & ACTIONS ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Tài liệu đặc tả
            </h1>
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Bàn giao kỹ thuật
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            Quản lý nhóm tính năng, bàn giao tài liệu kỹ thuật, business rules & API cho từng màn hình.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={handleSyncDisk}
            disabled={syncing}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-card hover:bg-accent text-foreground rounded-xl transition border border-border shadow-xs disabled:opacity-50"
            title="Quét và nạp lại file .md từ ổ đĩa vào CSDL (hữu ích khi git pull hoặc có người sửa file bên ngoài)"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
            <span className="hidden sm:inline">Đồng bộ ổ đĩa</span>
          </button>

          <button
            onClick={() => {
              setEditingModule(null);
              setModuleFormName('');
              setModuleFormIcon('📁');
              setModuleFormColor('#3b82f6');
              setModuleFormDesc('');
              setShowModuleModal(true);
            }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 sm:px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-xl transition border border-border shadow-xs"
          >
            <FolderPlus className="w-4 h-4 text-primary" />
            <span>Tạo nhóm mới</span>
          </button>

          <button
            onClick={() => {
              const defaultMod = selectedModuleId !== 'all' ? selectedModuleId : (modules[0]?.id || '');
              navigate(`/docs/screens/new${defaultMod ? `?module=${defaultMod}` : ''}`);
            }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 sm:px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo màn hình</span>
          </button>

          <button
            onClick={() => navigate('/docs/import')}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-card hover:bg-accent text-foreground rounded-xl transition border border-border shadow-xs"
            title="Import file Markdown (.md) có sẵn"
          >
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="hidden md:inline">Import .md</span>
          </button>
        </div>
      </div>

      {/* ================= METRICS STATS ================= */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Nhóm tính năng</span>
              <Layers className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold mt-2 text-foreground tabular-nums">{modules.length}</div>
            <div className="text-[11px] text-muted-foreground mt-1">Modules cấu hình</div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Tổng màn hình</span>
              <FileText className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold mt-2 text-foreground tabular-nums">{screens.length}</div>
            <div className="text-[11px] text-muted-foreground mt-1">Đã lập đặc tả</div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Đã bàn giao</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold mt-2 text-emerald-600 dark:text-emerald-400 tabular-nums">
              {stats.byStatus['Published'] || 0}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">Published hoàn chỉnh</div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Bản nháp / Đang làm</span>
              <AlertCircle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold mt-2 text-amber-600 dark:text-amber-400 tabular-nums">
              {stats.byStatus['Draft'] || 0}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">Draft đang cập nhật</div>
          </div>
        </div>
      )}

      {/* ================= SELECTOR NHÓM (GROUPS TABS / FILTER) ================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-primary" />
            <span>Chọn nhóm tính năng (Modules)</span>
          </label>
          <span className="text-xs text-muted-foreground">
            {modules.length} nhóm được cấu hình
          </span>
        </div>

        {/* Responsive Horizontal Scroll Tabs for Groups */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-2 -mx-2 px-2 sm:mx-0 sm:px-0">
          {/* "Tất cả các nhóm" Tab */}
          <button
            type="button"
            onClick={() => setSelectedModuleId('all')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap border shrink-0 ${
              selectedModuleId === 'all'
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card text-foreground border-border hover:bg-accent'
            }`}
          >
            <span>📁 Tất cả các nhóm</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              selectedModuleId === 'all'
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}>
              {screens.length}
            </span>
          </button>

          {/* Group Tabs */}
          {safeModules.map((m) => {
            const isSelected = selectedModuleId === String(m.id);
            const count = safeScreens.filter(s => s.module_id === m.id).length;
            const groupColor = m.color || '#3b82f6';

            return (
              <div key={m.id} className="relative group shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedModuleId(String(m.id))}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap border pr-14 ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card text-foreground border-border hover:bg-accent'
                  }`}
                  style={{
                    borderLeftWidth: '4px',
                    borderLeftColor: groupColor
                  }}
                >
                  <span className="text-sm">{m.icon || '📁'}</span>
                  <span className="truncate max-w-[150px]">{m.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                    isSelected
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {count}
                  </span>
                </button>

                {/* Edit & Delete Mini Buttons for Group */}
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={(e) => handleOpenEditModule(m, e)}
                    className={`p-1 min-w-[24px] min-h-[24px] flex items-center justify-center rounded-md hover:bg-background/40 transition ${
                      isSelected ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Chỉnh sửa nhóm"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingModule(m);
                    }}
                    className={`p-1 min-w-[24px] min-h-[24px] flex items-center justify-center rounded-md hover:bg-background/40 transition ${
                      isSelected ? 'text-primary-foreground hover:text-red-200' : 'text-muted-foreground hover:text-destructive'
                    }`}
                    title="Xóa nhóm"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= SEARCH & FILTER TOOLBAR ================= */}
      <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="Tìm kiếm theo tên màn hình, từ khóa, tác giả, tag, Jira key..."
            className="w-full bg-background border border-border rounded-xl pl-9 pr-9 py-2 text-xs sm:text-sm focus:outline-none focus:border-primary shadow-xs"
          />
          {searchKeyword && (
            <button
              onClick={() => setSearchKeyword('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          {/* Group Selector Dropdown */}
          <div className="w-full sm:w-52">
            <SearchableSelect
              options={[
                { value: 'all', label: `📁 Tất cả nhóm (${safeScreens.length})` },
                ...safeModules.map((m) => {
                  const count = safeScreens.filter(s => s.module_id === m.id).length;
                  return {
                    value: String(m.id),
                    label: `${m.icon || '📁'} ${m.name}`,
                    badge: `${count}`,
                  };
                }),
              ]}
              value={selectedModuleId}
              onChange={(val) => setSelectedModuleId(val)}
              placeholder="Chọn nhóm..."
              searchPlaceholder="Tìm kiếm nhóm..."
              size="sm"
            />
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-48">
            <SearchableSelect
              options={[
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'Published', label: 'Published (Đã bàn giao)', badge: 'Published', badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
                { value: 'In Review', label: 'In Review (Đang duyệt)', badge: 'Review', badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
                { value: 'Draft', label: 'Draft (Bản nháp)', badge: 'Draft', badgeColor: 'bg-muted text-muted-foreground' },
              ]}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              placeholder="Chọn trạng thái..."
              searchable={false}
              size="sm"
            />
          </div>

          {/* View Mode Toggle (Grid / List) */}
          <div className="col-span-2 sm:col-auto justify-self-end bg-background border border-border rounded-xl p-0.5 flex items-center">
            <button
              type="button"
              onClick={() => setViewLayout('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewLayout === 'grid' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Xem dạng lưới (Grid)"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewLayout('list')}
              className={`p-1.5 rounded-lg transition ${
                viewLayout === 'list' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Xem dạng danh sách (List)"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= SCREENS LIST / GRID ================= */}
      <div className="space-y-4">
        {/* Results Counter */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            Hiển thị <b>{filteredScreens.length}</b> / {screens.length} tài liệu màn hình
            {selectedModuleId !== 'all' && (
              <> thuộc nhóm <b>{modules.find(m => String(m.id) === selectedModuleId)?.name}</b></>
            )}
          </span>
          {(searchKeyword || statusFilter !== 'all' || selectedModuleId !== 'all') && (
            <button
              onClick={() => {
                setSearchKeyword('');
                setStatusFilter('all');
                setSelectedModuleId('all');
              }}
              className="text-primary hover:underline font-semibold"
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>

        {/* Loading / Empty States */}
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
            <span>Đang tải danh sách tài liệu đặc tả...</span>
          </div>
        ) : filteredScreens.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 sm:p-12 text-center space-y-3 shadow-sm">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground/50" />
            <h3 className="text-base font-bold text-foreground">Không tìm thấy tài liệu màn hình phù hợp</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Không có màn hình nào khớp với bộ lọc hoặc từ khóa tìm kiếm. Bạn có thể tạo mới màn hình ngay hoặc nhập file markdown (.md).
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => {
                  const defaultMod = selectedModuleId !== 'all' ? selectedModuleId : (modules[0]?.id || '');
                  navigate(`/docs/screens/new${defaultMod ? `?module=${defaultMod}` : ''}`);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-sm hover:bg-primary/90 transition"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tạo Màn Hình Mới</span>
              </button>
              <button
                onClick={() => navigate('/docs/import')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-card border border-border text-foreground text-xs font-semibold rounded-xl shadow-sm hover:bg-accent transition"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Import .md</span>
              </button>
            </div>
          </div>
        ) : viewLayout === 'grid' ? (
          /* ===== GRID VIEW ===== */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredScreens.map((s) => {
              const currentMod = modules.find(m => m.id === s.module_id);
              const groupColor = currentMod?.color || s.module_color || '#3b82f6';
              const groupIcon = currentMod?.icon || s.module_icon || '📁';

              return (
                <div
                  key={s.id}
                  className="bg-card border border-border hover:border-primary/50 transition-all rounded-2xl p-5 group shadow-sm hover:shadow-md flex flex-col justify-between relative overflow-hidden"
                >
                  {/* Color Accent Stripe */}
                  <div 
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: groupColor }}
                  />

                  <div>
                    {/* Top Pill Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3 pt-1">
                      <span 
                        className="text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1"
                        style={{
                          backgroundColor: `${groupColor}15`,
                          color: groupColor
                        }}
                      >
                        <span>{groupIcon}</span>
                        <span className="truncate max-w-[120px]">{s.module_name}</span>
                      </span>

                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          s.status === 'Published'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : s.status === 'In Review'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        }`}>
                          {s.status}
                        </span>

                        {s.jira_key && (
                          <span className="text-[10px] font-mono text-blue-500 font-semibold bg-blue-500/10 px-1.5 py-0.5 rounded">
                            {s.jira_key}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Screen Title */}
                    <h3 
                      onClick={() => navigate(`/docs/screen/${s.id}`)}
                      className="font-bold text-base text-foreground group-hover:text-primary transition-colors cursor-pointer line-clamp-1"
                      title={s.title}
                    >
                      {s.title}
                    </h3>

                    {/* Overview snippet */}
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                      {s.overview || 'Tài liệu đặc tả màn hình bao gồm features, business rules và danh sách API.'}
                    </p>

                    {/* Tags */}
                    {Array.isArray(s.tags) && s.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {s.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                            #{tag}
                          </span>
                        ))}
                        {s.tags.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{s.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Metadata & Actions */}
                  <div className="mt-5 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[90px]">{s.author || 'Author'}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => navigate(`/docs/screen/${s.id}`)}
                        className="px-2.5 py-1 rounded-lg bg-accent/60 hover:bg-accent text-foreground text-xs font-semibold transition"
                        title="Xem tài liệu đặc tả"
                      >
                        Xem
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/docs/screen/${s.id}/edit`)}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition"
                        title="Chỉnh sửa tài liệu trong Markdown Editor"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingScreen(s)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                        title="Xóa màn hình"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ===== LIST VIEW ===== */
          <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden shadow-sm">
            {filteredScreens.map((s) => {
              const currentMod = modules.find(m => m.id === s.module_id);
              const groupColor = currentMod?.color || s.module_color || '#3b82f6';

              return (
                <div
                  key={s.id}
                  className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 mt-0.5 sm:mt-0"
                      style={{
                        backgroundColor: `${groupColor}20`,
                        color: groupColor
                      }}
                    >
                      <FileText className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 
                          onClick={() => navigate(`/docs/screen/${s.id}`)}
                          className="font-bold text-sm text-foreground hover:text-primary transition-colors cursor-pointer truncate w-full sm:w-auto"
                        >
                          {s.title}
                        </h4>

                        <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                          s.status === 'Published'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : s.status === 'In Review'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}>
                          {s.status}
                        </span>

                        {s.jira_key && (
                          <span className="text-[10px] font-mono text-blue-500 font-semibold bg-blue-500/10 px-1.5 py-0.2 rounded">
                            {s.jira_key}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                        <span>Nhóm: <b className="text-foreground">{s.module_name}</b></span>
                        <span>•</span>
                        <span>Tác giả: {s.author}</span>
                        <span>•</span>
                        <span className="font-mono">{new Date(s.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => navigate(`/docs/screen/${s.id}`)}
                      className="px-3 py-1.5 rounded-xl bg-accent text-foreground text-xs font-semibold hover:bg-accent/80 transition"
                    >
                      Xem chi tiết
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/docs/screen/${s.id}/edit`)}
                      className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Sửa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingScreen(s)}
                      className="p-1.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                      title="Xóa màn hình"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= MODAL: TẠO / SỬA NHÓM (CREATE / EDIT GROUP) ================= */}
      {showModuleModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-border/80">
              <h3 className="text-base sm:text-lg font-bold text-foreground">
                {editingModule ? 'Chỉnh Sửa Nhóm Tính Năng' : 'Tạo Nhóm Mới'}
              </h3>
              <button
                onClick={() => setShowModuleModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModule} className="space-y-4">
              {/* Module Name */}
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Tên Nhóm Tính Năng <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={moduleFormName}
                  onChange={(e) => setModuleFormName(e.target.value)}
                  placeholder="e.g. Quản Lý Khảo Sát, Báo Cáo Thống Kê..."
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>

              {/* Icon Picker */}
              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  Biểu tượng (Icon / Emoji)
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {ICON_PRESETS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setModuleFormIcon(ic)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition border ${
                        moduleFormIcon === ic
                          ? 'border-primary bg-primary/10 scale-105 shadow-xs'
                          : 'border-border bg-background hover:bg-accent'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={moduleFormIcon}
                    onChange={(e) => setModuleFormIcon(e.target.value)}
                    maxLength={2}
                    className="w-12 h-9 text-center bg-background border border-border rounded-xl text-base focus:outline-none focus:border-primary"
                    title="Hoặc nhập emoji tùy chọn"
                  />
                </div>
              </div>

              {/* Color Presets */}
              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  Màu sắc nhận diện (Color)
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setModuleFormColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform border flex items-center justify-center ${
                        moduleFormColor === c ? 'scale-110 ring-2 ring-primary ring-offset-2' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {moduleFormColor === c && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                  <input
                    type="color"
                    value={moduleFormColor}
                    onChange={(e) => setModuleFormColor(e.target.value)}
                    className="w-8 h-8 rounded-full border border-border cursor-pointer bg-transparent"
                    title="Chọn mã màu tùy ý"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Mô tả nhóm
                </label>
                <textarea
                  value={moduleFormDesc}
                  onChange={(e) => setModuleFormDesc(e.target.value)}
                  placeholder="Mô tả phạm vi các màn hình và chức năng thuộc nhóm này..."
                  rows={2}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-border/80">
                <button
                  type="button"
                  onClick={() => setShowModuleModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl hover:bg-accent text-muted-foreground"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm"
                >
                  {editingModule ? 'Lưu Thay Đổi' : 'Tạo Nhóm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: XÓA NHÓM (DELETE GROUP) ================= */}
      {deletingModule && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto flex flex-col">
            <div className="flex items-center gap-3 text-destructive">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Xóa Nhóm: {deletingModule.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Hành động này sẽ xóa nhóm khỏi hệ thống.
                </p>
              </div>
            </div>

            {/* Check if module contains screens */}
            {safeScreens.filter(s => s.module_id === deletingModule.id).length > 0 ? (
              <div className="space-y-3 bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-xs">
                <p className="font-semibold text-amber-700 dark:text-amber-300">
                  Nhóm này hiện có <b>{safeScreens.filter(s => s.module_id === deletingModule.id).length}</b> màn hình đặc tả.
                </p>
                <p className="text-muted-foreground">
                  Bạn có thể chọn một nhóm khác để chuyển tất cả màn hình sang đó trước khi xóa (hoặc để trống nếu muốn xóa toàn bộ):
                </p>

                <div>
                  <label className="text-[11px] font-bold text-foreground block mb-1">
                    Chuyển toàn bộ màn hình sang nhóm (không bắt buộc):
                  </label>
                  <select
                    value={transferTargetId}
                    onChange={(e) => setTransferTargetId(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-primary"
                  >
                    <option value="">-- Không chuyển (Xóa toàn bộ màn hình trong nhóm) --</option>
                    {safeModules
                      .filter(m => m.id !== deletingModule.id)
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          {m.icon || '📁'} {m.name}
                        </option>
                      ))}
                  </select>
                </div>

                {transferTargetId ? (
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Toàn bộ màn hình sẽ được tự động chuyển sang nhóm đích trước khi xóa nhóm này.</span>
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-destructive/10 text-destructive text-[11px] font-medium flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Nếu không chuyển, hệ thống sẽ yêu cầu xác nhận để xóa vĩnh viễn toàn bộ màn hình bên trong.</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nhóm này không chứa màn hình nào. Bạn có thể xóa an toàn ngay bây giờ.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border/80">
              <button
                type="button"
                onClick={() => {
                  setDeletingModule(null);
                  setTransferTargetId('');
                  setShowDeleteConfirmPopup(false);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl hover:bg-accent text-muted-foreground"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteModuleClick}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition shadow-sm"
              >
                {transferTargetId ? 'Chuyển màn hình & Xóa nhóm' : 'Xác nhận Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= POPUP CONFIRM: XÁC NHẬN XÓA TẤT CẢ (KHI KHÔNG CHUYỂN NHÓM) ================= */}
      {showDeleteConfirmPopup && deletingModule && (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-destructive/40 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto flex flex-col animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-destructive">
              <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Xác Nhận Xóa Vĩnh Viễn
                </h3>
                <p className="text-xs text-destructive font-semibold">
                  Cảnh báo: Toàn bộ màn hình bên trong sẽ bị xóa
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-muted-foreground leading-relaxed">
              <p>
                Nhóm <b>"{deletingModule.name}"</b> đang chứa{' '}
                <b className="text-foreground">
                  {safeScreens.filter(s => s.module_id === deletingModule.id).length}
                </b>{' '}
                màn hình đặc tả.
              </p>
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive font-medium space-y-1">
                <div className="font-bold">⚠️ Cảnh báo mất dữ liệu:</div>
                <p className="text-[11px] leading-normal">
                  Vì bạn không chọn nhóm chuyển tiếp, <b>tất cả {safeScreens.filter(s => s.module_id === deletingModule.id).length} màn hình đặc tả</b> và các file markdown tương ứng trên ổ đĩa sẽ bị <b>xóa vĩnh viễn</b>. Hành động này không thể hoàn tác!
                </p>
              </div>
              <p className="font-semibold text-foreground pt-1">
                Bạn có chắc chắn đồng ý xóa nhóm này cùng toàn bộ màn hình không?
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/80">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmPopup(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl hover:bg-accent text-muted-foreground"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={() => executeDeleteModule(true)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition shadow-sm"
              >
                Tôi đồng ý, Xóa tất cả
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: XÓA MÀN HÌNH (DELETE SCREEN) ================= */}
      {deletingScreen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto flex flex-col">
            <div className="flex items-center gap-3 text-destructive">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Xóa Màn Hình Đặc Tả
                </h3>
                <p className="text-xs text-muted-foreground truncate max-w-[260px]">
                  {deletingScreen.title}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Bạn có chắc chắn muốn xóa màn hình đặc tả <b>"{deletingScreen.title}"</b>? 
              Tài liệu markdown liên quan trên ổ đĩa cũng sẽ bị xóa. Hành động này không thể hoàn tác.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/80">
              <button
                type="button"
                onClick={() => setDeletingScreen(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl hover:bg-accent text-muted-foreground"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteScreenConfirm}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition shadow-sm"
              >
                Xóa Vĩnh Viễn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
