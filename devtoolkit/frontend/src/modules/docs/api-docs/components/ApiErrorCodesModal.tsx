import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  AlertOctagon, 
  Copy, 
  Search, 
  Filter, 
  FileText,
  ExternalLink
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ApiErrorCode, ApiEndpoint } from '@/types';
import { apiDocsApi } from '../../../../services/api';

interface ApiErrorCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleId: number;
  endpoints: ApiEndpoint[];
  onErrorCodesChanged?: () => void;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  auth: { label: 'Xác thực & Phân quyền', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  validation: { label: 'Dữ liệu đầu vào', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  business: { label: 'Logic nghiệp vụ', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  system: { label: 'Lỗi hệ thống / Hạ tầng', color: 'bg-red-500/10 text-red-600 dark:text-red-400' }
};

export const ApiErrorCodesModal: React.FC<ApiErrorCodesModalProps> = ({
  isOpen,
  onClose,
  moduleId,
  endpoints,
  onErrorCodesChanged
}) => {
  const [errorCodes, setErrorCodes] = useState<ApiErrorCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [httpStatusFilter, setHttpStatusFilter] = useState('all');

  // Form modal/drawer
  const [editingItem, setEditingItem] = useState<ApiErrorCode | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [code, setCode] = useState('');
  const [httpStatus, setHttpStatus] = useState(400);
  const [message, setMessage] = useState('');
  const [description, setDescription] = useState('');
  const [resolution, setResolution] = useState('');
  const [category, setCategory] = useState<'auth' | 'validation' | 'business' | 'system'>('business');

  const fetchErrorCodes = async () => {
    try {
      setLoading(true);
      const res = await apiDocsApi.getErrorCodes({ moduleId });
      setErrorCodes(res.data);
    } catch (err: any) {
      toast.error('Không thể tải bảng mã lỗi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchErrorCodes();
    }
  }, [isOpen, moduleId]);

  const handleStartCreate = () => {
    setEditingItem(null);
    setCode('');
    setHttpStatus(400);
    setMessage('');
    setDescription('');
    setResolution('');
    setCategory('business');
    setIsCreating(true);
  };

  const handleStartEdit = (ec: ApiErrorCode) => {
    setEditingItem(ec);
    setCode(ec.code);
    setHttpStatus(ec.http_status);
    setMessage(ec.message);
    setDescription(ec.description || '');
    setResolution(ec.resolution || '');
    setCategory(ec.category || 'business');
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!code.trim() || !message.trim()) {
      toast.error('Vui lòng nhập Mã lỗi và Thông điệp');
      return;
    }

    try {
      if (editingItem?.id) {
        await apiDocsApi.updateErrorCode(editingItem.id, {
          code: code.trim().toUpperCase(),
          http_status: Number(httpStatus),
          message: message.trim(),
          description,
          resolution,
          category
        });
        toast.success(`Đã cập nhật mã lỗi ${code}`);
      } else {
        await apiDocsApi.createErrorCode({
          module_id: moduleId,
          code: code.trim().toUpperCase(),
          http_status: Number(httpStatus),
          message: message.trim(),
          description,
          resolution,
          category
        });
        toast.success(`Đã tạo mã lỗi ${code}`);
      }
      setIsCreating(false);
      setEditingItem(null);
      await fetchErrorCodes();
      onErrorCodesChanged?.();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const handleDelete = async (id: number, codeVal: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa mã lỗi '${codeVal}'?`)) return;
    try {
      await apiDocsApi.deleteErrorCode(id);
      toast.success(`Đã xóa mã lỗi ${codeVal}`);
      await fetchErrorCodes();
      onErrorCodesChanged?.();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCopyMarkdownTable = () => {
    let md = `| HTTP | Mã lỗi | Thông điệp | Nguyên nhân / Kích hoạt | Hướng xử lý |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const ec of filtered) {
      md += `| \`${ec.http_status}\` | \`${ec.code}\` | ${ec.message} | ${ec.description || '-'} | ${ec.resolution || '-'} |\n`;
    }
    navigator.clipboard.writeText(md);
    toast.success('Đã sao chép toàn bộ bảng mã lỗi dưới dạng Markdown!');
  };

  const handleCopyRow = (ec: ApiErrorCode) => {
    const row = `\`${ec.http_status}\` | \`${ec.code}\`: ${ec.message} - ${ec.description || ''}`;
    navigator.clipboard.writeText(row);
    toast.success(`Đã sao chép mã lỗi ${ec.code}`);
  };

  // Filtered error codes
  const filtered = errorCodes.filter(ec => {
    const inCategory = categoryFilter === 'all' || ec.category === categoryFilter;
    const inHttp = httpStatusFilter === 'all' || String(ec.http_status) === httpStatusFilter;
    const inSearch = !search.trim() || 
      ec.code.toLowerCase().includes(search.toLowerCase()) || 
      ec.message.toLowerCase().includes(search.toLowerCase()) || 
      (ec.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (ec.resolution || '').toLowerCase().includes(search.toLowerCase());
    return inCategory && inHttp && inSearch;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-5xl h-[85vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Bảng Mã Lỗi Chung Của Hệ Thống</h2>
              <p className="text-xs text-muted-foreground">Chuẩn hóa mã lỗi nghiệp vụ, nguyên nhân kích hoạt và hướng dẫn client xử lý</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdownTable}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg transition-colors"
            >
              <Copy className="w-3.5 h-3.5" /> Copy Bảng (Markdown)
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters and Actions Bar */}
        <div className="p-4 border-b border-border bg-muted/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm mã lỗi, thông điệp, nguyên nhân..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-card border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-none"
            >
              <option value="all">Tất cả nhóm</option>
              <option value="auth">Xác thực / Quyền</option>
              <option value="validation">Dữ liệu đầu vào</option>
              <option value="business">Logic nghiệp vụ</option>
              <option value="system">Lỗi hệ thống</option>
            </select>
            <select
              value={httpStatusFilter}
              onChange={e => setHttpStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-none"
            >
              <option value="all">Mọi HTTP Status</option>
              <option value="400">400 Bad Request</option>
              <option value="401">401 Unauthorized</option>
              <option value="403">403 Forbidden</option>
              <option value="404">404 Not Found</option>
              <option value="409">409 Conflict</option>
              <option value="500">500 Internal Error</option>
            </select>
          </div>

          <button
            onClick={handleStartCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 shadow-sm transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm Mã Lỗi
          </button>
        </div>

        {/* Modal Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Table List */}
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-3 w-16 text-center">HTTP</th>
                    <th className="p-3 w-44">Mã lỗi (Code)</th>
                    <th className="p-3 w-1/5">Thông điệp</th>
                    <th className="p-3">Nguyên nhân & Hướng xử lý</th>
                    <th className="p-3 w-28 text-center">Nhóm</th>
                    <th className="p-3 w-20 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Không có mã lỗi nào phù hợp
                      </td>
                    </tr>
                  ) : (
                    filtered.map(ec => {
                      const catInfo = CATEGORY_LABELS[ec.category] || { label: ec.category, color: 'bg-muted text-muted-foreground' };
                      return (
                        <tr key={ec.id} className="hover:bg-muted/15 transition-colors">
                          <td className="p-3 text-center">
                            <span className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded ${
                              ec.http_status >= 500 ? 'bg-red-500/10 text-red-600' :
                              ec.http_status >= 400 ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'
                            }`}>
                              {ec.http_status}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-foreground">
                            {ec.code}
                          </td>
                          <td className="p-3 font-medium text-foreground">
                            {ec.message}
                          </td>
                          <td className="p-3 text-muted-foreground leading-relaxed">
                            {ec.description && <div><strong className="text-foreground">Nguyên nhân:</strong> {ec.description}</div>}
                            {ec.resolution && <div className="mt-0.5 text-primary"><strong className="text-primary font-semibold">Khắc phục:</strong> {ec.resolution}</div>}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${catInfo.color}`}>
                              {catInfo.label}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleCopyRow(ec)}
                                title="Copy mã lỗi"
                                className="p-1 text-muted-foreground hover:text-foreground rounded"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleStartEdit(ec)}
                                title="Sửa"
                                className="p-1 text-muted-foreground hover:text-primary rounded"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(ec.id, ec.code)}
                                title="Xóa"
                                className="p-1 text-muted-foreground hover:text-red-500 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Drawer Form for Add / Edit */}
          {(isCreating || editingItem) && (
            <div className="w-96 border-l border-border bg-card p-5 overflow-y-auto scrollbar-thin shadow-xl flex flex-col shrink-0 animate-fade-in">
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <h3 className="text-sm font-bold text-foreground">
                  {editingItem ? `Sửa Mã Lỗi: ${editingItem.code}` : 'Thêm Mã Lỗi Mới'}
                </h3>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setEditingItem(null);
                  }}
                  className="p-1 text-muted-foreground hover:text-foreground rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 flex-1">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Mã lỗi nghiệp vụ (UPPERCASE) *</label>
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="VÍ DỤ: VALIDATION_FAILED"
                    className="w-full px-3 py-2 text-xs bg-muted/30 border border-border rounded-lg font-mono focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">HTTP Status</label>
                    <select
                      value={httpStatus}
                      onChange={e => setHttpStatus(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-none"
                    >
                      <option value="400">400 Bad Request</option>
                      <option value="401">401 Unauthorized</option>
                      <option value="403">403 Forbidden</option>
                      <option value="404">404 Not Found</option>
                      <option value="409">409 Conflict</option>
                      <option value="422">422 Unprocessable</option>
                      <option value="429">429 Too Many Req</option>
                      <option value="500">500 Internal Error</option>
                      <option value="503">503 Service Unavail</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Phân loại</label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-none"
                    >
                      <option value="business">Nghiệp vụ</option>
                      <option value="validation">Đầu vào (Validation)</option>
                      <option value="auth">Xác thực (Auth)</option>
                      <option value="system">Hệ thống (System)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Thông điệp trả về (Message) *</label>
                  <input
                    type="text"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Thông điệp hiển thị cho người dùng hoặc log..."
                    className="w-full px-3 py-2 text-xs bg-muted/30 border border-border rounded-lg focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Nguyên nhân kích hoạt (Trigger condition)</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Ví dụ: Thiếu tham số bắt buộc hoặc khoảng thời gian không hợp lệ..."
                    rows={3}
                    className="w-full px-3 py-2 text-xs bg-muted/30 border border-border rounded-lg focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Hướng dẫn xử lý (Action / Resolution)</label>
                  <textarea
                    value={resolution}
                    onChange={e => setResolution(e.target.value)}
                    placeholder="Client cần làm gì: Kiểm tra lại form, Refresh token hay đăng nhập lại..."
                    rows={3}
                    className="w-full px-3 py-2 text-xs bg-muted/30 border border-border rounded-lg focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setEditingItem(null);
                  }}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" /> Lưu Mã Lỗi
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
