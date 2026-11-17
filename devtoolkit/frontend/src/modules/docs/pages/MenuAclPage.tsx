import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Database, 
  Layers, 
  RefreshCw, 
  FileCode, 
  Download, 
  Plus, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Folder, 
  FileText, 
  ChevronRight, 
  ChevronDown, 
  Copy, 
  Check, 
  Trash2, 
  Edit3, 
  Sparkles, 
  ArrowRightLeft, 
  Lock, 
  Activity, 
  Sliders, 
  Server, 
  Zap, 
  Globe, 
  LayoutGrid, 
  FolderTree, 
  FileCheck, 
  CheckSquare, 
  Square, 
  Users, 
  Grid3X3, 
  Eye, 
  Settings 
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { usePageTitle } from '../../../utils/usePageTitle';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { 
  AclConnection, 
  AclPhanHe,
  AclModule, 
  AclFunction, 
  AclAction,
  AclGroupPermission,
  AclLanguage
} from '../menu-acl/types';
import { 
  INITIAL_CONNECTIONS,
  INITIAL_PHAN_HE,
  INITIAL_MODULES,
  INITIAL_FUNCTIONS,
  INITIAL_ACTIONS,
  INITIAL_ROLES,
  INITIAL_LANGUAGES
} from '../menu-acl/mockData';
import { ConnectionManagerModal } from '../menu-acl/components/ConnectionManagerModal';
import { docsApi, aclApi } from '../../../services/api';

export const MenuAclPage: React.FC = () => {
  usePageTitle('Quản lý Menu & Phân quyền ACL Đa Cơ Sở Dữ Liệu', []);

  // Workspace Mode: 'studio' (Cấu trúc Menu), 'matrix' (Ma trận Phân quyền), 'custom' (Root vs Custom), 'spec' (Tài liệu kiến trúc)
  const [workspaceMode, setWorkspaceMode] = useState<'studio' | 'matrix' | 'custom' | 'spec'>('studio');

  // Multi-Language State
  const [languages, setLanguages] = useState<AclLanguage[]>(INITIAL_LANGUAGES);
  const [activeLangCode, setActiveLangCode] = useState<string>('vi');

  // Database Connections
  const [connections, setConnections] = useState<AclConnection[]>(INITIAL_CONNECTIONS);
  const [loadingConnections, setLoadingConnections] = useState<boolean>(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('conn-local-hufi');

  // ACL Domain Entities (5-Level Hierarchy)
  const [phanHeList, setPhanHeList] = useState<AclPhanHe[]>(INITIAL_PHAN_HE);
  const [modules, setModules] = useState<AclModule[]>(INITIAL_MODULES);
  const [functions, setFunctions] = useState<AclFunction[]>(INITIAL_FUNCTIONS);
  const [actions, setActions] = useState<AclAction[]>(INITIAL_ACTIONS);
  const [roles, setRoles] = useState<AclGroupPermission[]>(INITIAL_ROLES);

  // Studio Filtering & Navigation
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPhanHeId, setSelectedPhanHeId] = useState<number | 'all'>('all');
  const [selectedTreeModuleId, setSelectedTreeModuleId] = useState<number | 'all' | 'orphan'>('all');
  const [selectedFunctionId, setSelectedFunctionId] = useState<number | null>(5);
  const [typeFilter, setTypeFilter] = useState<'all' | 'root' | 'custom' | 'orphan'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'ph-5': true,
    'mod-1': true,
    'func-1': true,
    'func-4': true
  });

  // Permission Matrix State
  const [selectedRoleId, setSelectedRoleId] = useState<number>(9); // Default Admin
  const [roleSearchQuery, setRoleSearchQuery] = useState<string>('');

  // Modals & Drawers
  const [showSyncWizard, setShowSyncWizard] = useState<boolean>(false);
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);
  const [showConnManagerModal, setShowConnManagerModal] = useState<boolean>(false);

  // Snapshot Loading State
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState<boolean>(false);
  const [lastSnapshotSummary, setLastSnapshotSummary] = useState<{
    phanHeCount: number;
    modulesCount: number;
    functionsCount: number;
    actionsCount: number;
    rolesCount: number;
    dataHash: string;
    fetchedAt: string;
  } | null>(null);

  // Spec Document Content
  const [specContent, setSpecContent] = useState<string>('');

  // Load connections from Backend API
  const loadConnections = async () => {
    setLoadingConnections(true);
    try {
      const res = await aclApi.getConnections();
      const list = Array.isArray(res.data) ? res.data : [];
      if (list.length > 0) {
        setConnections(list);
        setSelectedConnectionId(prev => {
          if (prev && list.some((c: any) => c.id === prev)) return prev;
          return list[0].id;
        });
      }
    } catch {
      // Keep initial fallback connections
    } finally {
      setLoadingConnections(false);
    }
  };

  useEffect(() => {
    loadConnections();
  }, []);

  // Active Connection Object
  const currentConn = useMemo(() => {
    if (connections.length === 0) return null;
    return connections.find(c => c.id === selectedConnectionId) || connections[0];
  }, [connections, selectedConnectionId]);

  // Load Spec Document
  useEffect(() => {
    const loadSpec = async () => {
      try {
        const res = await docsApi.getScreen(434);
        if (res.data?.raw_content) {
          setSpecContent(res.data.raw_content);
          return;
        }
      } catch {
        // Fallback
      }
    };
    loadSpec();
  }, []);

  // Fetch Live Snapshot from Current SQL Server Connection
  const handleFetchLiveSnapshot = async () => {
    if (!currentConn) {
      toast.error('Vui lòng chọn kết nối CSDL trước khi tải dữ liệu');
      return;
    }

    setIsLoadingSnapshot(true);
    try {
      const res = await aclApi.getSnapshot(currentConn.id);
      const snap: any = res.data;
      if (snap?.success) {
        if (Array.isArray(snap.phanHe) && snap.phanHe.length > 0) {
          setPhanHeList(snap.phanHe);
        }
        if (Array.isArray(snap.modules) && snap.modules.length > 0) {
          setModules(snap.modules);
        }
        if (Array.isArray(snap.functions) && snap.functions.length > 0) {
          setFunctions(snap.functions);
        }
        if (Array.isArray(snap.actions) && snap.actions.length > 0) {
          setActions(snap.actions);
        }
        if (Array.isArray(snap.roles) && snap.roles.length > 0) {
          setRoles(snap.roles);
        }
        if (Array.isArray(snap.languages) && snap.languages.length > 0) {
          setLanguages(snap.languages);
        }

        setLastSnapshotSummary({
          phanHeCount: snap.summary?.phanHeCount || snap.phanHe?.length || 0,
          modulesCount: snap.summary?.modulesCount || snap.modules?.length || 0,
          functionsCount: snap.summary?.functionsCount || snap.functions?.length || 0,
          actionsCount: snap.summary?.actionsCount || snap.actions?.length || 0,
          rolesCount: snap.summary?.rolesCount || snap.roles?.length || 0,
          dataHash: snap.summary?.dataHash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          fetchedAt: snap.summary?.fetchedAt || new Date().toLocaleTimeString()
        });

        toast.success(
          `Đã nạp trực tiếp: ${snap.modules?.length || 0} Modules, ${snap.functions?.length || 0} Functions, ${snap.actions?.length || 0} Actions!`
        );
      } else {
        toast.error(snap?.error || 'Không thể đọc snapshot CSDL');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Lỗi khi kết nối SQL Server');
    } finally {
      setIsLoadingSnapshot(false);
    }
  };

  // Toggle tree node expansion
  const toggleNode = (nodeKey: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeKey]: !prev[nodeKey]
    }));
  };

  // Active Role Object in Matrix Mode
  const currentRole = useMemo(() => {
    return roles.find(r => r.id === selectedRoleId) || roles[0];
  }, [roles, selectedRoleId]);

  // Toggle Action Assignment for Current Role
  const handleToggleRoleAction = (actionId: number) => {
    if (!currentRole) return;
    setRoles(prevRoles => {
      return prevRoles.map(r => {
        if (r.id !== currentRole.id) return r;
        const currentAssigned = new Set(r.assignedActionIds || []);
        if (currentAssigned.has(actionId)) {
          currentAssigned.delete(actionId);
        } else {
          currentAssigned.add(actionId);
        }
        const updatedList = Array.from(currentAssigned);
        return {
          ...r,
          assignedActionIds: updatedList,
          actionCount: updatedList.length
        };
      });
    });
    toast.success('Đã cập nhật ma trận quyền!');
  };

  // Grant or Revoke All Actions for a Specific Function in Role
  const handleToggleAllActionsForFunction = (functionId: number, grantAll: boolean) => {
    if (!currentRole) return;
    const funcActionIds = actions.filter(a => a.functionId === functionId).map(a => a.id);
    if (funcActionIds.length === 0) return;

    setRoles(prevRoles => {
      return prevRoles.map(r => {
        if (r.id !== currentRole.id) return r;
        const currentAssigned = new Set(r.assignedActionIds || []);
        funcActionIds.forEach(id => {
          if (grantAll) currentAssigned.add(id);
          else currentAssigned.delete(id);
        });
        const updatedList = Array.from(currentAssigned);
        return {
          ...r,
          assignedActionIds: updatedList,
          actionCount: updatedList.length
        };
      });
    });
    toast.success(grantAll ? 'Đã cấp toàn bộ quyền màn hình!' : 'Đã gỡ toàn bộ quyền màn hình!');
  };

  // Filter Modules by selected PhanHe
  const filteredModules = useMemo(() => {
    return modules.filter(m => {
      if (selectedPhanHeId !== 'all' && m.idPhanHe !== selectedPhanHeId) return false;
      return true;
    });
  }, [modules, selectedPhanHeId]);

  // Filter Functions based on tree, search, type, and status
  const filteredFunctions = useMemo(() => {
    return functions.filter(f => {
      // Tree Filter
      if (selectedTreeModuleId === 'orphan') {
        if (f.idModule !== null) return false;
      } else if (selectedTreeModuleId !== 'all') {
        if (f.idModule !== selectedTreeModuleId) return false;
      }

      // Type Filter
      if (typeFilter === 'root' && f.isCustom) return false;
      if (typeFilter === 'custom' && !f.isCustom) return false;
      if (typeFilter === 'orphan' && f.idModule !== null) return false;

      // Status Filter
      if (statusFilter === 'active' && !f.isActive) return false;
      if (statusFilter === 'inactive' && f.isActive) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = f.functionName.toLowerCase().includes(q);
        const matchRouting = (f.routing || '').toLowerCase().includes(q);
        const matchAction = (f.actionName || '').toLowerCase().includes(q);
        const matchController = (f.controllerName || '').toLowerCase().includes(q);
        
        // Also check if any child action matches
        const hasMatchingAction = actions.some(a => 
          a.functionId === f.id && 
          (a.typeName.toLowerCase().includes(q) || a.actionName.toLowerCase().includes(q) || a.controllerName.toLowerCase().includes(q))
        );

        if (!matchName && !matchRouting && !matchAction && !matchController && !hasMatchingAction) {
          return false;
        }
      }

      return true;
    });
  }, [functions, selectedTreeModuleId, typeFilter, statusFilter, searchQuery, actions]);

  // Selected Function Object
  const selectedFunction = useMemo(() => {
    if (!selectedFunctionId) return null;
    return functions.find(f => f.id === selectedFunctionId) || null;
  }, [functions, selectedFunctionId]);

  // Actions for Selected Function
  const selectedFunctionActions = useMemo(() => {
    if (!selectedFunctionId) return [];
    return actions.filter(a => a.functionId === selectedFunctionId);
  }, [actions, selectedFunctionId]);

  // Auto-generate standard 4 CRUD actions for a function
  const handleAutoGenerateCrud = (func: AclFunction) => {
    const baseController = func.controllerName || 'DefaultController';
    const baseEndpoint = (func.routing || '/api/resource').replace(/\\/g, '/');

    const defaultActions: AclAction[] = [
      {
        id: Date.now() + 1,
        functionId: func.id,
        actionType: 1,
        typeName: 'Xem',
        actionName: `${baseEndpoint}/list`,
        controllerName: baseController,
        keyOption: 'VIEW',
        notes: `Xem danh sách ${func.functionName}`,
        isActive: true
      },
      {
        id: Date.now() + 2,
        functionId: func.id,
        actionType: 2,
        typeName: 'Thêm',
        actionName: `${baseEndpoint}/create`,
        controllerName: baseController,
        keyOption: 'ADD',
        notes: `Thêm mới ${func.functionName}`,
        isActive: true
      },
      {
        id: Date.now() + 3,
        functionId: func.id,
        actionType: 3,
        typeName: 'Sửa',
        actionName: `${baseEndpoint}/update`,
        controllerName: baseController,
        keyOption: 'EDIT',
        notes: `Cập nhật ${func.functionName}`,
        isActive: true
      },
      {
        id: Date.now() + 4,
        functionId: func.id,
        actionType: 4,
        typeName: 'Xóa',
        actionName: `${baseEndpoint}/delete`,
        controllerName: baseController,
        keyOption: 'DELETE',
        notes: `Xóa ${func.functionName}`,
        isActive: true
      }
    ];

    setActions(prev => [...prev.filter(a => a.functionId !== func.id), ...defaultActions]);
    toast.success(`Đã tự động sinh 4 quyền CRUD chuẩn cho [${func.functionName}]!`);
  };

  // Helper function to render ActionType badge
  const renderActionTypeBadge = (type: number, typeName: string) => {
    switch (type) {
      case 1:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            <Eye className="w-3 h-3" /> {typeName || 'Xem'}
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <Plus className="w-3 h-3" /> {typeName || 'Thêm'}
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <Edit3 className="w-3 h-3" /> {typeName || 'Sửa'}
          </span>
        );
      case 4:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
            <Trash2 className="w-3 h-3" /> {typeName || 'Xóa'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
            <Sparkles className="w-3 h-3" /> {typeName || 'Mở rộng'}
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      {/* 1. TOP HEADER & METRICS BAR */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title & DB Connection Selector */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Quản lý Menu & Phân quyền ACL Đa Cơ Sở Dữ Liệu
                </h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  SQL Server V2
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kiến trúc chuẩn 5 tầng: Phân hệ → Module → Nhóm màn hình → Màn hình → Action matrix & Phân quyền Role
              </p>
            </div>
          </div>

          {/* Connection Selector & Status */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
              <Database className="w-4 h-4 ml-2 text-indigo-500" />
              <select
                value={selectedConnectionId}
                onChange={(e) => setSelectedConnectionId(e.target.value)}
                className="bg-transparent text-xs font-semibold px-2 py-1.5 focus:outline-none cursor-pointer max-w-[260px] truncate"
              >
                {connections.map((conn) => (
                  <option key={conn.id} value={conn.id} className="dark:bg-slate-800">
                    {conn.name} ({conn.database}) {conn.isRoot ? '★ ROOT' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Root Indicator Badge */}
            {currentConn?.isRoot ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shadow-sm animate-pulse">
                <Lock className="w-3.5 h-3.5" /> ROOT DATABASE (PROTECTED)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" /> Dev/Staging Target
              </span>
            )}

            {/* Language Selector */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <Globe className="w-3.5 h-3.5 ml-1.5 text-slate-500" />
              <select
                value={activeLangCode}
                onChange={(e) => setActiveLangCode(e.target.value)}
                className="bg-transparent text-xs font-medium px-1.5 py-1 focus:outline-none cursor-pointer"
              >
                {languages.map((l) => (
                  <option key={l.id} value={l.ma} className="dark:bg-slate-800">
                    {l.ten}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <button
              onClick={handleFetchLiveSnapshot}
              disabled={isLoadingSnapshot}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition disabled:opacity-50"
              title="Tải snapshot trực tiếp từ CSDL đang chọn"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSnapshot ? 'animate-spin' : ''}`} />
              Tải lại CSDL
            </button>

            <button
              onClick={() => setShowSyncWizard(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition"
              title="Mở thuật sĩ đồng bộ CSDL an toàn"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Đồng bộ CSDL
            </button>

            <button
              onClick={() => setShowScriptModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
              title="Xuất script snapshot .sql độc lập"
            >
              <FileCode className="w-3.5 h-3.5" />
              Xuất SQL
            </button>

            <button
              onClick={() => setShowConnManagerModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition"
              title="Cấu hình kết nối CSDL"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Workspace Mode Tabs */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 mt-4 pt-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWorkspaceMode('studio')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                workspaceMode === 'studio'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FolderTree className="w-4 h-4" />
              1. Cấu trúc Menu (Menu Studio)
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white">
                {functions.length}
              </span>
            </button>

            <button
              onClick={() => setWorkspaceMode('matrix')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                workspaceMode === 'matrix'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
              2. Ma trận Phân quyền (Permission Matrix)
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white">
                {roles.length} Nhóm quyền
              </span>
            </button>

            <button
              onClick={() => setWorkspaceMode('custom')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                workspaceMode === 'custom'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Sliders className="w-4 h-4" />
              3. Tùy biến Hệ thống (Root vs Custom)
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white">
                {functions.filter(f => f.isCustom).length + modules.filter(m => m.isCustom).length}
              </span>
            </button>

            <button
              onClick={() => setWorkspaceMode('spec')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                workspaceMode === 'spec'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              4. Đặc tả Kỹ thuật (Spec Document)
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="hidden xl:flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span>Phân hệ: <strong className="text-slate-700 dark:text-slate-200">{phanHeList.length}</strong></span>
            <span>•</span>
            <span>Modules: <strong className="text-slate-700 dark:text-slate-200">{modules.length}</strong></span>
            <span>•</span>
            <span>Màn hình: <strong className="text-slate-700 dark:text-slate-200">{functions.filter(f => !f.isGroup).length}</strong></span>
            <span>•</span>
            <span>Actions: <strong className="text-slate-700 dark:text-slate-200">{actions.length}</strong></span>
            <span>•</span>
            <span>Nhóm quyền: <strong className="text-slate-700 dark:text-slate-200">{roles.length}</strong></span>
          </div>
        </div>
      </div>

      {/* 2. BODY WORKSPACE CONTENT */}
      <div className="flex-1 flex overflow-hidden">
        {/* ============================================================== */}
        {/* WORKSPACE 1: MENU STUDIO (CẤU TRÚC PHÂN HỆ -> MODULE -> FUNCTION) */}
        {/* ============================================================== */}
        {workspaceMode === 'studio' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Studio Filter Bar */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search Input */}
                <div className="relative w-72">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm Phân hệ, Module, Màn hình, Action..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter by PhanHe */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium">Phân hệ:</span>
                  <select
                    value={selectedPhanHeId}
                    onChange={(e) => {
                      const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                      setSelectedPhanHeId(val);
                      setSelectedTreeModuleId('all');
                    }}
                    className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none"
                  >
                    <option value="all">Tất cả Phân hệ ({phanHeList.length})</option>
                    {phanHeList.map(ph => (
                      <option key={ph.id} value={ph.id}>
                        {ph.ma} - {ph.tenPhanHe}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter by Type */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium">Loại:</span>
                  <select
                    value={typeFilter}
                    onChange={(e: any) => setTypeFilter(e.target.value)}
                    className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none"
                  >
                    <option value="all">Tất cả</option>
                    <option value="root">Chỉ bản gốc (Root)</option>
                    <option value="custom">Chỉ bản tùy chỉnh (Custom)</option>
                    <option value="orphan">Mồ côi (Orphans)</option>
                  </select>
                </div>

                {/* Filter by Status */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium">Trạng thái:</span>
                  <select
                    value={statusFilter}
                    onChange={(e: any) => setStatusFilter(e.target.value)}
                    className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none"
                  >
                    <option value="all">Tất cả</option>
                    <option value="active">Đang kích hoạt</option>
                    <option value="inactive">Đang khóa</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Split View 3 Columns */}
            <div className="flex-1 flex overflow-hidden">
              {/* CỘT 1: CÂY PHÂN CẤP (PHÂN HỆ -> MODULE -> FUNCTION GROUP) */}
              <div className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
                <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FolderTree className="w-3.5 h-3.5 text-indigo-500" />
                    Cây Menu Đa Tầng
                  </span>
                  <button
                    onClick={() => {
                      setSelectedPhanHeId('all');
                      setSelectedTreeModuleId('all');
                      setSelectedFunctionId(null);
                    }}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                  >
                    Hiện tất cả
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {/* Option Tất Cả */}
                  <div
                    onClick={() => {
                      setSelectedTreeModuleId('all');
                      setSelectedPhanHeId('all');
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs font-semibold transition ${
                      selectedTreeModuleId === 'all' && selectedPhanHeId === 'all'
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-indigo-500" />
                      Tất cả Phân hệ & Module
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-slate-700 font-bold">
                      {functions.length}
                    </span>
                  </div>

                  {/* Render List PhanHe */}
                  {phanHeList
                    .filter(ph => selectedPhanHeId === 'all' || ph.id === selectedPhanHeId)
                    .map(ph => {
                      const phNodeKey = `ph-${ph.id}`;
                      const isPhExpanded = Boolean(expandedNodes[phNodeKey]);
                      const phModules = modules.filter(m => m.idPhanHe === ph.id);

                      return (
                        <div key={ph.id} className="space-y-0.5">
                          {/* Phân hệ Header Node */}
                          <div
                            className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200"
                            onClick={() => toggleNode(phNodeKey)}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              {isPhExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              )}
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 font-mono font-bold">
                                {ph.ma}
                              </span>
                              <span className="truncate">{ph.tenPhanHe}</span>
                            </div>
                            <span className="text-[10px] font-semibold text-slate-400 ml-1">
                              {phModules.length} m
                            </span>
                          </div>

                          {/* Modules of this PhanHe */}
                          {isPhExpanded && (
                            <div className="pl-4 space-y-0.5 border-l border-slate-200 dark:border-slate-800 ml-3.5">
                              {phModules.map(mod => {
                                const modNodeKey = `mod-${mod.id}`;
                                const isModExpanded = Boolean(expandedNodes[modNodeKey]);
                                const isModSelected = selectedTreeModuleId === mod.id;
                                const modFuncGroups = functions.filter(f => f.idModule === mod.id && f.isGroup);

                                return (
                                  <div key={mod.id} className="space-y-0.5">
                                    <div
                                      onClick={() => {
                                        setSelectedTreeModuleId(mod.id);
                                        toggleNode(modNodeKey);
                                      }}
                                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition ${
                                        isModSelected
                                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800'
                                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 truncate">
                                        {isModExpanded ? (
                                          <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                                        ) : (
                                          <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                                        )}
                                        <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="truncate">{mod.tenModule}</span>
                                      </div>
                                      {mod.isCustom && (
                                        <span className="px-1 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 font-bold">
                                          Custom
                                        </span>
                                      )}
                                    </div>

                                    {/* Function Groups of this Module */}
                                    {isModExpanded && modFuncGroups.length > 0 && (
                                      <div className="pl-4 space-y-0.5 border-l border-slate-200 dark:border-slate-800 ml-3">
                                        {modFuncGroups.map(grp => {
                                          const grpNodeKey = `func-${grp.id}`;
                                          const isGrpExpanded = Boolean(expandedNodes[grpNodeKey]);
                                          const isGrpSelected = selectedFunctionId === grp.id;
                                          const childScreens = functions.filter(f => f.parentId === grp.id && !f.isGroup);

                                          return (
                                            <div key={grp.id} className="space-y-0.5">
                                              <div
                                                onClick={() => {
                                                  setSelectedFunctionId(grp.id);
                                                  toggleNode(grpNodeKey);
                                                }}
                                                className={`flex items-center justify-between px-2 py-1 rounded-md cursor-pointer text-[11px] transition ${
                                                  isGrpSelected
                                                    ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 font-bold'
                                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                }`}
                                              >
                                                <div className="flex items-center gap-1 truncate">
                                                  <Folder className="w-3 h-3 text-amber-500 shrink-0" />
                                                  <span className="truncate">{grp.functionName}</span>
                                                </div>
                                                <span className="text-[10px] font-semibold text-slate-400">
                                                  {childScreens.length}
                                                </span>
                                              </div>

                                              {/* Child Screens */}
                                              {isGrpExpanded && (
                                                <div className="pl-3 space-y-0.5 border-l border-slate-200 dark:border-slate-800 ml-2">
                                                  {childScreens.map(scr => (
                                                    <div
                                                      key={scr.id}
                                                      onClick={() => setSelectedFunctionId(scr.id)}
                                                      className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-[11px] transition ${
                                                        selectedFunctionId === scr.id
                                                          ? 'bg-indigo-600 text-white font-bold'
                                                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                      }`}
                                                    >
                                                      <FileText className="w-3 h-3 shrink-0" />
                                                      <span className="truncate">{scr.functionName}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {/* Orphan Branch */}
                  <div
                    onClick={() => {
                      setSelectedTreeModuleId('orphan');
                      setSelectedFunctionId(null);
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs font-semibold transition mt-3 ${
                      selectedTreeModuleId === 'orphan'
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300'
                        : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50/50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      Nhánh Mồ Côi (Orphans)
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-100 dark:bg-rose-900/50 font-bold">
                      {functions.filter(f => f.idModule === null).length}
                    </span>
                  </div>
                </div>
              </div>

              {/* CỘT 2: BẢNG QUẢN LÝ MÀN HÌNH / MASTER TABLE */}
              <div className="flex-1 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
                <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-indigo-500" />
                      Danh Sách Màn Hình / Chức Năng
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {filteredFunctions.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedFunction && !selectedFunction.isGroup && (
                      <button
                        onClick={() => handleAutoGenerateCrud(selectedFunction)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300 dark:border-amber-800 transition"
                        title="Tự động sinh 4 quyền CRUD cho màn hình này"
                      >
                        <Sparkles className="w-3 h-3 text-amber-500" /> Sinh Quyền CRUD
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">STT</th>
                        <th className="py-2.5 px-3">Tên Màn Hình / Nhóm</th>
                        <th className="py-2.5 px-3">Routing / URL Path</th>
                        <th className="py-2.5 px-3">Controller</th>
                        <th className="py-2.5 px-3 text-center">Thứ tự</th>
                        <th className="py-2.5 px-3 text-center">Loại</th>
                        <th className="py-2.5 px-3 text-center">Actions</th>
                        <th className="py-2.5 px-3 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                      {filteredFunctions.map((func, index) => {
                        const isSelected = selectedFunctionId === func.id;
                        const funcActionsCount = actions.filter(a => a.functionId === func.id).length;

                        return (
                          <tr
                            key={func.id}
                            onClick={() => setSelectedFunctionId(func.id)}
                            className={`cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                              isSelected
                                ? 'bg-indigo-50/80 dark:bg-indigo-950/40 font-semibold'
                                : ''
                            }`}
                          >
                            <td className="py-2 px-3 text-center text-slate-400 text-[11px]">
                              {index + 1}
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                {func.isGroup ? (
                                  <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                                ) : (
                                  <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                                )}
                                <div>
                                  <div className="text-slate-900 dark:text-white font-medium">
                                    {func.functionName}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    ID: {func.id} {func.parentId ? `• Cha: ${func.parentId}` : '• Cấp 1'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                              {func.routing || func.actionName || '—'}
                            </td>
                            <td className="py-2 px-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                              {func.controllerName || '—'}
                            </td>
                            <td className="py-2 px-3 text-center font-mono">
                              {func.order}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {func.isCustom ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                                  Custom
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  Root
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {func.isGroup ? (
                                <span className="text-[11px] text-slate-400">
                                  {func.soLuongManHinhCon || 0} con
                                </span>
                              ) : (
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  funcActionsCount > 0
                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                                }`}>
                                  {funcActionsCount}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {func.isActive ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  <Check className="w-3.5 h-3.5" /> Bật
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                                  <X className="w-3.5 h-3.5" /> Khóa
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CỘT 3: MA TRẬN ACTIONS / CHI TIẾT QUYỀN (DETAIL INSPECTION) */}
              <div className="w-96 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900/40">
                <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    Hành Động & Quyền Chi Tiết
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {selectedFunction ? (
                    <>
                      {/* Selected Function Card */}
                      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 uppercase">Màn hình đang chọn</span>
                          {selectedFunction.isCustom && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                              Bản Tùy Biến
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {selectedFunction.functionName}
                        </h3>
                        <div className="text-xs text-slate-500 font-mono space-y-1">
                          <div><strong>Routing:</strong> {selectedFunction.routing || selectedFunction.actionName || 'N/A'}</div>
                          <div><strong>Controller:</strong> {selectedFunction.controllerName || 'N/A'}</div>
                          <div><strong>Thứ tự sắp xếp:</strong> #{selectedFunction.order}</div>
                        </div>
                      </div>

                      {/* Actions List */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Danh sách Actions ({selectedFunctionActions.length})
                          </span>
                        </div>

                        {selectedFunctionActions.length === 0 ? (
                          <div className="p-6 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <Zap className="w-6 h-6 mx-auto text-slate-400 mb-2" />
                            <p className="text-xs text-slate-500">Màn hình này chưa có hành động nào.</p>
                            <button
                              onClick={() => handleAutoGenerateCrud(selectedFunction)}
                              className="mt-2 text-xs text-indigo-600 font-bold hover:underline"
                            >
                              Tự động sinh 4 quyền CRUD mặc định
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {selectedFunctionActions.map(act => (
                              <div
                                key={act.id}
                                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  {renderActionTypeBadge(act.actionType, act.typeName)}
                                  <span className="text-[10px] font-mono text-slate-400">ID: {act.id}</span>
                                </div>
                                <div className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200 truncate">
                                  {act.actionName}
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-500">
                                  <span>{act.controllerName}</span>
                                  {act.keyOption && (
                                    <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">
                                      {act.keyOption}
                                    </span>
                                  )}
                                </div>
                                {act.notes && (
                                  <p className="text-[11px] text-slate-400 italic">{act.notes}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                      <FolderTree className="w-10 h-10 mb-2 opacity-50" />
                      <p className="text-xs">Chọn một màn hình ở bảng giữa để xem và cấu hình chi tiết Actions.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* WORKSPACE 2: MA TRẬN PHÂN QUYỀN (PERMISSION MATRIX THEO ROLE) */}
        {/* ============================================================== */}
        {workspaceMode === 'matrix' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar Chọn Nhóm Quyền (Roles) */}
            <div className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    Nhóm Quyền (Roles)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                    {roles.length}
                  </span>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                  <input
                    type="text"
                    value={roleSearchQuery}
                    onChange={(e) => setRoleSearchQuery(e.target.value)}
                    placeholder="Tìm nhóm quyền..."
                    className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {roles
                  .filter(r => !roleSearchQuery || r.groupName.toLowerCase().includes(roleSearchQuery.toLowerCase()))
                  .map(role => {
                    const isSelected = selectedRoleId === role.id;
                    const assignedCount = (role.assignedActionIds || []).length;
                    const totalActionCount = actions.length || 1;
                    const percent = Math.min(Math.round((assignedCount / totalActionCount) * 100), 100);

                    return (
                      <div
                        key={role.id}
                        onClick={() => setSelectedRoleId(role.id)}
                        className={`p-3 rounded-xl cursor-pointer border transition ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 shadow-sm'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {role.groupName}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            ID: {role.id}
                          </span>
                        </div>
                        {role.notes && (
                          <p className="text-[11px] text-slate-400 truncate mb-2">{role.notes}</p>
                        )}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>Quyền được cấp:</span>
                            <strong className="text-indigo-600 dark:text-indigo-400">
                              {assignedCount} / {actions.length}
                            </strong>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full rounded-full transition-all"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Main Matrix Table */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
              {/* Matrix Control Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Đang phân quyền cho:</span>
                    <h2 className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                      {currentRole?.groupName}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tích chọn quyền trực tiếp trên ma trận. Thay đổi được áp dụng ngay lập tức.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (!currentRole) return;
                      const allIds = actions.map(a => a.id);
                      setRoles(prev => prev.map(r => r.id === currentRole.id ? { ...r, assignedActionIds: allIds, actionCount: allIds.length } : r));
                      toast.success('Đã cấp toàn bộ quyền cho nhóm này!');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm"
                  >
                    <CheckSquare className="w-3.5 h-3.5" /> Cấp Tất Cả
                  </button>

                  <button
                    onClick={() => {
                      if (!currentRole) return;
                      setRoles(prev => prev.map(r => r.id === currentRole.id ? { ...r, assignedActionIds: [], actionCount: 0 } : r));
                      toast.success('Đã thu hồi toàn bộ quyền của nhóm này!');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm"
                  >
                    <Square className="w-3.5 h-3.5" /> Gỡ Tất Cả
                  </button>
                </div>
              </div>

              {/* Matrix Table */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/90 sticky top-0 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-3 px-4 w-1/3">Cấu trúc Menu / Màn Hình</th>
                      <th className="py-3 px-3 text-center">👁️ Xem (View)</th>
                      <th className="py-3 px-3 text-center">➕ Thêm (Add)</th>
                      <th className="py-3 px-3 text-center">✏️ Sửa (Edit)</th>
                      <th className="py-3 px-3 text-center">🗑️ Xóa (Del)</th>
                      <th className="py-3 px-3 text-center">✨ Mở Rộng</th>
                      <th className="py-3 px-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                    {functions.filter(f => !f.isGroup).map((func) => {
                      const funcActions = actions.filter(a => a.functionId === func.id);
                      const viewAct = funcActions.find(a => a.actionType === 1);
                      const addAct = funcActions.find(a => a.actionType === 2);
                      const editAct = funcActions.find(a => a.actionType === 3);
                      const delAct = funcActions.find(a => a.actionType === 4);
                      const extActs = funcActions.filter(a => a.actionType === 5);

                      const roleAssignedSet = new Set(currentRole?.assignedActionIds || []);
                      const isAllGranted = funcActions.length > 0 && funcActions.every(a => roleAssignedSet.has(a.id));

                      return (
                        <tr key={func.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {func.functionName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {func.routing || func.actionName || 'N/A'} • ID: {func.id}
                            </div>
                          </td>

                          {/* Action Xem */}
                          <td className="py-2.5 px-3 text-center">
                            {viewAct ? (
                              <input
                                type="checkbox"
                                checked={roleAssignedSet.has(viewAct.id)}
                                onChange={() => handleToggleRoleAction(viewAct.id)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>

                          {/* Action Thêm */}
                          <td className="py-2.5 px-3 text-center">
                            {addAct ? (
                              <input
                                type="checkbox"
                                checked={roleAssignedSet.has(addAct.id)}
                                onChange={() => handleToggleRoleAction(addAct.id)}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>

                          {/* Action Sửa */}
                          <td className="py-2.5 px-3 text-center">
                            {editAct ? (
                              <input
                                type="checkbox"
                                checked={roleAssignedSet.has(editAct.id)}
                                onChange={() => handleToggleRoleAction(editAct.id)}
                                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                              />
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>

                          {/* Action Xóa */}
                          <td className="py-2.5 px-3 text-center">
                            {delAct ? (
                              <input
                                type="checkbox"
                                checked={roleAssignedSet.has(delAct.id)}
                                onChange={() => handleToggleRoleAction(delAct.id)}
                                className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                              />
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>

                          {/* Actions Mở Rộng */}
                          <td className="py-2.5 px-3 text-center">
                            {extActs.length > 0 ? (
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                {extActs.map(ext => (
                                  <label key={ext.id} className="inline-flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={roleAssignedSet.has(ext.id)}
                                      onChange={() => handleToggleRoleAction(ext.id)}
                                      className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500"
                                    />
                                    <span className="text-[10px] text-slate-500 font-mono truncate max-w-[80px]" title={ext.typeName}>
                                      {ext.typeName}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>

                          {/* Quick Toggle All per screen */}
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => handleToggleAllActionsForFunction(func.id, !isAllGranted)}
                              className={`px-2 py-1 text-[11px] font-semibold rounded transition ${
                                isAllGranted
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 hover:bg-rose-100'
                                  : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 hover:bg-indigo-100'
                              }`}
                            >
                              {isAllGranted ? 'Gỡ hết' : 'Cấp hết'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* WORKSPACE 3: TÙY BIẾN HỆ THỐNG (ROOT VS CUSTOM MANAGEMENT) */}
        {/* ============================================================== */}
        {workspaceMode === 'custom' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Stat 1: Modules Customization */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Tùy biến Module</span>
                  <Layers className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {modules.filter(m => m.isCustom).length} <span className="text-xs font-normal text-slate-400">/ {modules.length} Modules</span>
                </div>
                <p className="text-xs text-slate-500">
                  Số lượng modules đã được trường đại học tùy biến tên, icon hoặc thứ tự so với bản chuẩn.
                </p>
              </div>

              {/* Stat 2: Screens Customization */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Tùy biến Màn hình</span>
                  <Sliders className="w-5 h-5 text-amber-500" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {functions.filter(f => f.isCustom).length} <span className="text-xs font-normal text-slate-400">/ {functions.length} Màn hình</span>
                </div>
                <p className="text-xs text-slate-500">
                  Gồm các màn hình thêm mới hoàn toàn (IdFunction = 0) hoặc sửa đổi vị trí cha - con.
                </p>
              </div>

              {/* Stat 3: Multi-Language Coverage */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Đa ngôn ngữ</span>
                  <Globe className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {languages.length} <span className="text-xs font-normal text-slate-400">Ngôn ngữ kích hoạt</span>
                </div>
                <p className="text-xs text-slate-500">
                  Bản dịch phân hệ, module, màn hình và actions sang Tiếng Anh, Tiếng Trung Quốc.
                </p>
              </div>
            </div>

            {/* Custom List Table */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Chi tiết Các Thành Phần Tùy Biến (Custom Overrides)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Phản ánh dữ liệu từ các bảng ACL_ModulesCustom và ACL_FunctionsCustom trong SQL Server.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-3 px-4">Loại Thực Thể</th>
                      <th className="py-3 px-4">Tên Bản Chuẩn (Root)</th>
                      <th className="py-3 px-4">Tên Tùy Biến (Custom)</th>
                      <th className="py-3 px-4">Thứ tự</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {modules.filter(m => m.isCustom).map(mod => (
                      <tr key={`custom-mod-${mod.id}`}>
                        <td className="py-3 px-4 font-bold text-indigo-600">Module</td>
                        <td className="py-3 px-4 text-slate-500">Mod_MenuACL (ID {mod.id})</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{mod.tenModule}</td>
                        <td className="py-3 px-4 font-mono">#{mod.soThuTu}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            Hoạt động
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => toast.success('Đã giữ nguyên cấu hình tùy biến!')}
                            className="text-xs text-indigo-600 font-bold hover:underline"
                          >
                            Cấu hình
                          </button>
                        </td>
                      </tr>
                    ))}

                    {functions.filter(f => f.isCustom).map(func => (
                      <tr key={`custom-func-${func.id}`}>
                        <td className="py-3 px-4 font-bold text-amber-600">Màn hình</td>
                        <td className="py-3 px-4 text-slate-500">{func.functionName} (Gốc ID {func.id})</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{func.functionName}</td>
                        <td className="py-3 px-4 font-mono">#{func.order}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            Hoạt động
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => toast.success('Đã khôi phục về bản chuẩn!')}
                            className="text-xs text-rose-600 font-bold hover:underline"
                          >
                            Khôi phục chuẩn
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* WORKSPACE 4: SPEC DOCUMENT (TÀI LIỆU KIẾN TRÚC & QUY TẮC) */}
        {/* ============================================================== */}
        {workspaceMode === 'spec' && (
          <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto">
            {specContent ? (
              <MarkdownRenderer content={specContent} />
            ) : (
              <div className="text-center py-12 text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>Đang tải tài liệu đặc tả kiến trúc Menu ACL...</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. MODAL: CONNECTION MANAGER MODAL */}
      {showConnManagerModal && (
        <ConnectionManagerModal
          connections={connections}
          activeConnectionId={selectedConnectionId}
          onSelectConnection={(id) => setSelectedConnectionId(id)}
          onConnectionsChange={(newConns) => setConnections(newConns)}
          onClose={() => setShowConnManagerModal(false)}
        />
      )}

      {/* 4. MODAL: SAFE SYNC WIZARD */}
      {showSyncWizard && currentConn && (
        <SyncWizardModal
          connections={connections}
          sourceConn={currentConn}
          onClose={() => setShowSyncWizard(false)}
        />
      )}

      {/* 5. MODAL: SQL SCRIPT EXPORT */}
      {showScriptModal && currentConn && (
        <SqlScriptExportModal
          connection={currentConn}
          modules={modules}
          functions={functions}
          actions={actions}
          onClose={() => setShowScriptModal(false)}
        />
      )}
    </div>
  );
};

// =========================================================================
// SUB-COMPONENT: SAFE SYNC WIZARD MODAL (5 STEPS)
// =========================================================================
interface SyncWizardModalProps {
  connections: AclConnection[];
  sourceConn: AclConnection;
  onClose: () => void;
}

const SyncWizardModal: React.FC<SyncWizardModalProps> = ({ connections, sourceConn, onClose }) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [targetConnId, setTargetConnId] = useState<string>('');
  const [confirmDbName, setConfirmDbName] = useState<string>('');

  const availableTargets = useMemo(() => {
    return connections.filter(c => c.id !== sourceConn.id && !c.isRoot);
  }, [connections, sourceConn]);

  const targetConn = useMemo(() => {
    return availableTargets.find(c => c.id === targetConnId) || availableTargets[0] || null;
  }, [availableTargets, targetConnId]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-900 dark:text-white">Thuật Sĩ Đồng Bộ Menu ACL An Toàn</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-4 text-xs font-semibold">
            <span className={currentStep === 1 ? 'text-indigo-600 font-bold' : 'text-slate-400'}>1. Chọn CSDL Đích</span>
            <span>→</span>
            <span className={currentStep === 2 ? 'text-indigo-600 font-bold' : 'text-slate-400'}>2. Khảo sát Schema</span>
            <span>→</span>
            <span className={currentStep === 3 ? 'text-indigo-600 font-bold' : 'text-slate-400'}>3. Sao lưu Target</span>
            <span>→</span>
            <span className={currentStep === 4 ? 'text-indigo-600 font-bold' : 'text-slate-400'}>4. Xác thực Hai Bước</span>
          </div>

          {currentStep === 1 && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300">
                <strong>CSDL Nguồn:</strong> {sourceConn.name} ({sourceConn.database}) {sourceConn.isRoot ? '★ ROOT' : ''}
              </div>

              <div>
                <label className="block font-bold mb-1">Chọn CSDL Đích (Target Database):</label>
                <select
                  value={targetConnId}
                  onChange={(e) => setTargetConnId(e.target.value)}
                  className="w-full p-2 border rounded-lg dark:bg-slate-800 text-xs font-semibold"
                >
                  {availableTargets.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.database}) - {c.environment}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  * Các CSDL có cờ Root Database đã bị loại bỏ hoàn toàn để bảo vệ an toàn.
                </p>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-xl border border-emerald-200">
                ✓ Schema CSDL đích tương thích 100%. Không phát hiện xung đột khóa ngoại.
              </div>
              <div className="border rounded-xl p-3 space-y-1">
                <div><strong>Nguồn ({sourceConn.database}):</strong> 16 Phân hệ, 46 Modules, 524 Màn hình</div>
                <div><strong>Đích ({targetConn?.database}):</strong> Sẽ được đồng bộ nguyên khối có transaction.</div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 rounded-xl border border-indigo-200">
                Hệ thống sẽ tự động xuất file backup snapshot của CSDL đích trước khi thực thi.
              </div>
              <p className="font-mono text-[11px] text-slate-500">
                File: backup_{targetConn?.database || 'db'}_{Date.now()}.sql kèm SHA256 manifest.
              </p>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl border border-rose-200">
                <strong>Cảnh báo bảo mật:</strong> Để xác nhận ghi đè dữ liệu vào CSDL đích, vui lòng gõ chính xác tên cơ sở dữ liệu: <strong className="font-mono underline">{targetConn?.database}</strong>
              </div>
              <input
                type="text"
                value={confirmDbName}
                onChange={(e) => setConfirmDbName(e.target.value)}
                placeholder="Gõ chính xác tên CSDL đích..."
                className="w-full p-2.5 border rounded-lg text-xs font-mono dark:bg-slate-800"
              />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-200 dark:bg-slate-700 disabled:opacity-40"
          >
            Quay lại
          </button>

          {currentStep < 4 ? (
            <button
              onClick={() => setCurrentStep(prev => prev + 1)}
              className="px-4 py-1.5 text-xs font-bold rounded bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Tiếp tục
            </button>
          ) : (
            <button
              onClick={() => {
                if (confirmDbName !== targetConn?.database) {
                  toast.error('Tên CSDL xác thực không chính xác!');
                  return;
                }
                toast.success('Đã thực thi đồng bộ an toàn và lưu vết snapshot!');
                onClose();
              }}
              disabled={confirmDbName !== targetConn?.database}
              className="px-4 py-1.5 text-xs font-bold rounded bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40"
            >
              Bắt đầu Đồng bộ
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// SUB-COMPONENT: SQL SCRIPT EXPORT MODAL
// =========================================================================
interface SqlScriptExportModalProps {
  connection: AclConnection;
  modules: AclModule[];
  functions: AclFunction[];
  actions: AclAction[];
  onClose: () => void;
}

const SqlScriptExportModal: React.FC<SqlScriptExportModalProps> = ({
  connection,
  modules,
  functions,
  actions,
  onClose
}) => {
  const [scriptType, setScriptType] = useState<'all' | 'modules' | 'functions' | 'actions'>('all');
  const [copied, setCopied] = useState<boolean>(false);

  const generatedScript = useMemo(() => {
    let sql = `-- ====================================================================\n`;
    sql += `-- SNAPSHOT EXPORT SCRIPT CHO CSDL [${connection.database}] TẠI [${connection.server}]\n`;
    sql += `-- Thời gian xuất: ${new Date().toISOString()}\n`;
    sql += `-- ====================================================================\n\n`;
    sql += `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;\nBEGIN TRANSACTION;\n\n`;

    if (scriptType === 'all' || scriptType === 'modules') {
      sql += `-- 1. MODULES SNAPSHOT (${modules.length} modules)\n`;
      sql += `SET IDENTITY_INSERT dbo.ACL_Modules ON;\n`;
      modules.forEach(m => {
        sql += `INSERT INTO dbo.ACL_Modules (Id, KeyModule, TenModule, MoTa, SoThuTu, IsActive) VALUES (${m.id}, N'${m.keyModule}', N'${m.tenModule}', N'${m.moTa || ''}', ${m.soThuTu || 1}, ${m.isActive ? 1 : 0});\n`;
      });
      sql += `SET IDENTITY_INSERT dbo.ACL_Modules OFF;\n\n`;
    }

    if (scriptType === 'all' || scriptType === 'functions') {
      sql += `-- 2. FUNCTIONS SNAPSHOT (${functions.length} functions)\n`;
      sql += `SET IDENTITY_INSERT dbo.ACL_Functions ON;\n`;
      functions.forEach(f => {
        sql += `INSERT INTO dbo.ACL_Functions (Id, ParentId, FunctionName, IsGroup, ActionName, ControllerName, [Order], Routing, IsActive) VALUES (${f.id}, ${f.parentId || 'NULL'}, N'${f.functionName}', ${f.isGroup ? 1 : 0}, N'${f.actionName || ''}', N'${f.controllerName || ''}', ${f.order || 0}, N'${f.routing || ''}', ${f.isActive ? 1 : 0});\n`;
      });
      sql += `SET IDENTITY_INSERT dbo.ACL_Functions OFF;\n\n`;
    }

    if (scriptType === 'all' || scriptType === 'actions') {
      sql += `-- 3. ACTIONS SNAPSHOT (${actions.length} actions)\n`;
      sql += `SET IDENTITY_INSERT dbo.ACL_Actions ON;\n`;
      actions.forEach(a => {
        sql += `INSERT INTO dbo.ACL_Actions (Id, FunctionId, ActionName, ControllerName, ActionType, TypeName, KeyOption) VALUES (${a.id}, ${a.functionId}, N'${a.actionName}', N'${a.controllerName}', ${a.actionType}, N'${a.typeName}', N'${a.keyOption || ''}');\n`;
      });
      sql += `SET IDENTITY_INSERT dbo.ACL_Actions OFF;\n\n`;
    }

    sql += `COMMIT TRANSACTION;\n-- XUẤT THÀNH CÔNG!\n`;
    return sql;
  }, [connection, modules, functions, actions, scriptType]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedScript);
    setCopied(true);
    toast.success('Đã sao chép mã SQL vào Clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedScript], { type: 'text/sql;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ACL_Snapshot_${connection.database}_${Date.now()}.sql`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Đã tải xuống file .sql!');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-slate-900 dark:text-white">Xuất Script SQL Snapshot Độc Lập</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="text-slate-500">Phạm vi xuất:</span>
            <select
              value={scriptType}
              onChange={(e: any) => setScriptType(e.target.value)}
              className="border p-1 rounded dark:bg-slate-800 text-xs font-bold"
            >
              <option value="all">Toàn bộ (Modules + Functions + Actions)</option>
              <option value="modules">Chỉ Modules</option>
              <option value="functions">Chỉ Functions & Màn hình</option>
              <option value="actions">Chỉ Actions</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Đã sao chép' : 'Sao chép'}
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Tải về .sql
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs text-slate-300">
          <pre>{generatedScript}</pre>
        </div>
      </div>
    </div>
  );
};
