import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  Database, 
  Sparkles, 
  ChevronRight, 
  ChevronDown, 
  ExternalLink,
  Code2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ApiModel, ApiModelField, ApiEndpoint } from '@/types';
import { apiDocsApi } from '../../../../services/api';
import { inferSchemaFromJson, formatJsonSafe } from '../utils/schemaInferrer';

interface ApiModelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleId: number;
  endpoints: ApiEndpoint[];
  onModelsChanged?: () => void;
}

export const ApiModelsModal: React.FC<ApiModelsModalProps> = ({
  isOpen,
  onClose,
  moduleId,
  endpoints,
  onModelsChanged
}) => {
  const [models, setModels] = useState<ApiModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ApiModel | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<ApiModelField[]>([]);
  const [sampleJsonInput, setSampleJsonInput] = useState('');
  const [showJsonInferBox, setShowJsonInferBox] = useState(false);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const res = await apiDocsApi.getModels(moduleId);
      setModels(res.data);
      if (res.data.length > 0 && !selectedModel) {
        setSelectedModel(res.data[0]);
      }
    } catch (err: any) {
      toast.error('Không thể tải danh sách models: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchModels();
    }
  }, [isOpen, moduleId]);

  const handleStartCreate = () => {
    setSelectedModel(null);
    setName('');
    setDescription('');
    setFields([
      { name: 'id', type: 'integer', required: true, description: 'ID định danh duy nhất', example: 1 }
    ]);
    setIsEditing(true);
    setShowJsonInferBox(false);
  };

  const handleStartEdit = (m: ApiModel) => {
    setSelectedModel(m);
    setName(m.name);
    setDescription(m.description || '');
    setFields(m.fields || []);
    setIsEditing(true);
    setShowJsonInferBox(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên model (ví dụ: SurveyDto)');
      return;
    }

    try {
      if (selectedModel?.id) {
        await apiDocsApi.updateModel(selectedModel.id, {
          name: name.trim(),
          description,
          fields
        });
        toast.success(`Đã cập nhật model ${name}`);
      } else {
        await apiDocsApi.createModel({
          module_id: moduleId,
          name: name.trim(),
          description,
          fields
        });
        toast.success(`Đã tạo mới model ${name}`);
      }
      setIsEditing(false);
      await fetchModels();
      onModelsChanged?.();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const handleDelete = async (id: number, modelName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa model '${modelName}'?`)) return;

    try {
      const res = await apiDocsApi.deleteModel(id);
      toast.success(res.data.message || 'Đã xóa model');
      if (res.data.referencesCount > 0) {
        toast(`Lưu ý: Có ${res.data.referencesCount} endpoint đang tham chiếu tới model này!`, { icon: '⚠️' });
      }
      setSelectedModel(null);
      await fetchModels();
      onModelsChanged?.();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const handleInferFromJson = () => {
    if (!sampleJsonInput.trim()) {
      toast.error('Vui lòng dán chuỗi JSON mẫu vào khung');
      return;
    }
    const inferred = inferSchemaFromJson(sampleJsonInput);
    if (inferred.length === 0) {
      toast.error('JSON không hợp lệ hoặc rỗng');
      return;
    }
    setFields(inferred);
    setShowJsonInferBox(false);
    toast.success(`Đã tự động suy luận được ${inferred.length} trường dữ liệu!`);
  };

  // Find endpoints referencing selected model
  const referencingEndpoints = selectedModel
    ? endpoints.filter(ep => {
        const inReq = (ep.request_bodies || []).some(r => r.schemaModel === selectedModel.name);
        const inResp = (ep.responses || []).some(r => r.schemaModel === selectedModel.name);
        return inReq || inResp;
      })
    : [];

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
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Mô hình Dữ liệu dùng chung (Schemas / DTOs)</h2>
              <p className="text-xs text-muted-foreground">Khai báo một lần, tái sử dụng và đồng bộ trên toàn bộ Request / Response</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Models List */}
          <div className="w-72 border-r border-border bg-muted/10 flex flex-col shrink-0">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Danh mục Models</span>
              <button
                onClick={handleStartCreate}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" /> Tạo mới
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
              {models.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  Chưa có model nào. Hãy nhấn "+ Tạo mới".
                </div>
              ) : (
                models.map(m => {
                  const isSelected = selectedModel?.id === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        setSelectedModel(m);
                        setIsEditing(false);
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-colors ${
                        isSelected ? 'bg-primary/15 text-primary font-semibold' : 'hover:bg-muted/50 text-foreground'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono truncate">{m.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{m.fields?.length || 0} trường</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Model Details or Edit Form */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin flex flex-col">
            {isEditing ? (
              /* EDIT / CREATE FORM */
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="text-base font-bold text-foreground">
                    {selectedModel?.id ? `Chỉnh sửa Model: ${selectedModel.name}` : 'Tạo Model Mới'}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={handleSave}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" /> Lưu Model
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Tên Model / DTO (viết hoa chữ cái đầu) *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Ví dụ: SurveyDto, UserProfile, OrderItem"
                      className="w-full px-3 py-2 text-sm bg-muted/30 border border-border rounded-xl font-mono focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Mô tả mục đích</label>
                    <input
                      type="text"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Mô tả thực thể dữ liệu này dùng ở đâu..."
                      className="w-full px-3 py-2 text-sm bg-muted/30 border border-border rounded-xl focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* JSON Auto-infer Box */}
                <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" /> Dán JSON mẫu để tự động suy luận danh sách trường
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowJsonInferBox(!showJsonInferBox)}
                      className="text-xs text-primary underline"
                    >
                      {showJsonInferBox ? 'Thu gọn' : 'Mở khung dán'}
                    </button>
                  </div>

                  {showJsonInferBox && (
                    <div className="space-y-2 mt-2">
                      <textarea
                        value={sampleJsonInput}
                        onChange={e => setSampleJsonInput(e.target.value)}
                        placeholder='{"id": 1, "name": "John", "email": "john@test.com", "isActive": true}'
                        rows={5}
                        className="w-full p-2.5 text-xs font-mono bg-card border border-border rounded-lg focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleInferFromJson}
                          className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg"
                        >
                          Phân tích và nạp trường
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Fields Table */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Danh sách các trường ({fields.length})</label>
                    <button
                      type="button"
                      onClick={() => setFields([...fields, { name: '', type: 'string', required: true, description: '' }])}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm dòng
                    </button>
                  </div>

                  <div className="border border-border rounded-xl overflow-hidden shadow-sm bg-card">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                        <tr>
                          <th className="p-2.5 w-1/4">Tên trường *</th>
                          <th className="p-2.5 w-1/6">Kiểu dữ liệu</th>
                          <th className="p-2.5 w-20 text-center">Bắt buộc</th>
                          <th className="p-2.5">Mô tả / Ràng buộc</th>
                          <th className="p-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {fields.map((f, idx) => (
                          <tr key={idx} className="hover:bg-muted/20">
                            <td className="p-2">
                              <input
                                type="text"
                                value={f.name}
                                onChange={e => {
                                  const updated = [...fields];
                                  updated[idx].name = e.target.value;
                                  setFields(updated);
                                }}
                                placeholder="fieldName"
                                className="w-full px-2 py-1 bg-transparent border border-border/80 rounded font-mono text-xs focus:border-primary focus:outline-none"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={f.type}
                                onChange={e => {
                                  const updated = [...fields];
                                  updated[idx].type = e.target.value;
                                  setFields(updated);
                                }}
                                className="w-full px-2 py-1 bg-card border border-border/80 rounded text-xs focus:border-primary focus:outline-none"
                              >
                                <option value="string">string</option>
                                <option value="integer">integer</option>
                                <option value="number">number / decimal</option>
                                <option value="boolean">boolean</option>
                                <option value="object">object</option>
                                <option value="array">array</option>
                                <option value="string (datetime)">string (datetime)</option>
                                <option value="string (uuid)">string (uuid)</option>
                              </select>
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={f.required}
                                onChange={e => {
                                  const updated = [...fields];
                                  updated[idx].required = e.target.checked;
                                  setFields(updated);
                                }}
                                className="rounded border-border text-primary focus:ring-0 w-4 h-4 cursor-pointer"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={f.description || ''}
                                onChange={e => {
                                  const updated = [...fields];
                                  updated[idx].description = e.target.value;
                                  setFields(updated);
                                }}
                                placeholder="Ghi chú nghiệp vụ..."
                                className="w-full px-2 py-1 bg-transparent border border-border/80 rounded text-xs focus:border-primary focus:outline-none"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => setFields(fields.filter((_, i) => i !== idx))}
                                className="p-1 text-muted-foreground hover:text-red-500 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : selectedModel ? (
              /* VIEW MODE */
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold font-mono text-foreground">{selectedModel.name}</h3>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        DTO Model
                      </span>
                    </div>
                    {selectedModel.description && (
                      <p className="text-sm text-muted-foreground mt-1">{selectedModel.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartEdit(selectedModel)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Sửa Model
                    </button>
                    <button
                      onClick={() => handleDelete(selectedModel.id, selectedModel.name)}
                      className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Table of Fields */}
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Cấu trúc các trường ({selectedModel.fields?.length || 0})
                  </h4>
                  <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                        <tr>
                          <th className="p-3 w-1/4">Tên trường</th>
                          <th className="p-3 w-1/6">Kiểu</th>
                          <th className="p-3 w-20 text-center">Bắt buộc</th>
                          <th className="p-3">Mô tả & Ràng buộc</th>
                          <th className="p-3">Giá trị ví dụ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {(selectedModel.fields || []).map((f, i) => (
                          <tr key={i} className="hover:bg-muted/10">
                            <td className="p-3 font-mono font-semibold text-foreground">
                              {f.name}
                            </td>
                            <td className="p-3">
                              <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {f.type}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {f.required ? (
                                <span className="text-[11px] font-bold text-red-500">Có</span>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">Không</span>
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground leading-relaxed">
                              {f.description || f.constraints || '-'}
                            </td>
                            <td className="p-3 font-mono text-muted-foreground">
                              {f.example !== undefined ? String(f.example) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Referencing Endpoints */}
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Các Endpoint đang sử dụng Model này ({referencingEndpoints.length})
                  </h4>
                  {referencingEndpoints.length === 0 ? (
                    <div className="p-4 border border-dashed border-border rounded-xl text-xs text-muted-foreground text-center">
                      Chưa có endpoint nào tham chiếu tới model này. Bạn có thể chọn model này trong mục Request Body hoặc Response khi sửa endpoint.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {referencingEndpoints.map(ep => (
                        <div key={ep.id} className="p-2.5 rounded-lg border border-border bg-muted/20 flex items-center justify-between text-xs">
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-primary mr-1.5">{ep.method}</span>
                            <span className="font-mono text-foreground truncate">{ep.path}</span>
                            <div className="text-[11px] text-muted-foreground truncate">{ep.title}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <Database className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">Chọn một model bên trái hoặc tạo mới model</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
