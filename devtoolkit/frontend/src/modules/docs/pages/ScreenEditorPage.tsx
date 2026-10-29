import React, { useState, useEffect, useRef } from 'react';
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
  HelpCircle,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { docsApi, filesApi } from '../../../services/api';
import { Module, Screen, ScreenImage } from '../../../types';
import { useJiraAuthStore } from '../../../stores/jira-auth.store';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { ScreenImagesGallery } from '../components/ScreenImagesGallery';
import { splitFrontmatterAndBody, composeFullMarkdown, removeImageFromMarkdown } from '../../../utils/markdownConverter';
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

  // Screen attached images
  const [screenImages, setScreenImages] = useState<ScreenImage[]>([]);

  // File input ref for importing .md files
  const mdFileInputRef = useRef<HTMLInputElement>(null);

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

          if (Array.isArray(s.images)) {
            setScreenImages(s.images);
          } else {
            // Fallback load images
            filesApi.getScreenImages(Number(id))
              .then((imgRes) => setScreenImages(imgRes.data || []))
              .catch(() => {});
          }
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

  // Handle importing .md file directly into editor
  const handleImportMdFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.md')) {
      toast.error('Vui lòng chọn file Markdown (.md) hợp lệ');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) || '';
      if (!content.trim()) {
        toast.error('File Markdown rỗng');
        return;
      }

      const { frontmatter, body } = splitFrontmatterAndBody(content);

      // Auto-extract title: frontmatter.title -> first # Heading -> file name
      let parsedTitle = frontmatter.title || '';
      if (!parsedTitle) {
        const headingMatch = body.match(/^#\s+(.+)$/m);
        if (headingMatch) {
          parsedTitle = headingMatch[1].trim();
        } else {
          parsedTitle = file.name.replace(/\.md$/i, '');
        }
      }

      if (parsedTitle) setTitle(parsedTitle);
      if (frontmatter.author) setAuthor(frontmatter.author);
      if (frontmatter.jira) setJiraKey(frontmatter.jira);
      if (frontmatter.status) setStatus(frontmatter.status);

      if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
        setTagsInput(frontmatter.tags.join(', '));
      }

      // Match module if specified in frontmatter
      if (frontmatter.module && modules.length > 0) {
        const modName = frontmatter.module.trim().toLowerCase();
        const matched = modules.find(
          (m) => m.name.toLowerCase() === modName || m.slug.toLowerCase() === modName
        );
        if (matched) {
          setSelectedModuleId(matched.id);
        }
      }

      setBodyContent(body || content);
      toast.success(`Đã nạp thành công nội dung và thuộc tính từ file "${file.name}"!`);
    };
    reader.readAsText(file);
  };

  // Deferred upload handler for images inserted directly via MarkdownEditor
  const handleEditorUploadImage = async (file: File): Promise<string> => {
    const previewUrl = URL.createObjectURL(file);
    const tempId = `temp_img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const pendingImg: ScreenImage = {
      id: -Date.now(),
      tempId,
      screen_id: !isNew && id ? Number(id) : null,
      original_name: file.name,
      stored_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      created_at: new Date().toISOString(),
      url: previewUrl,
      isPending: true,
      file,
    };
    setScreenImages((prev) => [pendingImg, ...prev]);
    toast.success('Đã thêm ảnh vào danh sách (Chờ bấm "Lưu tài liệu" để lưu lên máy chủ)');
    return previewUrl;
  };

  // Deleting image from Gallery removes it from document bodyContent
  const handleGalleryDeleteImage = (deletedImg: ScreenImage) => {
    setBodyContent((prev) => removeImageFromMarkdown(prev, deletedImg));
    toast.success(`Đã xóa ảnh "${deletedImg.original_name}" và loại bỏ khỏi nội dung tài liệu`);
  };

  // Deleting image from Editor removes it from Gallery & cleans server storage
  const handleEditorDeleteImage = async (imageSrc: string) => {
    if (!imageSrc) return;

    // Find in screenImages
    const matched = screenImages.find((img) => {
      if (img.url && (img.url === imageSrc || imageSrc.includes(img.url))) return true;
      if (img.stored_name && imageSrc.includes(img.stored_name)) return true;
      if (img.tempId && imageSrc.includes(img.tempId)) return true;
      if (img.original_name && img.original_name.length > 3 && imageSrc.includes(img.original_name)) return true;
      return false;
    });

    if (matched) {
      setScreenImages((prev) => prev.filter((item) => item.id !== matched.id));
      if (!matched.isPending) {
        try {
          await filesApi.deleteImage(matched.id);
          if (matched.stored_name) {
            await filesApi.deleteImageByName(matched.stored_name).catch(() => {});
          }
          toast.success(`Đã xóa ảnh "${matched.original_name}" trên máy chủ và giải phóng bộ nhớ!`);
        } catch (e) {
          console.error(e);
        }
      } else if (matched.url?.startsWith('blob:')) {
        try { URL.revokeObjectURL(matched.url); } catch {}
      }
    } else {
      // If imageSrc contains /api/files/images/<filename>
      const match = imageSrc.match(/\/api\/files\/images\/([^"'\s?#]+)/);
      if (match && match[1]) {
        const storedName = match[1];
        try {
          await filesApi.deleteImageByName(storedName);
          toast.success(`Đã xóa file ảnh "${storedName}" trên máy chủ để tránh đầy bộ nhớ!`);
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

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

    try {
      // 1. Upload pending images to server first before saving screen
      const pendingImages = screenImages.filter((img) => img.isPending && img.file);
      if (pendingImages.length > 0) {
        toast.loading(`Đang tải ${pendingImages.length} ảnh lên máy chủ...`, { id: 'uploading-screen-imgs' });
      }

      const urlReplacements: Array<{ tempUrl: string; realUrl: string }> = [];
      const finalImages: ScreenImage[] = [];

      for (const img of screenImages) {
        if (img.isPending && img.file) {
          const formData = new FormData();
          formData.append('image', img.file);
          if (!isNew && id) formData.append('screen_id', id);

          const uploadRes = await filesApi.uploadImage(formData);
          const realUrl = uploadRes.data.url;

          urlReplacements.push({ tempUrl: img.url, realUrl });
          if (img.tempId) {
            urlReplacements.push({ tempUrl: img.tempId, realUrl });
          }

          finalImages.push({
            id: uploadRes.data.id,
            screen_id: !isNew && id ? Number(id) : null,
            original_name: uploadRes.data.originalName || img.original_name,
            stored_name: uploadRes.data.storedName || img.stored_name,
            mime_type: img.mime_type,
            size_bytes: uploadRes.data.sizeBytes || img.size_bytes,
            created_at: new Date().toISOString(),
            url: realUrl,
            isPending: false,
            width: img.width,
            height: img.height,
          });

          // Clean up local blob URL
          if (img.url.startsWith('blob:')) {
            try {
              URL.revokeObjectURL(img.url);
            } catch {}
          }
        } else {
          finalImages.push(img);
        }
      }

      if (pendingImages.length > 0) {
        toast.dismiss('uploading-screen-imgs');
      }

      // 2. Replace any temporary blob/temp URLs in bodyContent with real server URLs
      let finalBodyContent = bodyContent;
      for (const rep of urlReplacements) {
        finalBodyContent = finalBodyContent.split(rep.tempUrl).join(rep.realUrl);
      }

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
        finalBodyContent
      );

      const imageIds = finalImages.map((img) => img.id).filter((imgId) => imgId > 0);

      if (isNew) {
        const res = await docsApi.createScreen({
          moduleId: Number(selectedModuleId),
          title: title.trim(),
          author: author.trim() || 'Author',
          status,
          jira_key: jiraKey.trim() || undefined,
          tags: tagsArray,
          raw_content: fullMarkdownContent,
          image_ids: imageIds
        });
        toast.success('Tạo màn hình đặc tả và lưu ảnh thành công!');
        navigate(`/docs/screen/${res.data.id}`);
      } else if (id) {
        const res = await docsApi.updateScreen(Number(id), {
          moduleId: Number(selectedModuleId),
          title: title.trim(),
          author: author.trim() || 'Author',
          status,
          jira_key: jiraKey.trim() || undefined,
          tags: tagsArray,
          raw_content: fullMarkdownContent,
          image_ids: imageIds
        });
        toast.success('Lưu tài liệu đặc tả và ảnh thành công!');
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
      {/* Hidden file input for importing .md */}
      <input
        type="file"
        ref={mdFileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleImportMdFile(e.target.files[0]);
            e.target.value = '';
          }
        }}
        accept=".md"
        className="hidden"
      />

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
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
          {/* Import .md File Button */}
          <button
            type="button"
            onClick={() => mdFileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary transition shadow-xs"
            title="Nhập nội dung từ file Markdown (.md) có sẵn trên máy"
          >
            <Upload className="w-4 h-4" />
            <span>Import file .md</span>
          </button>

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

      {/* Visual Attached Images Gallery */}
      <ScreenImagesGallery
        images={screenImages}
        onImagesChange={setScreenImages}
        screenId={!isNew && id ? Number(id) : undefined}
        onInsertToMarkdown={(snippet) => {
          setBodyContent((prev) => `${prev.trim()}\n\n${snippet}\n`);
        }}
        onDeleteImage={handleGalleryDeleteImage}
        title="Ảnh đính kèm & Mockup giao diện"
        deferUpload={true}
      />

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
          onUploadImage={handleEditorUploadImage}
          onDeleteImage={handleEditorDeleteImage}
        />
      </div>
    </div>
  );
};
export default ScreenEditorPage;
