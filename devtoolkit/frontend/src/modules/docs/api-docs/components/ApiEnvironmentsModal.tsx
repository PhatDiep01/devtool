import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Save, 
  Globe, 
  Check, 
  SlidersHorizontal, 
  Copy, 
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ApiEnvironment, ApiEnvironmentVariable } from '@/types';
import { apiDocsApi } from '../../../../services/api';

interface ApiEnvironmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleId: number;
  onEnvironmentsChanged?: (environments: ApiEnvironment[]) => void;
}

export const ApiEnvironmentsModal: React.FC<ApiEnvironmentsModalProps> = ({
  isOpen,
  onClose,
  moduleId,
  onEnvironmentsChanged,
}) => {
  const [environments, setEnvironments] = useState<ApiEnvironment[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      loadEnvironments();
    }
  }, [isOpen, moduleId]);

  const loadEnvironments = async () => {
    try {
      setLoading(true);
      const res = await apiDocsApi.getEnvironments(moduleId);
      const data = res.data || [];
      setEnvironments(data);
      if (data.length > 0) {
        setSelectedEnvId(data[0].id);
      }
    } catch (err: any) {
      toast.error('Không thể tải danh sách môi trường: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const activeEnv = environments.find((e) => e.id === selectedEnvId);

  const handleAddEnvironment = () => {
    const newId = `env_${Date.now()}`;
    const newEnv: ApiEnvironment = {
      id: newId,
      name: `Môi trường mới ${environments.length + 1}`,
      url: 'https://api.example.com',
      is_default: environments.length === 0,
      variables: [
        { key: 'baseUrl', value: 'https://api.example.com', description: 'Đường dẫn gốc của API', enabled: true },
        { key: 'token', value: '', description: 'Bearer token', enabled: true },
      ],
    };
    const updated = [...environments, newEnv];
    setEnvironments(updated);
    setSelectedEnvId(newId);
  };

  const handleDeleteEnvironment = (idToDelete: string) => {
    if (environments.length <= 1) {
      toast.error('Hệ thống cần ít nhất một môi trường');
      return;
    }
    const envToDelete = environments.find((e) => e.id === idToDelete);
    if (!window.confirm(`Bạn có chắc muốn xóa môi trường "${envToDelete?.name}"?`)) return;

    const updated = environments.filter((e) => e.id !== idToDelete);
    setEnvironments(updated);
    if (selectedEnvId === idToDelete) {
      setSelectedEnvId(updated[0]?.id || '');
    }
    toast.success(`Đã xóa môi trường ${envToDelete?.name}`);
  };

  const handleUpdateActiveEnv = (partial: Partial<ApiEnvironment>) => {
    if (!selectedEnvId) return;
    setEnvironments((prev) =>
      prev.map((e) => (e.id === selectedEnvId ? { ...e, ...partial } : e))
    );
  };

  const handleSetDefaultEnv = (id: string) => {
    setEnvironments((prev) =>
      prev.map((e) => ({
        ...e,
        is_default: e.id === id,
      }))
    );
  };

  const handleAddVariable = () => {
    if (!activeEnv) return;
    const newVar: ApiEnvironmentVariable = {
      key: '',
      value: '',
      description: '',
      enabled: true,
    };
    const vars = [...(activeEnv.variables || []), newVar];
    handleUpdateActiveEnv({ variables: vars });
  };

  const handleUpdateVariable = (idx: number, field: keyof ApiEnvironmentVariable, val: any) => {
    if (!activeEnv) return;
    const vars = [...(activeEnv.variables || [])];
    vars[idx] = { ...vars[idx], [field]: val };
    handleUpdateActiveEnv({ variables: vars });
  };

  const handleDeleteVariable = (idx: number) => {
    if (!activeEnv) return;
    const vars = (activeEnv.variables || []).filter((_, i) => i !== idx);
    handleUpdateActiveEnv({ variables: vars });
  };

  const handleSave = async () => {
    // Validate variable keys
    for (const env of environments) {
      if (env.variables) {
        for (const v of env.variables) {
          if (v.key && !/^[a-zA-Z0-9_\-.]+$/.test(v.key.trim())) {
            toast.error(`Tên biến "${v.key}" trong môi trường ${env.name} không hợp lệ. Chỉ chấp nhận chữ cái, số, dấu gạch dưới, gạch ngang và dấu chấm.`);
            return;
          }
        }
      }
    }

    try {
      setIsSaving(true);
      await apiDocsApi.saveEnvironments(moduleId, environments);
      toast.success('Đã lưu cấu hình môi trường & biến thành công!');
      onEnvironmentsChanged?.(environments);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-card border border-border rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Quản lý Môi trường & Biến (Environments & Variables)
              </h2>
              <p className="text-xs text-muted-foreground">
                Cấu hình Base URL và các biến {'{{variable}}'} để sử dụng linh hoạt trong Postman Tester & Docs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[460px]">
          {/* Left Column: Environments List */}
          <div className="md:col-span-4 border-r border-border p-4 bg-muted/10 flex flex-col justify-between overflow-y-auto scrollbar-thin">
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Danh sách Môi trường ({environments.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddEnvironment}
                  className="px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm
                </button>
              </div>

              <div className="space-y-1.5 pt-1">
                {environments.map((env) => {
                  const isSelected = env.id === selectedEnvId;
                  return (
                    <div
                      key={env.id}
                      onClick={() => setSelectedEnvId(env.id)}
                      className={`p-3 rounded-xl cursor-pointer border transition-all flex items-center justify-between group ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary shadow-xs'
                          : 'border-border/80 bg-card hover:bg-muted/40 text-foreground'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs truncate">{env.name}</span>
                          {env.is_default && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                              Mặc định
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground truncate mt-0.5 opacity-90">
                          {env.url || 'Chưa thiết lập URL'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEnvironment(env.id);
                        }}
                        className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                        title="Xóa môi trường"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Tip */}
            <div className="mt-4 p-3 bg-muted/40 border border-border/60 rounded-xl text-[11px] text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Cách dùng biến</span>
              </div>
              <p>
                Gõ <code className="font-mono bg-muted px-1 rounded text-primary">{'{{baseUrl}}'}</code> hoặc <code className="font-mono bg-muted px-1 rounded text-primary">{'{{token}}'}</code> trong URL, Params, Headers hoặc Body để tự động chèn giá trị tương ứng.
              </p>
            </div>
          </div>

          {/* Right Column: Active Environment Configuration */}
          <div className="md:col-span-8 p-5 flex flex-col justify-between overflow-y-auto scrollbar-thin space-y-5">
            {activeEnv ? (
              <div className="space-y-4">
                {/* Environment Info */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pb-4 border-b border-border/80">
                  <div className="sm:col-span-5">
                    <label className="text-xs font-bold text-foreground block mb-1">
                      Tên Môi trường <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={activeEnv.name}
                      onChange={(e) => handleUpdateActiveEnv({ name: e.target.value })}
                      placeholder="e.g. Development, Staging, Production"
                      className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="sm:col-span-5">
                    <label className="text-xs font-bold text-foreground block mb-1">
                      Base URL (Đường dẫn gốc) <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={activeEnv.url}
                      onChange={(e) => handleUpdateActiveEnv({ url: e.target.value })}
                      placeholder="https://api.internal.domain"
                      className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-end">
                    <button
                      type="button"
                      onClick={() => handleSetDefaultEnv(activeEnv.id)}
                      className={`w-full py-1.5 px-2 rounded-xl text-xs font-semibold border transition ${
                        activeEnv.is_default
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                          : 'bg-card border-border hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      {activeEnv.is_default ? '✓ Mặc định' : 'Đặt mặc định'}
                    </button>
                  </div>
                </div>

                {/* Variables Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Bảng Biến Môi Trường (Variables)
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Các biến có hiệu lực khi môi trường "{activeEnv.name}" được kích hoạt
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddVariable}
                      className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg transition flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm biến
                    </button>
                  </div>

                  <div className="border border-border rounded-xl overflow-hidden bg-card shadow-xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border text-[11px] font-bold text-muted-foreground">
                          <th className="py-2 px-3 w-10 text-center">Bật</th>
                          <th className="py-2 px-3 w-1/4">Tên biến (Key)</th>
                          <th className="py-2 px-3">Giá trị (Value)</th>
                          <th className="py-2 px-3 w-1/4">Mô tả</th>
                          <th className="py-2 px-2 w-10 text-center">Xóa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {(!activeEnv.variables || activeEnv.variables.length === 0) ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground italic">
                              Chưa có biến môi trường nào. Bấm "+ Thêm biến" để bắt đầu.
                            </td>
                          </tr>
                        ) : (
                          activeEnv.variables.map((v, idx) => (
                            <tr key={idx} className="hover:bg-muted/15 transition-colors">
                              <td className="py-1 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={v.enabled}
                                  onChange={(e) => handleUpdateVariable(idx, 'enabled', e.target.checked)}
                                  className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                                />
                              </td>
                              <td className="py-1 px-3">
                                <input
                                  type="text"
                                  value={v.key}
                                  onChange={(e) => handleUpdateVariable(idx, 'key', e.target.value)}
                                  placeholder="token"
                                  className="w-full bg-transparent font-mono text-xs text-foreground focus:outline-none"
                                />
                              </td>
                              <td className="py-1 px-3">
                                <div className="flex items-center gap-1">
                                  <input
                                    type={showValues[`${activeEnv.id}_${idx}`] ? 'text' : 'password'}
                                    value={v.value}
                                    onChange={(e) => handleUpdateVariable(idx, 'value', e.target.value)}
                                    placeholder="eyJh..."
                                    className="w-full bg-transparent font-mono text-xs text-foreground focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowValues((prev) => ({
                                        ...prev,
                                        [`${activeEnv.id}_${idx}`]: !prev[`${activeEnv.id}_${idx}`],
                                      }))
                                    }
                                    className="p-1 text-muted-foreground hover:text-foreground rounded"
                                    title="Ẩn/Hiện giá trị"
                                  >
                                    {showValues[`${activeEnv.id}_${idx}`] ? (
                                      <EyeOff className="w-3.5 h-3.5" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="py-1 px-3">
                                <input
                                  type="text"
                                  value={v.description || ''}
                                  onChange={(e) => handleUpdateVariable(idx, 'description', e.target.value)}
                                  placeholder="Mô tả biến..."
                                  className="w-full bg-transparent text-xs text-muted-foreground focus:outline-none"
                                />
                              </td>
                              <td className="py-1 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteVariable(idx)}
                                  className="p-1 text-muted-foreground hover:text-destructive rounded"
                                  title="Xóa biến"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-muted-foreground text-xs italic">
                Chọn một môi trường từ danh sách bên trái hoặc tạo môi trường mới.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-border bg-muted/20">
          <div className="text-xs text-muted-foreground">
            Các thay đổi sẽ được áp dụng cho toàn bộ các API thuộc phân hệ này
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu cấu hình môi trường'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ApiEnvironmentsModal;
