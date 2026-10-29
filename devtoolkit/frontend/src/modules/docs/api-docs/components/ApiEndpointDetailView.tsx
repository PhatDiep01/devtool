import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  Edit3, 
  Trash2, 
  CopyPlus, 
  Pin, 
  PinOff, 
  ExternalLink, 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  Key, 
  User, 
  Tag, 
  Folder, 
  FileCode, 
  Terminal, 
  FileText,
  Layers,
  ChevronDown,
  ChevronRight,
  Info,
  Play,
  Send
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ApiEndpoint, Screen, BugItem, ApiErrorCode } from '@/types';
import { ApiMethodBadge } from './ApiMethodBadge';
import { MarkdownRenderer } from '../../components/MarkdownRenderer';

interface ApiEndpointDetailViewProps {
  endpoint: ApiEndpoint;
  allEndpoints: ApiEndpoint[];
  screens: Screen[];
  bugs: BugItem[];
  allErrorCodes: ApiErrorCode[];
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onSelectErrorCode?: (code: string) => void;
  onTestPostman?: () => void;
}

export const ApiEndpointDetailView: React.FC<ApiEndpointDetailViewProps> = ({
  endpoint,
  allEndpoints,
  screens,
  bugs,
  allErrorCodes,
  onEdit,
  onDuplicate,
  onDelete,
  onTogglePin,
  onSelectErrorCode,
  onTestPostman
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeReqSampleIdx, setActiveReqSampleIdx] = useState(0);
  const [activeRespCode, setActiveRespCode] = useState<number>(() => {
    return endpoint.responses?.[0]?.statusCode || 200;
  });
  const [activeRespSampleIdx, setActiveRespSampleIdx] = useState(0);

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`Đã sao chép ${label}!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyCurl = () => {
    let curl = `curl -X ${endpoint.method} "https://api.internal.domain${endpoint.path}"`;
    if (endpoint.auth_type === 'bearer') curl += ` \\\n  -H "Authorization: Bearer <TOKEN>"`;
    if (endpoint.request_bodies?.[0]?.body) {
      curl += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${endpoint.request_bodies[0].body.replace(/'/g, "\\'")}'`;
    }
    handleCopyText(curl, 'lệnh cURL');
  };

  const handleCopyMarkdown = () => {
    let md = `### [${endpoint.method}] \`${endpoint.path}\` - ${endpoint.title}\n\n`;
    md += `**Trạng thái:** \`${endpoint.status}\` | **Phiên bản:** \`${endpoint.version}\`\n\n`;
    if (endpoint.description) md += `${endpoint.description}\n\n`;
    if (endpoint.request_bodies?.[0]?.body) {
      md += `**Request Body:**\n\`\`\`json\n${endpoint.request_bodies[0].body}\n\`\`\`\n\n`;
    }
    handleCopyText(md, 'Markdown');
  };

  const activeResponse = endpoint.responses?.find(r => r.statusCode === activeRespCode) || endpoint.responses?.[0];

  // Linked screen & bug
  const linkedScreen = screens.find(s => s.id === endpoint.linked_screen_id);
  const linkedBug = bugs.find(b => b.id === endpoint.linked_bug_id);

  // Replaced by endpoint if deprecated
  const replacedByEp = endpoint.replaced_by_id 
    ? allEndpoints.find(e => e.id === endpoint.replaced_by_id)
    : null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 select-text">
      {/* 1. TOP HEADER & METADATA */}
      <div className="space-y-4 border-b border-border pb-6">
        {/* Breadcrumb & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Folder className="w-3.5 h-3.5 text-primary" /> {endpoint.folder || 'Chung'}
            </span>
            <span>/</span>
            <span className="font-mono text-primary font-semibold">{endpoint.version || 'v1'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onTogglePin}
              title={endpoint.is_pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
              className={`p-1.5 rounded-lg border transition-colors ${
                endpoint.is_pinned 
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-500' 
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {endpoint.is_pinned ? <Pin className="w-4 h-4 fill-current" /> : <Pin className="w-4 h-4" />}
            </button>

            <button
              onClick={handleCopyCurl}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Terminal className="w-3.5 h-3.5" /> cURL
            </button>

            <button
              onClick={handleCopyMarkdown}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <FileText className="w-3.5 h-3.5" /> Copy Markdown
            </button>

            <button
              onClick={onDuplicate}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <CopyPlus className="w-3.5 h-3.5" /> Nhân bản
            </button>

            {onTestPostman && (
              <button
                onClick={onTestPostman}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Test API (Postman)
              </button>
            )}

            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5" /> Sửa (E)
            </button>

            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Path Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <ApiMethodBadge method={endpoint.method} size="lg" />
          <div className="flex-1 flex items-center gap-2 bg-muted/40 border border-border px-3.5 py-2 rounded-xl font-mono text-sm sm:text-base font-bold text-foreground">
            <span className="select-all break-all">{endpoint.path}</span>
            <button
              onClick={() => handleCopyText(endpoint.path, 'đường dẫn')}
              className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors ml-auto shrink-0"
              title="Copy đường dẫn"
            >
              {copiedField === 'đường dẫn' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Title & Status Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{endpoint.title}</h1>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
              endpoint.status === 'stable' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
              endpoint.status === 'draft' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
              endpoint.status === 'deprecated' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-muted text-muted-foreground'
            }`}>
              {endpoint.status === 'stable' ? 'Ổn định' :
               endpoint.status === 'draft' ? 'Bản nháp' :
               endpoint.status === 'deprecated' ? 'Sắp bãi bỏ' : 'Đã bãi bỏ'}
            </span>
          </div>
        </div>

        {/* Info pills: Assignee, Auth, Roles, Tags */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground pt-1">
          {endpoint.assignee && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 border border-border">
              <User className="w-3.5 h-3.5 text-primary" /> {endpoint.assignee}
            </span>
          )}

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 border border-border">
            <Key className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-mono uppercase font-semibold">{endpoint.auth_type}</span>
          </span>

          {endpoint.auth_roles && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 border border-border">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Quyền: {endpoint.auth_roles}
            </span>
          )}

          {(endpoint.tags || []).map((t, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium text-[11px]">
              <Tag className="w-3 h-3" /> {t}
            </span>
          ))}
        </div>

        {/* Deprecation Warning Banner */}
        {endpoint.status === 'deprecated' && (
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 space-y-1 text-xs">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>CẢNH BÁO: Endpoint này sắp bị bãi bỏ (Deprecated)</span>
            </div>
            {endpoint.deprecated_reason && (
              <p className="pl-6 text-xs opacity-90">{endpoint.deprecated_reason}</p>
            )}
            {replacedByEp && (
              <div className="pl-6 pt-1">
                <span>Endpoint thay thế: </span>
                <span className="font-mono font-bold text-foreground">[{replacedByEp.method}] {replacedByEp.path}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. OVERVIEW / DESCRIPTION */}
      {endpoint.description && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Mô tả & Bối cảnh nghiệp vụ</h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <MarkdownRenderer content={endpoint.description} />
          </div>
        </div>
      )}

      {/* 3. PARAMETERS TABLE */}
      {endpoint.parameters && endpoint.parameters.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Tham số đầu vào (Parameters - {endpoint.parameters.length})
          </h2>
          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3 w-1/4">Tên tham số</th>
                  <th className="p-3 w-20 text-center">Vị trí</th>
                  <th className="p-3 w-24">Kiểu</th>
                  <th className="p-3 w-20 text-center">Bắt buộc</th>
                  <th className="p-3">Mô tả & Ràng buộc</th>
                  <th className="p-3 w-28">Ví dụ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {endpoint.parameters.map((p, idx) => (
                  <tr key={idx} className="hover:bg-muted/15 transition-colors">
                    <td className="p-3 font-mono font-bold text-foreground">
                      {p.name}
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-muted text-muted-foreground uppercase">
                        {p.in}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-muted-foreground">
                      {p.type}
                    </td>
                    <td className="p-3 text-center">
                      {p.required ? (
                        <span className="text-[11px] font-bold text-red-500">Có</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Không</span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground leading-relaxed">
                      {p.description || '-'}
                      {p.constraints && (
                        <div className="text-[11px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                          Ràng buộc: {p.constraints}
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono text-muted-foreground">
                      {p.example || p.default || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. REQUEST BODY CONTRACT */}
      {endpoint.request_bodies && endpoint.request_bodies.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Cấu trúc Request Body & Mẫu Dữ Liệu
            </h2>
            {endpoint.request_bodies[activeReqSampleIdx]?.schemaModel && (
              <span className="text-xs text-primary font-mono font-medium">
                Schema Model: {endpoint.request_bodies[activeReqSampleIdx].schemaModel}
              </span>
            )}
          </div>

          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
            {/* Sample Selector Tabs */}
            <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b border-border text-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {endpoint.request_bodies.map((rb, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveReqSampleIdx(idx)}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                      activeReqSampleIdx === idx 
                        ? 'bg-primary text-primary-foreground' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {rb.name || `Mẫu #${idx + 1}`}
                  </button>
                ))}
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                {endpoint.request_bodies[activeReqSampleIdx]?.contentType || 'application/json'}
              </span>
            </div>

            {/* Code Body */}
            <div className="relative p-4 bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto scrollbar-thin">
              <button
                onClick={() => handleCopyText(endpoint.request_bodies[activeReqSampleIdx]?.body || '', 'payload')}
                className="absolute top-3 right-3 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium flex items-center gap-1"
              >
                {copiedField === 'payload' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                Copy JSON
              </button>
              <pre className="whitespace-pre leading-relaxed select-text">
                {endpoint.request_bodies[activeReqSampleIdx]?.body || '{\n  // Không có payload\n}'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* 5. RESPONSES CONTRACT */}
      {endpoint.responses && endpoint.responses.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Phản Hồi (Responses Contract)
          </h2>

          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
            {/* Status Code Tabs */}
            <div className="flex items-center gap-1 p-2 bg-muted/40 border-b border-border overflow-x-auto">
              {endpoint.responses.map(r => {
                const isSelected = activeRespCode === r.statusCode;
                const is2xx = r.statusCode >= 200 && r.statusCode < 300;
                const is4xx = r.statusCode >= 400 && r.statusCode < 500;
                const is5xx = r.statusCode >= 500;

                return (
                  <button
                    key={r.statusCode}
                    onClick={() => {
                      setActiveRespCode(r.statusCode);
                      setActiveRespSampleIdx(0);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isSelected
                        ? is2xx ? 'bg-emerald-600 text-white shadow-sm' :
                          is4xx ? 'bg-amber-600 text-white shadow-sm' : 'bg-red-600 text-white shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <span>{r.statusCode}</span>
                    <span className="font-normal opacity-90 truncate max-w-[120px]">{r.description || 'Response'}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Response Details */}
            {activeResponse && (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <div className="text-muted-foreground">
                    <strong className="text-foreground">Mô tả:</strong> {activeResponse.description || 'Không có mô tả'}
                  </div>
                  {activeResponse.schemaModel && (
                    <span className="text-xs text-primary font-mono font-medium">
                      Model: {activeResponse.schemaModel}
                    </span>
                  )}
                </div>

                {/* Response Samples */}
                {activeResponse.examples && activeResponse.examples.length > 0 && (
                  <div className="space-y-2">
                    {activeResponse.examples.length > 1 && (
                      <div className="flex gap-2">
                        {activeResponse.examples.map((ex, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveRespSampleIdx(i)}
                            className={`px-2.5 py-1 rounded text-xs font-semibold ${
                              activeRespSampleIdx === i 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {ex.name || `Ví dụ #${i + 1}`}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="relative p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto scrollbar-thin">
                      <button
                        onClick={() => handleCopyText(activeResponse.examples[activeRespSampleIdx]?.body || '', 'response')}
                        className="absolute top-3 right-3 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium flex items-center gap-1"
                      >
                        {copiedField === 'response' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        Copy JSON
                      </button>
                      <pre className="whitespace-pre leading-relaxed select-text">
                        {activeResponse.examples[activeRespSampleIdx]?.body || '{}'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. RELATED ERROR CODES */}
      {endpoint.related_error_codes && endpoint.related_error_codes.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Mã Lỗi Nghiệp Vụ Liên Quan
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {endpoint.related_error_codes.map((codeVal, idx) => {
              const matched = allErrorCodes.find(ec => ec.code === codeVal);
              return (
                <div
                  key={idx}
                  onClick={() => onSelectErrorCode?.(codeVal)}
                  className="p-3 rounded-xl border border-border bg-card hover:border-primary/50 cursor-pointer transition-all flex items-start gap-3"
                >
                  <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    {matched?.http_status || 'ERR'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono font-bold text-xs text-foreground truncate">{codeVal}</div>
                    <div className="text-[11px] text-muted-foreground line-clamp-1">{matched?.message || 'Xem chi tiết mã lỗi'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. BUSINESS NOTES & RATE LIMIT */}
      {(endpoint.business_notes || endpoint.rate_limit) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {endpoint.business_notes && (
            <div className="space-y-2">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Lưu ý & Quy tắc nghiệp vụ</h2>
              <div className="rounded-xl border border-border bg-card p-4 text-xs leading-relaxed">
                <MarkdownRenderer content={endpoint.business_notes} />
              </div>
            </div>
          )}
          {endpoint.rate_limit && (
            <div className="space-y-2">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Giới hạn tần suất & SLA</h2>
              <div className="rounded-xl border border-border bg-card p-4 text-xs font-mono text-primary flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0 text-primary" />
                <span>Rate limit: {endpoint.rate_limit}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 8. LINKED SPECS & BUGS */}
      {(linkedScreen || linkedBug) && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Liên kết Tài liệu đặc tả & Bug</h2>
          <div className="flex flex-wrap gap-3">
            {linkedScreen && (
              <a
                href={`/docs/screen/${linkedScreen.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card hover:border-primary text-xs font-medium text-foreground transition-colors"
              >
                <FileText className="w-4 h-4 text-primary" />
                <span>Màn hình đặc tả: <strong>{linkedScreen.title}</strong></span>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              </a>
            )}
            {linkedBug && (
              <a
                href={`/docs/bugs?id=${linkedBug.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card hover:border-red-500 text-xs font-medium text-foreground transition-colors"
              >
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span>Bug Tracker: <strong>#{linkedBug.id} - {linkedBug.title}</strong></span>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* 9. CHANGE AUDIT HISTORY */}
      {endpoint.change_history && endpoint.change_history.length > 0 && (
        <div className="space-y-2 border-t border-border pt-6">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Lịch sử thay đổi gần nhất
          </h2>
          <div className="divide-y divide-border/50 text-xs text-muted-foreground">
            {endpoint.change_history.slice(0, 5).map((h, i) => (
              <div key={i} className="py-2 flex items-center justify-between">
                <div>
                  <strong className="text-foreground">{h.author}:</strong> {h.action}
                </div>
                <span className="font-mono text-[11px] opacity-75">{h.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
