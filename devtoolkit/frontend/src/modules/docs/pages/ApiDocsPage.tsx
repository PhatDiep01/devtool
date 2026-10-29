import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Code2, 
  Terminal, 
  PanelRightClose, 
  PanelRightOpen, 
  HelpCircle, 
  Sparkles, 
  Layers,
  Loader2,
  FileCode,
  Play,
  FileText
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { 
  ApiEndpoint, 
  ApiModel, 
  ApiErrorCode, 
  ApiEnvironment, 
  Module, 
  Screen, 
  BugItem 
} from '@/types';
import { docsApi, apiDocsApi, bugsApi } from '../../../services/api';
import { ApiSidebarTree } from '../api-docs/components/ApiSidebarTree';
import { ApiEndpointDetailView } from '../api-docs/components/ApiEndpointDetailView';
import { ApiEndpointEditForm } from '../api-docs/components/ApiEndpointEditForm';
import { ApiCodeGenerator } from '../api-docs/components/ApiCodeGenerator';
import { ApiPostmanTester } from '../api-docs/components/ApiPostmanTester';
import { ApiModelsModal } from '../api-docs/components/ApiModelsModal';
import { ApiErrorCodesModal } from '../api-docs/components/ApiErrorCodesModal';
import { ApiImportExportModal } from '../api-docs/components/ApiImportExportModal';
import { ApiSearchPalette } from '../api-docs/components/ApiSearchPalette';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';

export const ApiDocsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Core Data
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<number>(() => {
    const fromParam = searchParams.get('moduleId');
    return fromParam ? Number(fromParam) : 1;
  });

  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [selectedEndpointId, setSelectedEndpointId] = useState<number | undefined>(() => {
    const fromParam = searchParams.get('endpointId');
    return fromParam ? Number(fromParam) : undefined;
  });

  const [models, setModels] = useState<ApiModel[]>([]);
  const [errorCodes, setErrorCodes] = useState<ApiErrorCode[]>([]);
  const [environments, setEnvironments] = useState<ApiEnvironment[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState<ApiEnvironment | undefined>();

  // Relational data for links
  const [screens, setScreens] = useState<Screen[]>([]);
  const [bugs, setBugs] = useState<BugItem[]>([]);

  // UI Modes
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>('view');
  const [viewTab, setViewTab] = useState<'docs' | 'tester'>('docs');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  // Modals
  const [isModelsOpen, setIsModelsOpen] = useState(false);
  const [isErrorCodesOpen, setIsErrorCodesOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isSearchPaletteOpen, setIsSearchPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<ApiEndpoint | null>(null);

  // Load modules list
  useEffect(() => {
    const loadModules = async () => {
      try {
        const res = await docsApi.getModules();
        setModules(res.data);
        if (res.data.length > 0) {
          const currentValid = res.data.some(m => m.id === selectedModuleId);
          if (!currentValid) {
            setSelectedModuleId(res.data[0].id);
          }
        }
      } catch (err: any) {
        console.error('Failed to load modules:', err);
      }
    };
    loadModules();
  }, []);

  // Load Relational Screens & Bugs once
  useEffect(() => {
    docsApi.getScreens().then(res => setScreens(res.data)).catch(() => {});
    bugsApi.getAll().then(res => setBugs(res.data.bugs)).catch(() => {});
  }, []);

  // Load Endpoints, Models, ErrorCodes & Environments when selectedModuleId changes
  const loadModuleData = useCallback(async () => {
    if (!selectedModuleId) return;
    try {
      setLoading(true);
      const [epRes, modelRes, errRes, envRes] = await Promise.all([
        apiDocsApi.getEndpoints({ moduleId: selectedModuleId }),
        apiDocsApi.getModels(selectedModuleId),
        apiDocsApi.getErrorCodes({ moduleId: selectedModuleId }),
        apiDocsApi.getEnvironments(selectedModuleId)
      ]);

      setEndpoints(epRes.data);
      setModels(modelRes.data);
      setErrorCodes(errRes.data);
      setEnvironments(envRes.data);

      if (envRes.data.length > 0 && !selectedEnvironment) {
        setSelectedEnvironment(envRes.data.find(e => e.is_default) || envRes.data[0]);
      }

      // Sync active endpoint
      const queryEndpointId = searchParams.get('endpointId') ? Number(searchParams.get('endpointId')) : undefined;
      if (queryEndpointId && epRes.data.some(e => e.id === queryEndpointId)) {
        setSelectedEndpointId(queryEndpointId);
      } else if (epRes.data.length > 0) {
        setSelectedEndpointId(epRes.data[0].id);
        setSearchParams({ moduleId: String(selectedModuleId), endpointId: String(epRes.data[0].id) });
      } else {
        setSelectedEndpointId(undefined);
      }
    } catch (err: any) {
      toast.error('Lỗi khi tải dữ liệu API: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedModuleId]);

  useEffect(() => {
    loadModuleData();
  }, [loadModuleData]);

  // Select endpoint handler (sync with URL)
  const handleSelectEndpoint = (endpoint: ApiEndpoint) => {
    setSelectedEndpointId(endpoint.id);
    setMode('view');
    setSearchParams({ moduleId: String(selectedModuleId), endpointId: String(endpoint.id) });
  };

  // Keyboard shortcuts (Ctrl+K, E, ?)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchPaletteOpen(true);
      } else if (e.key.toLowerCase() === 'e' && mode === 'view' && selectedEndpointId) {
        e.preventDefault();
        setMode('edit');
      } else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, selectedEndpointId]);

  // Selected endpoint object
  const activeEndpoint = endpoints.find(e => e.id === selectedEndpointId);

  // Distinct folders
  const folders = Array.from(new Set(endpoints.map(e => e.folder || 'Chung'))).filter(Boolean);
  if (!folders.includes('Chung')) folders.unshift('Chung');

  // Save endpoint handler
  const handleSaveEndpoint = async (data: Partial<ApiEndpoint>) => {
    try {
      setIsSaving(true);
      if (mode === 'edit' && selectedEndpointId) {
        const res = await apiDocsApi.updateEndpoint(selectedEndpointId, data);
        toast.success(`Đã cập nhật endpoint [${res.data.method}] ${res.data.path}`);
        setMode('view');
        await loadModuleData();
      } else {
        const res = await apiDocsApi.createEndpoint(data);
        toast.success(`Đã tạo mới endpoint [${res.data.method}] ${res.data.path}`);
        setSelectedEndpointId(res.data.id);
        setMode('view');
        setSearchParams({ moduleId: String(selectedModuleId), endpointId: String(res.data.id) });
        await loadModuleData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Duplicate handler
  const handleDuplicate = async () => {
    if (!selectedEndpointId) return;
    try {
      const res = await apiDocsApi.duplicateEndpoint(selectedEndpointId);
      toast.success('Đã nhân bản endpoint thành công!');
      setSelectedEndpointId(res.data.id);
      setSearchParams({ moduleId: String(selectedModuleId), endpointId: String(res.data.id) });
      await loadModuleData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Delete confirmed
  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await apiDocsApi.deleteEndpoint(deleteCandidate.id);
      toast.success('Đã xóa endpoint thành công!');
      setDeleteCandidate(null);
      await loadModuleData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Toggle Pin
  const handleTogglePin = async () => {
    if (!selectedEndpointId) return;
    try {
      const res = await apiDocsApi.togglePinEndpoint(selectedEndpointId);
      toast.success(res.data.is_pinned ? 'Đã ghim endpoint lên đầu' : 'Đã bỏ ghim');
      await loadModuleData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* 1. LEFT SIDEBAR: Tree & Navigation */}
      <div className="w-80 shrink-0 h-full hidden md:flex flex-col">
        <ApiSidebarTree
          modules={modules}
          selectedModuleId={selectedModuleId}
          onSelectModuleId={id => {
            setSelectedModuleId(id);
            setSearchParams({ moduleId: String(id) });
          }}
          endpoints={endpoints}
          selectedEndpointId={selectedEndpointId}
          onSelectEndpoint={handleSelectEndpoint}
          onOpenCreate={() => {
            setMode('create');
          }}
          onOpenModels={() => setIsModelsOpen(true)}
          onOpenErrorCodes={() => setIsErrorCodesOpen(true)}
          onOpenImportExport={() => setIsImportExportOpen(true)}
          onOpenSearchPalette={() => setIsSearchPaletteOpen(true)}
        />
      </div>

      {/* 2. MIDDLE AREA: Endpoint View / Edit Form */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-background">
        {/* Top Control Bar for Mobile & Panels */}
        <div className="h-11 border-b border-border bg-card px-4 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            {mode === 'view' && activeEndpoint ? (
              <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-xl border border-border">
                <button
                  onClick={() => setViewTab('docs')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 ${
                    viewTab === 'docs'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Đặc tả (Docs)</span>
                </button>
                <button
                  onClick={() => setViewTab('tester')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 ${
                    viewTab === 'tester'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Postman Tester</span>
                </button>
              </div>
            ) : (
              <span className="font-bold text-foreground">
                {mode === 'create' ? 'Tạo Endpoint Mới' : mode === 'edit' ? 'Đang Chỉnh Sửa' : 'Chi Tiết API'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsShortcutsOpen(true)}
              title="Phím tắt trợ giúp (?)"
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            {mode === 'view' && viewTab === 'docs' && (
              <button
                onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
                title={isRightPanelOpen ? 'Thu gọn khung code' : 'Mở rộng khung code'}
                className="hidden lg:flex p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted"
              >
                {isRightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Content Viewport */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
              <p className="text-xs">Đang nạp dữ liệu API...</p>
            </div>
          ) : mode === 'create' ? (
            <ApiEndpointEditForm
              moduleId={selectedModuleId}
              folders={folders}
              models={models}
              errorCodes={errorCodes}
              screens={screens}
              bugs={bugs}
              allEndpoints={endpoints}
              onSave={handleSaveEndpoint}
              onCancel={() => setMode('view')}
              isSaving={isSaving}
            />
          ) : mode === 'edit' && activeEndpoint ? (
            <ApiEndpointEditForm
              initialEndpoint={activeEndpoint}
              moduleId={selectedModuleId}
              folders={folders}
              models={models}
              errorCodes={errorCodes}
              screens={screens}
              bugs={bugs}
              allEndpoints={endpoints}
              onSave={handleSaveEndpoint}
              onCancel={() => setMode('view')}
              isSaving={isSaving}
            />
          ) : activeEndpoint ? (
            viewTab === 'tester' ? (
              <ApiPostmanTester
                endpoint={activeEndpoint}
                environments={environments}
                selectedEnvironment={selectedEnvironment}
                onSelectEnvironment={env => setSelectedEnvironment(env)}
                onSaveToSpecSuccess={loadModuleData}
                onSwitchToDocs={() => setViewTab('docs')}
              />
            ) : (
              <ApiEndpointDetailView
                endpoint={activeEndpoint}
                allEndpoints={endpoints}
                screens={screens}
                bugs={bugs}
                allErrorCodes={errorCodes}
                onEdit={() => setMode('edit')}
                onDuplicate={handleDuplicate}
                onDelete={() => setDeleteCandidate(activeEndpoint)}
                onTogglePin={handleTogglePin}
                onSelectErrorCode={code => {
                  setIsErrorCodesOpen(true);
                }}
                onTestPostman={() => setViewTab('tester')}
              />
            )
          ) : (
            /* Empty State */
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Code2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-1">Chưa có API endpoint nào được chọn</h3>
              <p className="text-xs max-w-md text-muted-foreground mb-6">
                Hãy chọn một API từ cây điều hướng bên trái hoặc tạo mới endpoint cho phân hệ này.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => setMode('create')}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  + Thêm Endpoint Mới
                </button>
                <button
                  onClick={() => setIsImportExportOpen(true)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-muted text-foreground hover:bg-muted/80 border border-border transition-colors"
                >
                  Nhập OpenAPI / cURL
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. RIGHT AREA: Code Generator & Fast Runner */}
      {isRightPanelOpen && activeEndpoint && mode === 'view' && viewTab === 'docs' && (
        <div className="w-96 shrink-0 h-full hidden lg:flex flex-col">
          <ApiCodeGenerator
            endpoint={activeEndpoint}
            environments={environments}
            selectedEnvironment={selectedEnvironment}
            onSelectEnvironment={env => setSelectedEnvironment(env)}
            onOpenPostmanTester={() => setViewTab('tester')}
          />
        </div>
      )}

      {/* MODALS */}
      <ApiModelsModal
        isOpen={isModelsOpen}
        onClose={() => setIsModelsOpen(false)}
        moduleId={selectedModuleId}
        endpoints={endpoints}
        onModelsChanged={loadModuleData}
      />

      <ApiErrorCodesModal
        isOpen={isErrorCodesOpen}
        onClose={() => setIsErrorCodesOpen(false)}
        moduleId={selectedModuleId}
        endpoints={endpoints}
        onErrorCodesChanged={loadModuleData}
      />

      <ApiImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        moduleId={selectedModuleId}
        onImportSuccess={loadModuleData}
      />

      <ApiSearchPalette
        isOpen={isSearchPaletteOpen}
        onClose={() => setIsSearchPaletteOpen(false)}
        endpoints={endpoints}
        onSelectEndpoint={handleSelectEndpoint}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteCandidate)}
        title="Xác nhận xóa Endpoint"
        description={`Bạn có chắc chắn muốn xóa endpoint [${deleteCandidate?.method}] ${deleteCandidate?.path}? Thao tác này không thể hoàn tác.`}
        confirmText="Xóa vĩnh viễn"
        cancelText="Hủy"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteCandidate(null)}
      />

      {/* Keyboard Shortcuts Dialog */}
      {isShortcutsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-sm font-bold text-foreground">Phím tắt thao tác nhanh</h3>
              <button onClick={() => setIsShortcutsOpen(false)} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-border/40">
                <span>Tìm kiếm toàn văn</span>
                <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono text-[10px]">Ctrl + K</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span>Chuyển sang chế độ Sửa</span>
                <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono text-[10px]">E</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span>Lưu thông tin khi sửa</span>
                <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono text-[10px]">Ctrl + S</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span>Hủy hoặc đóng hộp thoại</span>
                <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono text-[10px]">Esc</kbd>
              </div>
              <div className="flex justify-between py-1">
                <span>Mở bảng phím tắt này</span>
                <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono text-[10px]">?</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
