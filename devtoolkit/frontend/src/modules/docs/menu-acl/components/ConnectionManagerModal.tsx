import React, { useState } from 'react';
import { 
  Database, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  RefreshCw, 
  ShieldAlert, 
  Lock, 
  Terminal, 
  Copy, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertTriangle,
  Server,
  Zap,
  Sliders,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AclConnection } from '../types';
import { aclApi } from '../../../../services/api';

interface ConnectionManagerModalProps {
  connections: AclConnection[];
  activeConnectionId: string | null;
  onSelectConnection: (id: string) => void;
  onConnectionsChange: (connections: AclConnection[]) => void;
  onClose: () => void;
}

export const ConnectionManagerModal: React.FC<ConnectionManagerModalProps> = ({
  connections,
  activeConnectionId,
  onSelectConnection,
  onConnectionsChange,
  onClose
}) => {
  // Mode: 'list' | 'form' | 'import'
  const [viewMode, setViewMode] = useState<'list' | 'form' | 'import'>('list');
  const [editingConn, setEditingConn] = useState<AclConnection | null>(null);
  const [envFilter, setEnvFilter] = useState<'all' | 'dev' | 'test' | 'staging' | 'master' | 'prod'>('all');

  // Form State
  const [formName, setFormName] = useState('');
  const [formServer, setFormServer] = useState('');
  const [formDatabase, setFormDatabase] = useState('');
  const [formAuthType, setFormAuthType] = useState<'windows' | 'sql'>('windows');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formIsRoot, setFormIsRoot] = useState(false);
  const [formEnvironment, setFormEnvironment] = useState<'dev' | 'test' | 'staging' | 'master' | 'prod'>('dev');
  const [formEncrypt, setFormEncrypt] = useState(false);
  const [formTrustCert, setFormTrustCert] = useState(true);
  const [formTimeout, setFormTimeout] = useState(30);
  const [formFingerprint, setFormFingerprint] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Testing status
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs?: number;
    hardwareFingerprint?: string;
    message?: string;
    error?: string;
  } | null>(null);
  const [isFormTesting, setIsFormTesting] = useState(false);

  // Import State
  const [importJsonText, setImportJsonText] = useState('');
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  const resetForm = () => {
    setFormName('');
    setFormServer('');
    setFormDatabase('');
    setFormAuthType('windows');
    setFormUsername('');
    setFormPassword('');
    setFormIsRoot(false);
    setFormEnvironment('dev');
    setFormEncrypt(false);
    setFormTrustCert(true);
    setFormTimeout(30);
    setFormFingerprint('');
    setEditingConn(null);
    setTestResult(null);
    setShowPassword(false);
  };

  const handleOpenCreateForm = () => {
    resetForm();
    setViewMode('form');
  };

  const handleOpenEditForm = (conn: AclConnection) => {
    setEditingConn(conn);
    setFormName(conn.name);
    setFormServer(conn.server);
    setFormDatabase(conn.database);
    setFormAuthType(conn.authType);
    setFormUsername(conn.username || '');
    setFormPassword('');
    setFormIsRoot(conn.isRoot);
    setFormEnvironment(conn.environment);
    setFormFingerprint(conn.hardwareFingerprint || '');
    setTestResult(null);
    setViewMode('form');
  };

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formServer.trim() || !formDatabase.trim()) {
      toast.error('Vui lòng điền đầy đủ Tên kết nối, Máy chủ và Database');
      return;
    }

    const payload = {
      name: formName.trim(),
      server: formServer.trim(),
      database: formDatabase.trim(),
      authType: formAuthType,
      username: formAuthType === 'sql' ? formUsername.trim() : '',
      password: formAuthType === 'sql' ? formPassword : '',
      isRoot: formIsRoot,
      environment: formEnvironment,
      encrypt: formEncrypt,
      trustServerCertificate: formTrustCert,
      timeoutSeconds: formTimeout,
      hardwareFingerprint: formFingerprint.trim()
    };

    try {
      if (editingConn) {
        const res = await aclApi.updateConnection(editingConn.id, payload);
        const updatedList = connections.map(c => c.id === editingConn.id ? res.data : c);
        onConnectionsChange(updatedList);
        toast.success(`Đã cập nhật kết nối "${res.data.name}"`);
      } else {
        const res = await aclApi.createConnection(payload);
        const updatedList = [...connections, res.data];
        onConnectionsChange(updatedList);
        if (!activeConnectionId) {
          onSelectConnection(res.data.id);
        }
        toast.success(`Đã tạo kết nối "${res.data.name}"`);
      }
      setViewMode('list');
      resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Lỗi khi lưu kết nối');
    }
  };

  const handleDeleteConnection = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa cấu hình kết nối "${name}"?`)) {
      return;
    }

    try {
      await aclApi.deleteConnection(id);
      const updatedList = connections.filter(c => c.id !== id);
      onConnectionsChange(updatedList);
      if (activeConnectionId === id) {
        onSelectConnection(updatedList.length > 0 ? updatedList[0].id : '');
      }
      toast.success(`Đã xóa kết nối "${name}"`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Lỗi khi xóa kết nối');
    }
  };

  // Test single connection
  const handleTestConnection = async (conn: AclConnection) => {
    setTestingId(conn.id);
    try {
      const res = await aclApi.testConnection({
        id: conn.id,
        server: conn.server,
        database: conn.database,
        authType: conn.authType,
        username: conn.username
      });

      const updated = connections.map(c => {
        if (c.id === conn.id) {
          return {
            ...c,
            status: (res.data.status || (res.data.success ? 'online' : 'offline')) as any,
            latencyMs: res.data.latencyMs || 0,
            hardwareFingerprint: res.data.hardwareFingerprint || c.hardwareFingerprint,
            lastChecked: new Date().toLocaleTimeString()
          };
        }
        return c;
      });
      onConnectionsChange(updated);

      if (res.data.success) {
        toast.success(`Kết nối tới [${conn.server}] thành công! (${res.data.latencyMs}ms)`);
      } else {
        toast.error(res.data.error || 'Kiểm tra kết nối thất bại');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Lỗi khi kiểm tra kết nối');
    } finally {
      setTestingId(null);
    }
  };

  // Live test directly in Add/Edit Form
  const handleTestInForm = async () => {
    if (!formServer.trim() || !formDatabase.trim()) {
      toast.error('Vui lòng nhập Server và Database trước khi kiểm tra');
      return;
    }

    setIsFormTesting(true);
    setTestResult(null);

    try {
      const res = await aclApi.testConnection({
        server: formServer.trim(),
        database: formDatabase.trim(),
        authType: formAuthType,
        username: formUsername.trim(),
        password: formPassword,
        timeoutSeconds: formTimeout
      });

      setTestResult(res.data);
      if (res.data.success) {
        if (res.data.hardwareFingerprint && !formFingerprint) {
          setFormFingerprint(res.data.hardwareFingerprint);
        }
        toast.success(res.data.message || 'Kết nối thành công!');
      } else {
        toast.error(res.data.error || 'Không thể kết nối');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.response?.data?.error || 'Lỗi kiểm tra kết nối'
      });
      toast.error('Lỗi khi kiểm tra kết nối');
    } finally {
      setIsFormTesting(false);
    }
  };

  // Export connections
  const handleExportJson = async () => {
    try {
      const res = await aclApi.exportConnections();
      const jsonStr = JSON.stringify(res.data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AclConnections_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Đã tải xuống file cấu hình JSON!');
    } catch {
      toast.error('Lỗi xuất cấu hình kết nối');
    }
  };

  // Parse JSON for Import Preview
  const handleJsonInputChange = (text: string) => {
    setImportJsonText(text);
    setImportError(null);
    if (!text.trim()) {
      setImportPreview([]);
      return;
    }

    try {
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      setImportPreview(arr);
    } catch (e: any) {
      setImportError('Cú pháp JSON không hợp lệ: ' + e.message);
      setImportPreview([]);
    }
  };

  // Confirm Import
  const handleExecuteImport = async () => {
    if (importPreview.length === 0) return;
    try {
      const res = await aclApi.importConnections(importPreview);
      const allRes = await aclApi.getConnections();
      onConnectionsChange(allRes.data);
      if (!activeConnectionId && allRes.data.length > 0) {
        onSelectConnection(allRes.data[0].id);
      }
      toast.success(`Đã nhập thành công ${res.data.importedCount} cấu hình kết nối!`);
      setViewMode('list');
      setImportJsonText('');
      setImportPreview([]);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Lỗi khi nhập dữ liệu');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm md:text-base text-foreground tracking-tight">
                Quản Lý Kết Nối Cơ Sở Dữ Liệu SQL Server
              </h3>
              <p className="text-xs text-muted-foreground">
                Tự cấu hình kết nối phân hệ ACL (Dev, QA, Staging, Master/Root, Prod)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* View Mode Switcher / Action Bar */}
        <div className="px-5 py-2.5 border-b border-border/60 bg-muted/20 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setViewMode('list'); resetForm(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              Danh Sách Kết Nối ({connections.length})
            </button>

            <button
              type="button"
              onClick={handleOpenCreateForm}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                viewMode === 'form' && !editingConn
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Kết Nối Mới</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('import')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                viewMode === 'import'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Nhập JSON</span>
            </button>
          </div>

          {connections.length > 0 && viewMode === 'list' && (
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs text-foreground font-medium transition"
              title="Xuất danh sách cấu hình kết nối ra file JSON (đã che mật khẩu)"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span>Xuất JSON</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto">
          {/* ================================================================= */}
          {/* 1. VIEW: CONNECTION LIST */}
          {/* ================================================================= */}
          {viewMode === 'list' && (
            <div>
              {connections.length === 0 ? (
                <div className="p-10 text-center border-2 border-dashed border-border rounded-2xl bg-card/40 my-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto mb-3">
                    <Database className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-sm text-foreground">Chưa Có Kết Nối CSDL Nào Được Cấu Hình</h4>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-5">
                    Hệ thống đã loại bỏ toàn bộ dữ liệu mẫu. Bạn có thể tự do khai báo các kết nối SQL Server (Dev, Test, Staging, Master/Root) hoặc nhập cấu hình nhanh từ JSON.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleOpenCreateForm}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-md transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Thêm Kết Nối Đầu Tiên</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('import')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Nhập Cấu Hình Từ JSON</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Environment Tier Filter Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 pb-1">
                    {[
                      { id: 'all', label: 'Tất cả', count: connections.length },
                      { id: 'dev', label: 'DEV', count: connections.filter(c => c.environment === 'dev').length },
                      { id: 'test', label: 'TEST / QA', count: connections.filter(c => c.environment === 'test').length },
                      { id: 'staging', label: 'STAGING', count: connections.filter(c => c.environment === 'staging').length },
                      { id: 'master', label: 'MASTER (ROOT)', count: connections.filter(c => c.environment === 'master').length },
                      { id: 'prod', label: 'PROD', count: connections.filter(c => c.environment === 'prod').length }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setEnvFilter(tab.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                          envFilter === tab.id
                            ? 'bg-primary text-primary-foreground shadow-2xs'
                            : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          envFilter === tab.id ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Filtered Connections List */}
                  {connections.filter(c => envFilter === 'all' || c.environment === envFilter).length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-border rounded-xl bg-card/30 text-xs text-muted-foreground">
                      Không có kết nối nào trong môi trường <strong>{envFilter.toUpperCase()}</strong>.
                    </div>
                  ) : (
                    connections
                      .filter(c => envFilter === 'all' || c.environment === envFilter)
                      .map(conn => {
                    const isActive = activeConnectionId === conn.id;
                    const isTesting = testingId === conn.id;

                    return (
                      <div
                        key={conn.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isActive
                            ? 'border-primary/50 bg-primary/5 shadow-xs'
                            : 'border-border bg-card hover:border-border/80 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          {/* Connection Header & Info */}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-sm text-foreground truncate">{conn.name}</h4>

                              {conn.isRoot && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                                  <Lock className="w-2.5 h-2.5" />
                                  ROOT · MASTER
                                </span>
                              )}

                              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-muted text-muted-foreground border border-border">
                                {conn.environment}
                              </span>

                              {isActive && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
                                  Đang kích hoạt
                                </span>
                              )}
                            </div>

                            {/* Server, DB & Auth details */}
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
                              <div className="flex items-center gap-1">
                                <Server className="w-3 h-3 text-primary" />
                                <span className="text-foreground font-medium">{conn.server}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Database className="w-3 h-3 text-primary" />
                                <span className="text-foreground font-medium">{conn.database}</span>
                              </div>
                              <div className="text-[11px]">
                                {conn.authType === 'windows' ? (
                                  <span className="text-emerald-500 font-sans">Windows Auth</span>
                                ) : (
                                  <span>SQL: <strong className="text-foreground">{conn.username || 'sa'}</strong></span>
                                )}
                              </div>
                            </div>

                            {/* Hardware Fingerprint display */}
                            {conn.hardwareFingerprint && (
                              <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                                <Terminal className="w-3 h-3 text-primary shrink-0" />
                                <span className="truncate max-w-sm sm:max-w-md">FP: {conn.hardwareFingerprint}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(conn.hardwareFingerprint);
                                    toast.success('Đã sao chép DB Fingerprint');
                                  }}
                                  className="p-0.5 hover:text-foreground"
                                  title="Sao chép Fingerprint"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            {/* Test Connection Button */}
                            <button
                              type="button"
                              disabled={isTesting}
                              onClick={() => handleTestConnection(conn)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground disabled:opacity-50 transition"
                              title="Kiểm tra thông tuyến & latency tới SQL Server"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 text-primary ${isTesting ? 'animate-spin' : ''}`} />
                              <span>{isTesting ? 'Đang test...' : 'Kiểm tra'}</span>
                            </button>

                            {/* Select / Activate button */}
                            {!isActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectConnection(conn.id);
                                  toast.success(`Đã chọn kết nối: ${conn.name}`);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition"
                              >
                                Kích hoạt
                              </button>
                            )}

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditForm(conn)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                              title="Chỉnh sửa cấu hình"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDeleteConnection(conn.id, conn.name)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition"
                              title="Xóa cấu hình kết nối"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Status bar */}
                        {conn.lastChecked && (
                          <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  conn.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'
                                }`}
                              />
                              <span className="text-muted-foreground">
                                Trạng thái:{' '}
                                <strong className={conn.status === 'online' ? 'text-emerald-500' : 'text-red-500'}>
                                  {conn.status === 'online' ? 'Trực tuyến (Online)' : 'Ngoại tuyến (Offline)'}
                                </strong>
                              </span>
                              {conn.latencyMs > 0 && (
                                <span className="font-mono text-muted-foreground">({conn.latencyMs}ms)</span>
                              )}
                            </div>
                            <span className="text-muted-foreground text-[10px]">
                              Kiểm tra lúc: {conn.lastChecked}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }))}
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* 2. VIEW: ADD / EDIT CONNECTION FORM */}
          {/* ================================================================= */}
          {viewMode === 'form' && (
            <form onSubmit={handleSaveConnection} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h4 className="font-bold text-sm text-foreground">
                  {editingConn ? `Chỉnh Sửa Kết Nối: ${editingConn.name}` : 'Thêm Cấu Hình Kết Nối Mới'}
                </h4>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ← Quay lại danh sách
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                {/* Tên kết nối */}
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Tên hiển thị kết nối <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="VD: SQL Server Dev (Nội bộ), Master ORG DB..."
                    className="w-full bg-background border border-border rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Môi trường */}
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Môi trường triển khai
                  </label>
                  <select
                    value={formEnvironment}
                    onChange={(e) => setFormEnvironment(e.target.value as any)}
                    className="w-full bg-background border border-border rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="dev">Development (Phát triển cục bộ / Dev)</option>
                    <option value="test">Testing / QA (Kiểm thử chức năng)</option>
                    <option value="staging">Staging / UAT (Tiền phát hành)</option>
                    <option value="master">Master / ORG (Hệ thống Trung tâm)</option>
                    <option value="prod">Production (Môi trường Vận hành thật)</option>
                  </select>
                </div>

                {/* Máy chủ Server */}
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Máy chủ CSDL (Host / Server / Instance) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formServer}
                    onChange={(e) => setFormServer(e.target.value)}
                    placeholder="VD: localhost, 192.168.1.50, sql.internal.net,1433"
                    className="w-full bg-background border border-border rounded-lg p-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-[10px] text-muted-foreground">Hỗ trợ cổng tùy chỉnh dạng `server,cổng` hoặc tên instance `SERVER\INSTANCE`</span>
                </div>

                {/* Tên Database */}
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Tên Cơ Sở Dữ Liệu (Database Name) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formDatabase}
                    onChange={(e) => setFormDatabase(e.target.value)}
                    placeholder="VD: DB_QLNS_Dev, Master_Core..."
                    className="w-full bg-background border border-border rounded-lg p-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Hình thức xác thực */}
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Phương thức xác thực (Authentication Mode)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormAuthType('windows')}
                      className={`p-2 rounded-lg border text-xs font-semibold transition ${
                        formAuthType === 'windows'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      Windows Authentication
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormAuthType('sql')}
                      className={`p-2 rounded-lg border text-xs font-semibold transition ${
                        formAuthType === 'sql'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      SQL Authentication
                    </button>
                  </div>
                </div>

                {/* Username & Password nếu chọn SQL Auth */}
                {formAuthType === 'sql' && (
                  <>
                    <div>
                      <label className="font-semibold text-foreground block mb-1">
                        Tài khoản SQL Server (Username) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value)}
                        placeholder="sa hoặc tài khoản db_owner"
                        className="w-full bg-background border border-border rounded-lg p-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-foreground block mb-1">
                        Mật khẩu (Password) {editingConn && <span className="text-[10px] text-muted-foreground">(Để trống nếu giữ nguyên mật khẩu cũ)</span>}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formPassword}
                          onChange={(e) => setFormPassword(e.target.value)}
                          placeholder={editingConn ? '••••••••' : 'Nhập mật khẩu SQL'}
                          className="w-full bg-background border border-border rounded-lg p-2 pr-8 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Root Database Protection Checkbox */}
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsRoot}
                    onChange={(e) => setFormIsRoot(e.target.checked)}
                    className="mt-0.5 rounded border-amber-500 text-amber-500 focus:ring-amber-500"
                  />
                  <div>
                    <span className="font-bold flex items-center gap-1.5 text-foreground">
                      <Lock className="w-3.5 h-3.5 text-amber-500" />
                      Đánh dấu là Cơ sở dữ liệu Gốc chuẩn mực (Root / Master Database)
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Kích hoạt cơ chế bảo vệ tối cao: Database này sẽ <strong>tuyệt đối bị cấm</strong> làm đích ghi đè (Target DB) trong Thuật sĩ Đồng bộ CSDL (Sync Wizard).
                    </p>
                  </div>
                </label>
              </div>

              {/* Hardware Fingerprint field (Optional custom) */}
              <div className="text-xs">
                <label className="font-semibold text-foreground block mb-1">
                  Hardware DB Fingerprint (Tự động cập nhật khi test kết nối)
                </label>
                <input
                  type="text"
                  value={formFingerprint}
                  onChange={(e) => setFormFingerprint(e.target.value)}
                  placeholder="Định dạng chuẩn: {Server}|{DB_ID}|{BrokerGuid}"
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs font-mono text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Test Result Box */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                    testResult.success
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-bold">
                      {testResult.success ? 'Kiểm tra thông tuyến thành công!' : 'Kiểm tra thất bại:'}
                    </p>
                    <p className="text-[11px] mt-0.5">{testResult.message || testResult.error}</p>
                    {testResult.latencyMs && (
                      <p className="font-mono text-[10px] mt-1 opacity-80">
                        Độ trễ: {testResult.latencyMs}ms • Fingerprint: {testResult.hardwareFingerprint || 'N/A'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Form Buttons */}
              <div className="pt-3 border-t border-border flex items-center justify-between">
                <button
                  type="button"
                  disabled={isFormTesting}
                  onClick={handleTestInForm}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition disabled:opacity-50"
                >
                  <Zap className={`w-3.5 h-3.5 text-primary ${isFormTesting ? 'animate-spin' : ''}`} />
                  <span>{isFormTesting ? 'Đang kiểm tra...' : 'Kiểm tra kết nối ngay'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setViewMode('list'); resetForm(); }}
                    className="px-3.5 py-2 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-md transition"
                  >
                    {editingConn ? 'Cập Nhật Cấu Hình' : 'Lưu Kết Nối'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ================================================================= */}
          {/* 3. VIEW: IMPORT CONNECTIONS FROM JSON */}
          {/* ================================================================= */}
          {viewMode === 'import' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div>
                  <h4 className="font-bold text-sm text-foreground">Nhập Danh Sách Cấu Hình Từ JSON</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Dán mảng cấu hình JSON hoặc tải file cấu hình đã lưu
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ← Quay lại danh sách
                </button>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Nội dung mảng JSON các kết nối:
                </label>
                <textarea
                  rows={8}
                  value={importJsonText}
                  onChange={(e) => handleJsonInputChange(e.target.value)}
                  placeholder={`[\n  {\n    "name": "SQL Dev Cục bộ",\n    "server": "localhost\\\\MSSQLSERVER",\n    "database": "DB_ACL_Dev",\n    "authType": "windows",\n    "environment": "dev",\n    "isRoot": false\n  }\n]`}
                  className="w-full bg-background border border-border rounded-xl p-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {importError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                  {importError}
                </div>
              )}

              {/* Preview Table */}
              {importPreview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-bold text-foreground">
                    <span>Xem trước kết quả ({importPreview.length} kết nối):</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-border bg-card">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-muted text-muted-foreground border-b border-border">
                        <tr>
                          <th className="p-2">Tên kết nối</th>
                          <th className="p-2">Server</th>
                          <th className="p-2">Database</th>
                          <th className="p-2">Môi trường</th>
                          <th className="p-2 text-center">Root DB</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 font-mono">
                        {importPreview.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/40">
                            <td className="p-2 font-sans font-medium text-foreground">{item.name || 'Không tên'}</td>
                            <td className="p-2 text-primary">{item.server}</td>
                            <td className="p-2">{item.database}</td>
                            <td className="p-2 uppercase">{item.environment || 'dev'}</td>
                            <td className="p-2 text-center">
                              {item.isRoot ? (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-bold text-[10px]">
                                  ROOT
                                </span>
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="px-3.5 py-2 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={importPreview.length === 0}
                  onClick={handleExecuteImport}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-md transition disabled:opacity-40"
                >
                  Lưu {importPreview.length} Kết Nối Vào Hệ Thống
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
