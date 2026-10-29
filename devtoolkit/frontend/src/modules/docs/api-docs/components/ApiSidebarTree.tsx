import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  Pin, 
  Layers, 
  Database, 
  AlertOctagon, 
  Upload, 
  Filter, 
  X,
  Code2
} from 'lucide-react';
import { ApiEndpoint, Module } from '@/types';
import { ApiMethodBadge } from './ApiMethodBadge';

interface ApiSidebarTreeProps {
  modules: Module[];
  selectedModuleId: number;
  onSelectModuleId: (id: number) => void;
  endpoints: ApiEndpoint[];
  selectedEndpointId?: number;
  onSelectEndpoint: (endpoint: ApiEndpoint) => void;
  onOpenCreate: () => void;
  onOpenModels: () => void;
  onOpenErrorCodes: () => void;
  onOpenImportExport: () => void;
  onOpenSearchPalette: () => void;
}

export const ApiSidebarTree: React.FC<ApiSidebarTreeProps> = ({
  modules,
  selectedModuleId,
  onSelectModuleId,
  endpoints,
  selectedEndpointId,
  onSelectEndpoint,
  onOpenCreate,
  onOpenModels,
  onOpenErrorCodes,
  onOpenImportExport,
  onOpenSearchPalette
}) => {
  // Quick filters
  const [filterText, setFilterText] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedVersion, setSelectedVersion] = useState<string>('all');

  // Collapsed folders state (persisted in local state)
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  const toggleFolder = (folderName: string) => {
    setOpenFolders(prev => ({
      ...prev,
      [folderName]: prev[folderName] === undefined ? false : !prev[folderName]
    }));
  };

  // Distinct versions available
  const versions = useMemo(() => {
    const set = new Set<string>();
    for (const ep of endpoints) {
      if (ep.version) set.add(ep.version);
    }
    return Array.from(set);
  }, [endpoints]);

  // Filtered endpoints
  const filteredEndpoints = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return endpoints.filter(ep => {
      const matchText = !q || 
        ep.path.toLowerCase().includes(q) || 
        ep.title.toLowerCase().includes(q) ||
        (ep.tags || []).some(t => t.toLowerCase().includes(q));

      const matchMethod = selectedMethod === 'all' || ep.method.toUpperCase() === selectedMethod;
      const matchStatus = selectedStatus === 'all' || ep.status === selectedStatus;
      const matchVersion = selectedVersion === 'all' || ep.version === selectedVersion;

      return matchText && matchMethod && matchStatus && matchVersion;
    });
  }, [endpoints, filterText, selectedMethod, selectedStatus, selectedVersion]);

  // Group by folders
  const folderGroups = useMemo(() => {
    const groups: Record<string, ApiEndpoint[]> = {};
    for (const ep of filteredEndpoints) {
      const f = ep.folder || 'Chung';
      if (!groups[f]) groups[f] = [];
      groups[f].push(ep);
    }
    return groups;
  }, [filteredEndpoints]);

  // Pinned endpoints
  const pinnedEndpoints = useMemo(() => {
    return endpoints.filter(ep => ep.is_pinned);
  }, [endpoints]);

  const hasActiveFilters = filterText || selectedMethod !== 'all' || selectedStatus !== 'all' || selectedVersion !== 'all';

  return (
    <div className="flex flex-col h-full bg-card border-r border-border select-none">
      {/* 1. MODULE & ACTION HEADER */}
      <div className="p-3 border-b border-border bg-muted/20 space-y-3 shrink-0">
        {/* Module Selector */}
        <div>
          <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Phân hệ / Module
          </label>
          <select
            value={selectedModuleId}
            onChange={e => onSelectModuleId(Number(e.target.value))}
            className="w-full px-2.5 py-1.5 text-xs font-semibold bg-card border border-border rounded-lg text-foreground focus:outline-none focus:border-primary shadow-sm"
          >
            {modules.map(m => (
              <option key={m.id} value={m.id}>
                {m.icon || '📁'} {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons Row */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={onOpenCreate}
            className="py-1.5 px-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1 shadow-sm hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm API
          </button>
          <button
            onClick={onOpenImportExport}
            className="py-1.5 px-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Nhập / Xuất
          </button>
        </div>

        {/* Sub-tools pills: Models & Mã lỗi */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenModels}
            className="flex-1 py-1 px-2 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-[11px] font-medium flex items-center justify-center gap-1 border border-border/60 transition-colors"
          >
            <Database className="w-3 h-3 text-primary" /> Schemas
          </button>
          <button
            onClick={onOpenErrorCodes}
            className="flex-1 py-1 px-2 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-[11px] font-medium flex items-center justify-center gap-1 border border-border/60 transition-colors"
          >
            <AlertOctagon className="w-3 h-3 text-amber-500" /> Bảng mã lỗi
          </button>
        </div>
      </div>

      {/* 2. SEARCH & QUICK FILTER BAR */}
      <div className="p-2.5 border-b border-border bg-muted/10 space-y-2 shrink-0">
        {/* Search Input triggering Ctrl + K */}
        <div 
          onClick={onOpenSearchPalette}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-muted-foreground hover:border-primary/50 cursor-pointer shadow-sm transition-colors"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate flex-1">Tìm kiếm nhanh API...</span>
          <kbd className="px-1.5 py-0.2 bg-muted border border-border rounded text-[10px] font-mono">
            Ctrl K
          </kbd>
        </div>

        {/* Method & Version filters */}
        <div className="flex items-center gap-1.5">
          <select
            value={selectedMethod}
            onChange={e => setSelectedMethod(e.target.value)}
            className="flex-1 px-2 py-1 text-[11px] bg-card border border-border rounded-md text-foreground focus:outline-none font-mono"
          >
            <option value="all">Mọi Method</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>

          {versions.length > 1 && (
            <select
              value={selectedVersion}
              onChange={e => setSelectedVersion(e.target.value)}
              className="w-20 px-2 py-1 text-[11px] bg-card border border-border rounded-md text-foreground focus:outline-none font-mono"
            >
              <option value="all">Tất cả v</option>
              {versions.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          )}

          {hasActiveFilters && (
            <button
              onClick={() => {
                setFilterText('');
                setSelectedMethod('all');
                setSelectedStatus('all');
                setSelectedVersion('all');
              }}
              title="Xóa bộ lọc"
              className="p-1 text-muted-foreground hover:text-foreground rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. ENDPOINTS TREE LIST */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3 scrollbar-thin">
        {/* Pinned section */}
        {pinnedEndpoints.length > 0 && !hasActiveFilters && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 px-2 text-[10px] font-bold text-amber-500 uppercase tracking-wider">
              <Pin className="w-3 h-3 fill-current" /> Đã ghim ({pinnedEndpoints.length})
            </div>
            <div className="space-y-0.5">
              {pinnedEndpoints.map(ep => {
                const isSelected = selectedEndpointId === ep.id;
                return (
                  <div
                    key={ep.id}
                    onClick={() => onSelectEndpoint(ep)}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                      isSelected 
                        ? 'bg-primary/15 text-primary font-semibold' 
                        : 'hover:bg-muted/40 text-foreground'
                    }`}
                  >
                    <ApiMethodBadge method={ep.method} size="sm" />
                    <span className="font-mono truncate flex-1 text-[11px]">{ep.path}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Folders and Endpoints */}
        {Object.keys(folderGroups).length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
            <p>Không tìm thấy endpoint nào</p>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setFilterText('');
                  setSelectedMethod('all');
                  setSelectedStatus('all');
                  setSelectedVersion('all');
                }}
                className="text-primary underline text-xs font-medium"
              >
                Đặt lại bộ lọc
              </button>
            )}
          </div>
        ) : (
          Object.entries(folderGroups).map(([folderName, eps]) => {
            const isOpen = openFolders[folderName] !== false; // default open
            return (
              <div key={folderName} className="space-y-0.5">
                {/* Folder Header */}
                <div
                  onClick={() => toggleFolder(folderName)}
                  className="flex items-center justify-between p-1.5 rounded-lg hover:bg-muted/50 cursor-pointer text-xs font-semibold text-muted-foreground group"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                    {isOpen ? <FolderOpen className="w-3.5 h-3.5 text-primary shrink-0" /> : <Folder className="w-3.5 h-3.5 shrink-0" />}
                    <span className="truncate text-foreground text-xs">{folderName}</span>
                  </div>
                  <span className="text-[10px] px-1.5 rounded-full bg-muted font-mono">{eps.length}</span>
                </div>

                {/* Folder items */}
                {isOpen && (
                  <div className="pl-3 space-y-0.5 border-l border-border/40 ml-2.5">
                    {eps.map(ep => {
                      const isSelected = selectedEndpointId === ep.id;
                      return (
                        <div
                          key={ep.id}
                          onClick={() => onSelectEndpoint(ep)}
                          className={`flex items-center justify-between gap-1.5 p-1.5 rounded-lg cursor-pointer text-xs transition-colors group ${
                            isSelected 
                              ? 'bg-primary/15 text-primary font-semibold' 
                              : 'hover:bg-muted/40 text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <ApiMethodBadge method={ep.method} size="sm" />
                            <div className="min-w-0 flex-1">
                              <div className="font-mono text-[11px] truncate leading-tight">{ep.path}</div>
                              <div className="text-[10px] text-muted-foreground truncate leading-tight opacity-80">{ep.title}</div>
                            </div>
                          </div>

                          {ep.status === 'deprecated' && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-500 shrink-0 font-medium">
                              Bỏ
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. FOOTER STATS */}
      <div className="p-2.5 border-t border-border bg-muted/20 text-[11px] text-muted-foreground flex items-center justify-between shrink-0">
        <span>Tổng cộng: <strong className="text-foreground">{endpoints.length}</strong> API</span>
        <span className="font-mono text-[10px]">v1.0</span>
      </div>
    </div>
  );
};
