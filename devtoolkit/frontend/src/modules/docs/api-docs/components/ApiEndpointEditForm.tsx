import React, { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  Plus, 
  Trash2, 
  Sparkles, 
  Save, 
  AlertTriangle, 
  Layers, 
  Code2, 
  FileText,
  Clock,
  Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { 
  ApiEndpoint, 
  ApiMethod, 
  ApiStatus, 
  ApiAuthType, 
  ApiParameter, 
  ApiRequestBodySample, 
  ApiResponse, 
  ApiModel, 
  ApiErrorCode,
  Screen,
  BugItem
} from '@/types';
import { formatJsonSafe } from '../utils/schemaInferrer';

interface ApiEndpointEditFormProps {
  initialEndpoint?: Partial<ApiEndpoint>;
  moduleId: number;
  folders: string[];
  models: ApiModel[];
  errorCodes: ApiErrorCode[];
  screens: Screen[];
  bugs: BugItem[];
  allEndpoints: ApiEndpoint[];
  onSave: (data: Partial<ApiEndpoint>) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

export const ApiEndpointEditForm: React.FC<ApiEndpointEditFormProps> = ({
  initialEndpoint,
  moduleId,
  folders,
  models,
  errorCodes,
  screens,
  bugs,
  allEndpoints,
  onSave,
  onCancel,
  isSaving
}) => {
  // Basic info
  const [method, setMethod] = useState<ApiMethod>(initialEndpoint?.method || 'GET');
  const [path, setPath] = useState(initialEndpoint?.path || '/api/v1/');
  const [title, setTitle] = useState(initialEndpoint?.title || '');
  const [folder, setFolder] = useState(initialEndpoint?.folder || folders[0] || 'Chung');
  const [newFolderInput, setNewFolderInput] = useState('');
  const [isAddingNewFolder, setIsAddingNewFolder] = useState(false);
  const [version, setVersion] = useState(initialEndpoint?.version || 'v1');
  const [status, setStatus] = useState<ApiStatus>(initialEndpoint?.status || 'stable');
  const [deprecatedReason, setDeprecatedReason] = useState(initialEndpoint?.deprecated_reason || '');
  const [replacedById, setReplacedById] = useState<number | undefined>(initialEndpoint?.replaced_by_id);
  const [assignee, setAssignee] = useState(initialEndpoint?.assignee || '');
  const [authType, setAuthType] = useState<ApiAuthType>(initialEndpoint?.auth_type || 'bearer');
  const [authRoles, setAuthRoles] = useState(initialEndpoint?.auth_roles || '');
  const [tagsInput, setTagsInput] = useState((initialEndpoint?.tags || []).join(', '));
  const [description, setDescription] = useState(initialEndpoint?.description || '');

  // Parameters
  const [parameters, setParameters] = useState<ApiParameter[]>(initialEndpoint?.parameters || []);

  // Request bodies
  const [requestBodies, setRequestBodies] = useState<ApiRequestBodySample[]>(
    initialEndpoint?.request_bodies?.length ? initialEndpoint.request_bodies : [
      { name: 'Mẫu chuẩn', contentType: 'application/json', body: '{\n  \n}' }
    ]
  );
  const [activeReqIdx, setActiveReqIdx] = useState(0);

  // Responses
  const [responses, setResponses] = useState<ApiResponse[]>(
    initialEndpoint?.responses?.length ? initialEndpoint.responses : [
      { statusCode: 200, description: 'Thành công', examples: [{ name: 'Ví dụ 200', body: '{\n  "success": true\n}' }] }
    ]
  );
  const [activeRespIdx, setActiveRespIdx] = useState(0);

  // Error codes & notes
  const [selectedErrorCodes, setSelectedErrorCodes] = useState<string[]>(initialEndpoint?.related_error_codes || []);
  const [businessNotes, setBusinessNotes] = useState(initialEndpoint?.business_notes || '');
  const [rateLimit, setRateLimit] = useState(initialEndpoint?.rate_limit || '');
  const [linkedScreenId, setLinkedScreenId] = useState<number | undefined>(initialEndpoint?.linked_screen_id);
  const [linkedBugId, setLinkedBugId] = useState<number | undefined>(initialEndpoint?.linked_bug_id);

  // Auto detect path parameters
  useEffect(() => {
    const matches = path.match(/\{([a-zA-Z0-9_-]+)\}/g) || path.match(/:([a-zA-Z0-9_-]+)/g);
    if (matches) {
      const extractedNames = matches.map(m => m.replace(/[\{\}:]/g, ''));
      setParameters(prev => {
        const existingPathNames = prev.filter(p => p.in === 'path').map(p => p.name);
        const newOnes: ApiParameter[] = extractedNames
          .filter(name => !existingPathNames.includes(name))
          .map(name => ({
            name,
            in: 'path',
            type: 'string',
            required: true,
            description: `Tham số đường dẫn ${name}`
          }));
        return [...newOnes, ...prev];
      });
    }
  }, [path]);

  // Keyboard shortcut Ctrl + S to save, Esc to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [method, path, title, folder, parameters, requestBodies, responses, selectedErrorCodes]);

  const handleSubmit = async () => {
    if (!path.trim() || !title.trim()) {
      toast.error('Vui lòng nhập đầy đủ Đường dẫn và Tiêu đề endpoint');
      return;
    }

    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    const finalFolder = isAddingNewFolder ? newFolderInput.trim() || 'Chung' : folder;

    await onSave({
      module_id: moduleId,
      folder: finalFolder,
      version,
      method,
      path: path.trim(),
      title: title.trim(),
      description,
      status,
      deprecated_reason: status === 'deprecated' ? deprecatedReason : undefined,
      replaced_by_id: status === 'deprecated' ? replacedById : undefined,
      assignee,
      auth_type: authType,
      auth_roles: authRoles,
      tags,
      parameters,
      request_bodies: requestBodies,
      responses,
      related_error_codes: selectedErrorCodes,
      business_notes: businessNotes,
      rate_limit: rateLimit,
      linked_screen_id: linkedScreenId || undefined,
      linked_bug_id: linkedBugId || undefined
    });
  };

  // Format active request JSON
  const handleFormatActiveRequest = () => {
    const current = requestBodies[activeReqIdx];
    if (!current?.body) return;
    const res = formatJsonSafe(current.body);
    if (!res.isValid) {
      toast.error('JSON không hợp lệ: ' + res.error);
      return;
    }
    const updated = [...requestBodies];
    updated[activeReqIdx].body = res.formatted;
    setRequestBodies(updated);
    toast.success('Đã định dạng JSON đẹp!');
  };

  // Format active response JSON
  const handleFormatActiveResponse = () => {
    const currentResp = responses[activeRespIdx];
    const firstEx = currentResp?.examples?.[0];
    if (!firstEx?.body) return;
    const res = formatJsonSafe(firstEx.body);
    if (!res.isValid) {
      toast.error('JSON không hợp lệ: ' + res.error);
      return;
    }
    const updated = [...responses];
    updated[activeRespIdx].examples[0].body = res.formatted;
    setResponses(updated);
    toast.success('Đã định dạng JSON phản hồi!');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 select-text">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {initialEndpoint?.id ? `Chỉnh sửa: [${method}] ${path}` : 'Thêm Endpoint Mới'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Nhấn <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono text-[10px]">Ctrl + S</kbd> để lưu, <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono text-[10px]">Esc</kbd> để hủy
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-xl transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSubmit}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 shadow-sm transition-opacity disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Đang lưu...' : 'Lưu Endpoint'}
          </button>
        </div>
      </div>

      {/* 1. BASIC INFORMATION */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">1. Thông tin cơ bản</h2>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Method */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Phương thức *</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value as ApiMethod)}
              className="w-full px-3 py-2 text-xs font-mono font-bold bg-card border border-border rounded-xl focus:border-primary focus:outline-none"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
              <option value="HEAD">HEAD</option>
              <option value="OPTIONS">OPTIONS</option>
            </select>
          </div>

          {/* Path */}
          <div className="md:col-span-6">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Đường dẫn (Path) *</label>
            <input
              type="text"
              value={path}
              onChange={e => setPath(e.target.value)}
              placeholder="/api/v1/surveys/{id}"
              className="w-full px-3 py-2 text-xs font-mono font-bold bg-muted/20 border border-border rounded-xl focus:border-primary focus:outline-none"
            />
          </div>

          {/* Version */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Phiên bản</label>
            <input
              type="text"
              value={version}
              onChange={e => setVersion(e.target.value)}
              placeholder="v1"
              className="w-full px-3 py-2 text-xs font-mono bg-card border border-border rounded-xl focus:border-primary focus:outline-none"
            />
          </div>

          {/* Status */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Trạng thái</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as ApiStatus)}
              className="w-full px-3 py-2 text-xs bg-card border border-border rounded-xl focus:border-primary focus:outline-none font-semibold"
            >
              <option value="stable">Ổn định</option>
              <option value="draft">Bản nháp</option>
              <option value="deprecated">Sắp bỏ</option>
              <option value="removed">Đã bỏ</option>
            </select>
          </div>
        </div>

        {/* Title & Folder */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Tiêu đề ngắn *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ví dụ: Lấy danh sách khảo sát phân trang"
              className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl focus:border-primary focus:outline-none font-medium"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-muted-foreground">Thư mục / Phân hệ</label>
              <button
                type="button"
                onClick={() => setIsAddingNewFolder(!isAddingNewFolder)}
                className="text-xs text-primary hover:underline font-medium"
              >
                {isAddingNewFolder ? 'Chọn thư mục có sẵn' : '+ Tạo thư mục mới'}
              </button>
            </div>
            {isAddingNewFolder ? (
              <input
                type="text"
                value={newFolderInput}
                onChange={e => setNewFolderInput(e.target.value)}
                placeholder="Nhập tên thư mục mới..."
                className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl focus:border-primary focus:outline-none"
              />
            ) : (
              <select
                value={folder}
                onChange={e => setFolder(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-card border border-border rounded-xl focus:border-primary focus:outline-none"
              >
                {folders.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Deprecation fields if status is deprecated */}
        {status === 'deprecated' && (
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-3 animate-fade-in">
            <div>
              <label className="block text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">Lý do bãi bỏ & Hướng dẫn</label>
              <input
                type="text"
                value={deprecatedReason}
                onChange={e => setDeprecatedReason(e.target.value)}
                placeholder="Ví dụ: Endpoint này sẽ bị thay thế bởi POST /api/v2/surveys..."
                className="w-full px-3 py-2 text-xs bg-card border border-amber-500/30 rounded-lg focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">Endpoint thay thế</label>
              <select
                value={replacedById || ''}
                onChange={e => setReplacedById(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 text-xs bg-card border border-amber-500/30 rounded-lg focus:outline-none"
              >
                <option value="">-- Không có hoặc chưa tạo --</option>
                {allEndpoints.filter(e => e.id !== initialEndpoint?.id).map(e => (
                  <option key={e.id} value={e.id}>[{e.method}] {e.path} - {e.title}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Auth, Roles, Assignee, Tags */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Cách xác thực</label>
            <select
              value={authType}
              onChange={e => setAuthType(e.target.value as ApiAuthType)}
              className="w-full px-3 py-2 text-xs bg-card border border-border rounded-xl focus:outline-none"
            >
              <option value="bearer">Bearer Token (JWT)</option>
              <option value="apikey">API Key</option>
              <option value="basic">Basic Auth</option>
              <option value="none">Không cần xác thực</option>
              <option value="custom">Khác</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Vai trò / Quyền yêu cầu</label>
            <input
              type="text"
              value={authRoles}
              onChange={e => setAuthRoles(e.target.value)}
              placeholder="Survey.Admin, Survey.Manager"
              className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Người phụ trách (Dev / BA)</label>
            <input
              type="text"
              value={assignee}
              onChange={e => setAssignee(e.target.value)}
              placeholder="Nguyễn Văn A"
              className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Nhãn (Tags, cách nhau dấu phẩy)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="Survey, Read, Pagination"
              className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl focus:outline-none"
            />
          </div>
        </div>

        {/* Description Markdown */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Mô tả chi tiết (Hỗ trợ Markdown)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Mô tả bối cảnh gọi, mục đích và điều kiện tiền đề..."
            rows={4}
            className="w-full p-3 text-xs bg-muted/20 border border-border rounded-xl focus:border-primary focus:outline-none leading-relaxed"
          />
        </div>
      </div>

      {/* 2. PARAMETERS TABLE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            2. Tham số đầu vào (Parameters - {parameters.length})
          </h2>
          <button
            type="button"
            onClick={() => setParameters([...parameters, { name: '', in: 'query', type: 'string', required: false, description: '' }])}
            className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm tham số
          </button>
        </div>

        <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
              <tr>
                <th className="p-2.5 w-1/5">Tên tham số *</th>
                <th className="p-2.5 w-24">Vị trí</th>
                <th className="p-2.5 w-24">Kiểu</th>
                <th className="p-2.5 w-16 text-center">Bắt buộc</th>
                <th className="p-2.5 w-1/4">Mô tả / Ràng buộc</th>
                <th className="p-2.5">Ví dụ</th>
                <th className="p-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {parameters.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
                    Không có tham số nào. Nhấn "+ Thêm tham số" nếu có.
                  </td>
                </tr>
              ) : (
                parameters.map((p, idx) => (
                  <tr key={idx} className="hover:bg-muted/15">
                    <td className="p-2">
                      <input
                        type="text"
                        value={p.name}
                        onChange={e => {
                          const updated = [...parameters];
                          updated[idx].name = e.target.value;
                          setParameters(updated);
                        }}
                        placeholder="paramName"
                        className="w-full px-2 py-1 bg-transparent border border-border/80 rounded font-mono text-xs focus:border-primary focus:outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={p.in}
                        onChange={e => {
                          const updated = [...parameters];
                          updated[idx].in = e.target.value as any;
                          setParameters(updated);
                        }}
                        className="w-full px-2 py-1 bg-card border border-border/80 rounded text-xs focus:outline-none"
                      >
                        <option value="query">query</option>
                        <option value="path">path</option>
                        <option value="header">header</option>
                        <option value="cookie">cookie</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        value={p.type}
                        onChange={e => {
                          const updated = [...parameters];
                          updated[idx].type = e.target.value;
                          setParameters(updated);
                        }}
                        className="w-full px-2 py-1 bg-card border border-border/80 rounded text-xs focus:outline-none font-mono"
                      >
                        <option value="string">string</option>
                        <option value="integer">integer</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                        <option value="array">array</option>
                      </select>
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={p.required}
                        onChange={e => {
                          const updated = [...parameters];
                          updated[idx].required = e.target.checked;
                          setParameters(updated);
                        }}
                        className="rounded border-border text-primary focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={p.description || ''}
                        onChange={e => {
                          const updated = [...parameters];
                          updated[idx].description = e.target.value;
                          setParameters(updated);
                        }}
                        placeholder="Mô tả tham số..."
                        className="w-full px-2 py-1 bg-transparent border border-border/80 rounded text-xs focus:border-primary focus:outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={p.example || ''}
                        onChange={e => {
                          const updated = [...parameters];
                          updated[idx].example = e.target.value;
                          setParameters(updated);
                        }}
                        placeholder="1024"
                        className="w-full px-2 py-1 bg-transparent border border-border/80 rounded text-xs font-mono focus:border-primary focus:outline-none"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => setParameters(parameters.filter((_, i) => i !== idx))}
                        className="p-1 text-muted-foreground hover:text-red-500 rounded"
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

      {/* 3. REQUEST BODY SAMPLES */}
      {['POST', 'PUT', 'PATCH'].includes(method) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              3. Request Body Samples
            </h2>
            <button
              type="button"
              onClick={() => {
                const newSample: ApiRequestBodySample = {
                  name: `Mẫu #${requestBodies.length + 1}`,
                  contentType: 'application/json',
                  body: '{\n  \n}'
                };
                setRequestBodies([...requestBodies, newSample]);
                setActiveReqIdx(requestBodies.length);
              }}
              className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm mẫu payload
            </button>
          </div>

          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm p-4 space-y-3">
            {/* Sample Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto border-b border-border pb-2">
              {requestBodies.map((rb, idx) => (
                <div key={idx} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setActiveReqIdx(idx)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      activeReqIdx === idx ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    {rb.name}
                  </button>
                  {requestBodies.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setRequestBodies(requestBodies.filter((_, i) => i !== idx));
                        setActiveReqIdx(0);
                      }}
                      className="ml-1 text-muted-foreground hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Active Request Body Fields */}
            {requestBodies[activeReqIdx] && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Tên mẫu request</label>
                    <input
                      type="text"
                      value={requestBodies[activeReqIdx].name}
                      onChange={e => {
                        const updated = [...requestBodies];
                        updated[activeReqIdx].name = e.target.value;
                        setRequestBodies(updated);
                      }}
                      placeholder="Ví dụ: Trường hợp chuẩn"
                      className="w-full px-3 py-1.5 text-xs bg-muted/20 border border-border rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Content-Type</label>
                    <select
                      value={requestBodies[activeReqIdx].contentType}
                      onChange={e => {
                        const updated = [...requestBodies];
                        updated[activeReqIdx].contentType = e.target.value;
                        setRequestBodies(updated);
                      }}
                      className="w-full px-3 py-1.5 text-xs bg-card border border-border rounded-lg focus:outline-none font-mono"
                    >
                      <option value="application/json">application/json</option>
                      <option value="multipart/form-data">multipart/form-data</option>
                      <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
                      <option value="text/plain">text/plain</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Tham chiếu Model Schema</label>
                    <select
                      value={requestBodies[activeReqIdx].schemaModel || ''}
                      onChange={e => {
                        const updated = [...requestBodies];
                        updated[activeReqIdx].schemaModel = e.target.value || undefined;
                        setRequestBodies(updated);
                      }}
                      className="w-full px-3 py-1.5 text-xs bg-card border border-border rounded-lg focus:outline-none font-mono text-primary font-medium"
                    >
                      <option value="">-- Tùy chỉnh (Không tham chiếu) --</option>
                      {models.map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-muted-foreground">JSON Payload</label>
                    <button
                      type="button"
                      onClick={handleFormatActiveRequest}
                      className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Làm đẹp JSON (Format)
                    </button>
                  </div>
                  <textarea
                    value={requestBodies[activeReqIdx].body}
                    onChange={e => {
                      const updated = [...requestBodies];
                      updated[activeReqIdx].body = e.target.value;
                      setRequestBodies(updated);
                    }}
                    rows={8}
                    className="w-full p-3 text-xs font-mono bg-slate-950 text-slate-100 border border-border rounded-xl focus:outline-none leading-relaxed"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. RESPONSES CONTRACT */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            4. Phản Hồi (Responses Contract)
          </h2>
          <button
            type="button"
            onClick={() => {
              const newResp: ApiResponse = {
                statusCode: 400,
                description: 'Dữ liệu không hợp lệ',
                examples: [{ name: 'Lỗi 400', body: '{\n  "error": "Bad request"\n}' }]
              };
              setResponses([...responses, newResp]);
              setActiveRespIdx(responses.length);
            }}
            className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm mã phản hồi
          </button>
        </div>

        <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm p-4 space-y-3">
          {/* Status Code Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto border-b border-border pb-2">
            {responses.map((r, idx) => (
              <div key={idx} className="flex items-center">
                <button
                  type="button"
                  onClick={() => setActiveRespIdx(idx)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                    activeRespIdx === idx ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'
                  }`}
                >
                  {r.statusCode}
                </button>
                {responses.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setResponses(responses.filter((_, i) => i !== idx));
                      setActiveRespIdx(0);
                    }}
                    className="ml-1 text-muted-foreground hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Active Response Form */}
          {responses[activeRespIdx] && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Mã trạng thái HTTP *</label>
                  <input
                    type="number"
                    value={responses[activeRespIdx].statusCode}
                    onChange={e => {
                      const updated = [...responses];
                      updated[activeRespIdx].statusCode = Number(e.target.value);
                      setResponses(updated);
                    }}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-muted/20 border border-border rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Mô tả phản hồi</label>
                  <input
                    type="text"
                    value={responses[activeRespIdx].description}
                    onChange={e => {
                      const updated = [...responses];
                      updated[activeRespIdx].description = e.target.value;
                      setResponses(updated);
                    }}
                    placeholder="Lấy dữ liệu thành công..."
                    className="w-full px-3 py-1.5 text-xs bg-muted/20 border border-border rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Tham chiếu Model Schema</label>
                  <select
                    value={responses[activeRespIdx].schemaModel || ''}
                    onChange={e => {
                      const updated = [...responses];
                      updated[activeRespIdx].schemaModel = e.target.value || undefined;
                      setResponses(updated);
                    }}
                    className="w-full px-3 py-1.5 text-xs bg-card border border-border rounded-lg focus:outline-none font-mono text-primary font-medium"
                  >
                    <option value="">-- Tùy chỉnh (Không tham chiếu) --</option>
                    {models.map(m => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-muted-foreground">JSON Response Example</label>
                  <button
                    type="button"
                    onClick={handleFormatActiveResponse}
                    className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Làm đẹp JSON (Format)
                  </button>
                </div>
                <textarea
                  value={responses[activeRespIdx].examples?.[0]?.body || ''}
                  onChange={e => {
                    const updated = [...responses];
                    if (!updated[activeRespIdx].examples || updated[activeRespIdx].examples.length === 0) {
                      updated[activeRespIdx].examples = [{ name: 'Mẫu phản hồi', body: e.target.value }];
                    } else {
                      updated[activeRespIdx].examples[0].body = e.target.value;
                    }
                    setResponses(updated);
                  }}
                  rows={8}
                  className="w-full p-3 text-xs font-mono bg-slate-950 text-slate-100 border border-border rounded-xl focus:outline-none leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. RELATED ERROR CODES & METADATA */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          5. Bảng mã lỗi & Liên kết hệ thống
        </h2>

        {/* Error Codes Selector */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">
            Chọn các Mã lỗi nghiệp vụ liên quan (Click để chọn/bỏ)
          </label>
          <div className="flex flex-wrap gap-2 p-3 bg-muted/20 border border-border rounded-xl">
            {errorCodes.map(ec => {
              const isSelected = selectedErrorCodes.includes(ec.code);
              return (
                <button
                  type="button"
                  key={ec.id}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedErrorCodes(selectedErrorCodes.filter(c => c !== ec.code));
                    } else {
                      setSelectedErrorCodes([...selectedErrorCodes, ec.code]);
                    }
                  }}
                  className={`px-2.5 py-1 text-xs rounded-lg font-mono font-medium border transition-all ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {ec.code} ({ec.http_status})
                </button>
              );
            })}
          </div>
        </div>

        {/* Business Notes & Rate Limit */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Ghi chú nghiệp vụ / Điều kiện tiền đề</label>
            <textarea
              value={businessNotes}
              onChange={e => setBusinessNotes(e.target.value)}
              placeholder="Ghi chú về cache, idempotent key hoặc audit..."
              rows={3}
              className="w-full p-2.5 text-xs bg-muted/20 border border-border rounded-xl focus:outline-none"
            />
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Giới hạn tần suất gọi (Rate Limit / SLA)</label>
              <input
                type="text"
                value={rateLimit}
                onChange={e => setRateLimit(e.target.value)}
                placeholder="Ví dụ: 120 req/min, SLA P95 < 150ms"
                className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl focus:outline-none font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Liên kết Màn hình đặc tả</label>
                <select
                  value={linkedScreenId || ''}
                  onChange={e => setLinkedScreenId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-2.5 py-1.5 text-xs bg-card border border-border rounded-lg focus:outline-none"
                >
                  <option value="">-- Không liên kết --</option>
                  {screens.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Liên kết Bug Tracker</label>
                <select
                  value={linkedBugId || ''}
                  onChange={e => setLinkedBugId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-2.5 py-1.5 text-xs bg-card border border-border rounded-lg focus:outline-none"
                >
                  <option value="">-- Không liên kết --</option>
                  {bugs.map(b => (
                    <option key={b.id} value={b.id}>#{b.id} - {b.title}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Save Button */}
      <div className="flex justify-end gap-3 pt-6 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-xl"
        >
          Hủy bỏ (Esc)
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSubmit}
          className="inline-flex items-center gap-1.5 px-6 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 shadow-sm transition-opacity disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isSaving ? 'Đang lưu...' : 'Lưu Endpoint (Ctrl + S)'}
        </button>
      </div>
    </div>
  );
};
