import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Folder, 
  Tag, 
  User, 
  Layers, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  FileText,
  ExternalLink,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { docsApi } from '../../../services/api';
import { Module, Screen } from '../../../types';
import { useJiraAuthStore } from '../../../stores/jira-auth.store';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { splitFrontmatterAndBody, composeFullMarkdown } from '../../../utils/markdownConverter';
import { SearchableSelect, SelectOption } from '../../../components/ui';
import { usePageTitle } from '../../../utils/usePageTitle';

export const ScreenEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user: jiraUser } = useJiraAuthStore();

  const isNew = !id || id === 'new';
  const queryModuleId = searchParams.get('module');

  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Screen form state
  const [title, setTitle] = useState('');

  usePageTitle(isNew ? 'Tạo Màn hình mới' : title ? `Sửa: ${title}` : 'Chỉnh sửa Màn hình', [isNew, title]);
  const [selectedModuleId, setSelectedModuleId] = useState<number | ''>('');
  const [status, setStatus] = useState<string>('Draft');
  const [author, setAuthor] = useState<string>('');
  const [jiraKey, setJiraKey] = useState<string>('');
  const [tagsInput, setTagsInput] = useState<string>('');
  // Body content only (No YAML frontmatter, making it friendly for no-tech users)
  const [bodyContent, setBodyContent] = useState<string>('');
  const [originalScreen, setOriginalScreen] = useState<Screen | null>(null);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([
      docsApi.getModules(),
      !isNew && id ? docsApi.getScreen(Number(id)) : Promise.resolve(null)
    ])
      .then(([modulesRes, screenRes]) => {
        const rawModules = Array.isArray(modulesRes?.data) ? modulesRes.data : [];
        setModules(rawModules);

        if (screenRes && screenRes.data && typeof screenRes.data === 'object' && !Array.isArray(screenRes.data)) {
          const s = screenRes.data;
          setOriginalScreen(s);
          
          // Split frontmatter and body so user only edits the body content
          const { frontmatter, body } = splitFrontmatterAndBody(s.raw_content || '');

          setTitle(s.title || frontmatter.title || '');
          setSelectedModuleId(s.module_id);
          setStatus(s.status || frontmatter.status || 'Draft');
          setAuthor(s.author || frontmatter.author || '');
          setJiraKey(s.jira_key || frontmatter.jira || '');
          
          const tags = s.tags || frontmatter.tags || [];
          setTagsInput(Array.isArray(tags) ? tags.join(', ') : '');
          setBodyContent(body || s.raw_content || '');
        } else {
          // New screen defaults
          if (queryModuleId) {
            setSelectedModuleId(Number(queryModuleId));
          } else if (rawModules.length > 0) {
            setSelectedModuleId(rawModules[0].id);
          }
          const defaultAuthor = jiraUser?.displayName || 'Author';
          setAuthor(defaultAuthor);
          setStatus('Draft');
          setTitle('Tên Màn Hình Đặc Tả Mới');
          setTagsInput('Handover, Frontend');
          
          // Default body template without YAML header
          setBodyContent(`# Tên Màn Hình Đặc Tả

## 1. TỔNG QUAN (OVERVIEW)
Mô tả vai trò, mục tiêu và phạm vi của màn hình.

## 2. TÍNH NĂNG & TIÊU CHÍ NGHIỆM THU (FEATURES & AC)
| Mã | Tính năng | Mô tả chi tiết | Tiêu chí nghiệm thu (AC) | Trạng thái |
|---|---|---|---|---|
| FEAT-01 | Khởi tạo trang | Tải dữ liệu ban đầu cho màn hình | Hiển thị đầy đủ thông tin sau 1s | Hoàn tất |
| FEAT-02 | Tìm kiếm & Lọc | Lọc theo từ khóa tức thì | Phản hồi dưới 300ms | Đang làm |

## 3. QUY TẮC NGHIỆP VỤ (BUSINESS RULES)
- **BR-01**: Quy tắc nghiệp vụ và ràng buộc dữ liệu cho màn hình này.

## 4. DANH SÁCH API ENDPOINTS
| Method | Endpoint | Mô tả nghiệp vụ | Request Body / Query | Response |
|---|---|---|---|---|
| GET | \`/api/example\` | Lấy danh sách | None | 200 OK |

## 5. CƠ SỞ DỮ LIỆU & ER
\`\`\`sql
-- Schema và quan hệ dữ liệu
\`\`\`

## 6. KIỂM THỬ & QA
- [ ] Kiểm tra hiển thị responsive (Mobile, Tablet, Desktop)
- [ ] Kiểm tra validation dữ liệu

## 7. GHI CHÚ BÀN GIAO
> [!NOTE]
> Ghi chú kỹ thuật hoặc hướng dẫn bàn giao cho developer tiếp nhận.
`);
        }
      })
      .catch((err) => {
        setModules([]);
        toast.error('Không thể tải dữ liệu màn hình hoặc danh sách module');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [id, isNew, queryModuleId]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Vui lòng nhập tên màn hình đặc tả');
      return;
    }
    if (!selectedModuleId) {
      toast.error('Vui lòng chọn Nhóm tính năng cho màn hình');
      return;
    }

    setSaving(true);
    const tagsArray = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const safeModules = Array.isArray(modules) ? modules : [];
    const currentModule = safeModules.find((m) => m.id === Number(selectedModuleId));

    // Recombine metadata and body into clean standard Markdown with Frontmatter
    const fullMarkdownContent = composeFullMarkdown(
      {
        title: title.trim(),
        moduleName: currentModule?.name,
        author: author.trim() || 'Author',
        status,
        jiraKey: jiraKey.trim() || undefined,
        tags: tagsArray
      },
      bodyContent
    );

    try {
      if (isNew) {
        const res = await docsApi.createScreen({
          moduleId: Number(selectedModuleId),
          title: title.trim(),
          author: author.trim() || 'Author',
          status,
          jira_key: jiraKey.trim() || undefined,
          tags: tagsArray,
          raw_content: fullMarkdownContent
        });
        toast.success('Tạo màn hình đặc tả thành công!');
        navigate(`/docs/screen/${res.data.id}`);
      } else if (id) {
        const res = await docsApi.updateScreen(Number(id), {
          moduleId: Number(selectedModuleId),
          title: title.trim(),
          author: author.trim() || 'Author',
          status,
          jira_key: jiraKey.trim() || undefined,
          tags: tagsArray,
          raw_content: fullMarkdownContent
        });
        toast.success('Lưu tài liệu đặc tả thành công!');
        navigate(`/docs/screen/${res.data.id}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Lưu tài liệu thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
        <span>Đang tải editor tài liệu đặc tả...</span>
      </div>
    );
  }

  const safeModules = Array.isArray(modules) ? modules : [];
  const currentModule = safeModules.find((m) => m.id === Number(selectedModuleId));

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-5 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/80">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!isNew && id) navigate(`/docs/screen/${id}`);
              else navigate('/docs');
            }}
            className="p-2 rounded-xl border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition shrink-0"
            title="Quay lại"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                TÀI LIỆU ĐẶC TẢ
              </span>
              <span className="text-xs text-muted-foreground">/</span>
              <span className="text-xs font-semibold text-primary">
                {currentModule?.name || 'Nhóm'}
              </span>
            </div>
            <h1 className="text-lg sm:text-2xl font-extrabold text-foreground truncate">
              {isNew ? 'Tạo Mới Tài Liệu Đặc Tả' : `Chỉnh Sửa: ${title || 'Màn hình'}`}
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => {
              if (!isNew && id) navigate(`/docs/screen/${id}`);
              else navigate('/docs');
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Đang lưu...' : 'Lưu tài liệu'}</span>
          </button>
        </div>
      </div>

      {/* Metadata Configuration Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
          {/* Screen Title */}
          <div className="md:col-span-6">
            <label className="text-xs font-bold text-foreground block mb-1">
              Tên Màn Hình Đặc Tả <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Danh Sách Khảo Sát (Survey List)"
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm font-semibold focus:outline-none focus:border-primary"
            />
          </div>

          {/* Group / Module Selector */}
          <div className="md:col-span-3">
            <label className="text-xs font-bold text-foreground block mb-1">
              Thuộc Nhóm (Module) <span className="text-destructive">*</span>
            </label>
            <SearchableSelect<number | ''>
              options={safeModules.map((m) => ({
                value: m.id,
                label: `${m.icon || '📁'} ${m.name}`,
              }))}
              value={selectedModuleId}
              onChange={(val) => setSelectedModuleId(val)}
              placeholder="Chọn nhóm module..."
              searchPlaceholder="Tìm kiếm module..."
              size="sm"
            />
            {safeModules.length === 0 && (
              <span className="text-[10px] text-amber-500 mt-1 block font-medium">
                Chưa tải được module (kiểm tra URL Backend tại Cài đặt)
              </span>
            )}
          </div>

          {/* Status Selector */}
          <div className="md:col-span-3">
            <label className="text-xs font-bold text-foreground block mb-1">
              Trạng Thái (Status)
            </label>
            <SearchableSelect<string>
              options={[
                { value: 'Draft', label: 'Draft (Bản nháp)', badge: 'Draft', badgeColor: 'bg-muted text-muted-foreground' },
                { value: 'In Review', label: 'In Review (Đang duyệt)', badge: 'Review', badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
                { value: 'Published', label: 'Published (Đã bàn giao)', badge: 'Published', badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
              ]}
              value={status}
              onChange={(val) => setStatus(val)}
              placeholder="Chọn trạng thái..."
              searchable={false}
              size="sm"
            />
          </div>
        </div>

        {/* Secondary Metadata: Author, Jira Key, Tags */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/50 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Tác giả (Author)
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="e.g. PhatDM"
              className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Mã Jira Ticket (nếu có)
            </label>
            <input
              type="text"
              value={jiraKey}
              onChange={(e) => setJiraKey(e.target.value)}
              placeholder="e.g. SURV-102"
              className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Tags (phân cách bằng dấu phẩy)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. Survey, Form, HighPriority"
              className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Rich Markdown & WYSIWYG Editor */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-primary" />
            <span>Nội dung tài liệu</span>
          </label>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Soạn thảo trực quan tự nhiên (như Word) hoặc chuyển qua mã Markdown tùy ý</span>
          </span>
        </div>

        <MarkdownEditor
          value={bodyContent}
          onChange={setBodyContent}
          onSave={handleSave}
          isSaving={saving}
          minHeight="550px"
          placeholder="Nhập nội dung đặc tả, mô tả tính năng, quy tắc nghiệp vụ, bảng AC..."
        />
      </div>
    </div>
  );
};
