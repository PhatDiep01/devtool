import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FileText, 
  ArrowLeft, 
  ExternalLink, 
  Calendar, 
  User, 
  Tag, 
  Trash2, 
  Check, 
  Share2, 
  Download, 
  Copy, 
  Layers, 
  Sparkles, 
  Edit2,
  List,
  Eye,
  Code,
  ChevronRight,
  Hash,
  Bookmark,
  ArrowUp,
  Image as ImageIcon,
  Folder
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { docsApi, filesApi, settingsApi } from '../../../services/api';
import { Screen, ScreenImage } from '../../../types';
import { useJiraAuthStore } from '../../../stores/jira-auth.store';
import { MarkdownRenderer, slugifyHeading } from '../components/MarkdownRenderer';
import { ScreenImagesGallery } from '../components/ScreenImagesGallery';
import { splitFrontmatterAndBody } from '../../../utils/markdownConverter';
import { usePageTitle } from '../../../utils/usePageTitle';

interface TocItem {
  id: string;
  title: string;
  level: number;
}

function extractToc(markdown: string): TocItem[] {
  if (!markdown) return [];
  const { body } = splitFrontmatterAndBody(markdown);
  const lines = body.split(/\r?\n/);
  const items: TocItem[] = [];

  for (const line of lines) {
    const match = /^(#{1,3})\s+(.+)$/.exec(line);
    if (match) {
      const level = match[1].length;
      const rawTitle = match[2].trim().replace(/\*{1,2}|_{1,2}|`|~~/g, '');
      const id = slugifyHeading(rawTitle);
      items.push({ id, title: rawTitle, level });
    }
  }

  return items;
}

export const ScreenDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: jiraUser } = useJiraAuthStore();
  const [screen, setScreen] = useState<Screen | null>(null);

  usePageTitle(screen?.title ? screen.title : 'Chi tiết Màn hình', [screen?.title]);
  const [jiraBaseUrl, setJiraBaseUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // View Mode: 'rendered' (Full Spec Document) or 'raw' (Markdown Code)
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');
  // Active heading ID for Table of Contents scrollspy
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');
  // Attached Images
  const [screenImages, setScreenImages] = useState<ScreenImage[]>([]);

  // Mobile Table of Contents expanded state
  const [showMobileToc, setShowMobileToc] = useState(false);

  const loadScreenData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [screenRes, settingsRes] = await Promise.all([
        docsApi.getScreen(Number(id)),
        settingsApi.getAll().catch(() => ({ data: {} as any })),
      ]);

      const s = screenRes.data;
      setScreen(s);

      const jiraConfig = (settingsRes.data as any)?.jira || {};
      const effectiveBaseUrl = jiraUser?.baseUrl || jiraConfig.jira_base_url || 'https://task.ascvn.com.vn';
      if (effectiveBaseUrl) {
        setJiraBaseUrl(effectiveBaseUrl.replace(/\/+$/, ''));
      }

      if (Array.isArray(s.images)) {
        setScreenImages(s.images);
      } else {
        const imgRes = await filesApi.getScreenImages(Number(id)).catch(() => ({ data: [] }));
        setScreenImages(imgRes.data || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải thông tin màn hình đặc tả');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScreenData();
  }, [id]);

  // Extract clean body content and Table of Contents
  const { cleanBody, tocItems } = useMemo(() => {
    if (!screen?.raw_content) {
      return { cleanBody: '', tocItems: [] };
    }
    const { body } = splitFrontmatterAndBody(screen.raw_content);
    const toc = extractToc(screen.raw_content);
    return {
      cleanBody: body || screen.raw_content,
      tocItems: toc,
    };
  }, [screen?.raw_content]);

  // Scrollspy observer for headings
  useEffect(() => {
    if (viewMode !== 'rendered' || tocItems.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveHeadingId(entry.target.id);
            break;
          }
        }
      },
      {
        rootMargin: '-80px 0px -70% 0px',
        threshold: 0.1,
      }
    );

    tocItems.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [viewMode, tocItems]);

  const scrollToHeading = (headingId: string) => {
    const el = document.getElementById(headingId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveHeadingId(headingId);
      setShowMobileToc(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteScreen = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await docsApi.deleteScreen(Number(id));
      toast.success('Đã xóa màn hình đặc tả thành công');
      navigate('/docs');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Xóa màn hình thất bại');
      setDeleting(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    toast.success('Đã sao chép liên kết vào clipboard!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyRaw = () => {
    if (!screen?.raw_content) return;
    navigator.clipboard.writeText(screen.raw_content);
    setCopiedRaw(true);
    toast.success('Đã sao chép toàn bộ mã nguồn Markdown!');
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const handleDownloadMd = () => {
    if (!screen) return;
    const blob = new Blob([screen.raw_content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${screen.slug || 'handover-doc'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Đã tải xuống file .md thành công!');
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center min-h-[450px]">
        <div className="w-9 h-9 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <span className="font-medium">Đang tải tài liệu đặc tả nghiệp vụ...</span>
      </div>
    );
  }

  if (!screen) {
    return (
      <div className="p-12 text-center space-y-4 max-w-md mx-auto">
        <h3 className="text-lg font-bold text-foreground">Không tìm thấy tài liệu</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Tài liệu đặc tả có thể đã bị xóa hoặc chuyển sang nhóm khác.
        </p>
        <button 
          onClick={() => navigate('/docs')} 
          className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary/90 transition"
        >
          Quay lại danh sách đặc tả
        </button>
      </div>
    );
  }

  const parsed = screen.parsed_data || { sections: {}, frontmatter: {} };
  const frontmatter = parsed.frontmatter || {};

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/docs')}
            className="p-2 rounded-xl border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition shrink-0"
            title="Về danh sách màn hình"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span 
                onClick={() => navigate('/docs')} 
                className="hover:text-primary cursor-pointer transition font-semibold"
              >
                Đặc tả
              </span>
              <span>/</span>
              <span 
                onClick={() => screen.module_slug && navigate(`/docs/${screen.module_slug}`)}
                className="hover:text-primary cursor-pointer transition font-semibold text-primary truncate max-w-[180px]"
              >
                {screen.module_name || 'Nhóm'}
              </span>
            </div>
            <h1 className="text-base sm:text-xl font-extrabold text-foreground truncate max-w-xl">
              {screen.title}
            </h1>
          </div>
        </div>

        {/* View Switcher & Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap self-start sm:self-auto shrink-0">
          {/* View Mode Toggle: Document Spec vs Raw Markdown */}
          <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setViewMode('rendered')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'rendered'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Đọc tài liệu định dạng trực quan"
            >
              <Eye className="w-3.5 h-3.5 text-primary" />
              <span>Đặc tả</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'raw'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Xem mã nguồn Markdown nguyên bản"
            >
              <Code className="w-3.5 h-3.5" />
              <span>Markdown</span>
            </button>
          </div>

          {/* Edit Screen Button */}
          <button
            onClick={() => navigate(`/docs/screen/${id}/edit`)}
            className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs"
            title="Chỉnh sửa tài liệu trong Markdown Editor"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Chỉnh sửa</span>
          </button>

          {/* Export .md */}
          <button
            onClick={handleDownloadMd}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-border bg-card hover:bg-accent text-foreground transition shadow-xs"
            title="Tải về file Markdown (.md)"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="hidden md:inline">Tải .md</span>
          </button>

          {/* Copy Raw Markdown */}
          <button
            onClick={handleCopyRaw}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-border bg-card hover:bg-accent text-foreground transition shadow-xs"
            title="Sao chép toàn bộ mã nguồn Markdown"
          >
            {copiedRaw ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
            <span className="hidden md:inline">{copiedRaw ? 'Đã chép' : 'Copy MD'}</span>
          </button>

          {/* Share Link */}
          <button
            onClick={handleCopyLink}
            className="p-2 rounded-xl border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition shadow-xs"
            title="Sao chép liên kết tài liệu"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
          </button>

          {/* Delete Screen */}
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2 rounded-xl border border-border bg-card hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition shadow-xs"
            title="Xóa màn hình đặc tả"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Metadata Overview Card */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Badge */}
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                screen.status === 'Published' 
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                  : screen.status === 'In Review'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  : 'bg-muted text-muted-foreground border border-border'
              }`}>
                {screen.status || 'Draft'}
              </span>

              {/* Module Badge */}
              <button
                type="button"
                onClick={() => screen.module_slug && navigate(`/docs/${screen.module_slug}`)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-0.5 rounded-full bg-muted/60 hover:bg-muted border border-border/80 transition"
              >
                <span>{screen.module_icon || '📁'}</span>
                <span className="font-semibold">{screen.module_name}</span>
              </button>

              {frontmatter.version && (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-accent text-muted-foreground font-mono font-medium">
                  v{frontmatter.version}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-foreground break-words min-w-0">
              {screen.title}
            </h1>
          </div>

          {/* External Integration Links (Jira / Figma) */}
          <div className="flex flex-wrap items-center gap-2 self-start shrink-0">
            {screen.jira_key && (
              jiraBaseUrl ? (
                <a
                  href={`${jiraBaseUrl}/browse/${screen.jira_key}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded-xl text-xs font-semibold transition border border-blue-500/20 shadow-xs"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Jira: {screen.jira_key}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <button
                  onClick={() => {
                    toast('Vui lòng cấu hình URL Jira trong Cài đặt để kích hoạt liên kết công việc trực tiếp', { icon: '⚙️' });
                    navigate('/settings');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded-xl text-xs font-semibold transition border border-blue-500/20 shadow-xs"
                  title="Cấu hình URL Jira trong Cài đặt"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Jira: {screen.jira_key}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )
            )}

            {frontmatter.figma && (
              <a
                href={frontmatter.figma}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 rounded-xl text-xs font-semibold transition border border-purple-500/20 shadow-xs"
              >
                <span>Figma Spec</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Metadata Details */}
        <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-muted-foreground pt-3 border-t border-border/50">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Tác giả: <b className="text-foreground">{screen.author}</b></span>
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Cập nhật: <b className="text-foreground">{new Date(screen.updated_at).toLocaleDateString()}</b></span>
          </div>

          {screen.tags && screen.tags.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-muted-foreground" />
              <div className="flex flex-wrap gap-1">
                {screen.tags.map((t: string) => (
                  <span key={t} className="px-2 py-0.5 bg-muted rounded-md text-[11px] font-mono text-foreground">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Visual Attached Screenshots & Mockups Gallery */}
      <ScreenImagesGallery
        images={screenImages}
        onImagesChange={setScreenImages}
        screenId={Number(id)}
        readOnly={false}
        title="Giao diện & Ảnh đính kèm (Screenshots & Mockups)"
      />

      {/* Document Content View */}
      {viewMode === 'rendered' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Continuous Document Body */}
          <div className="lg:col-span-9 bg-card border border-border rounded-2xl p-5 sm:p-8 md:p-10 shadow-sm min-h-[500px]">
            {/* Mobile Table of Contents Quick Toggle */}
            {tocItems.length > 1 && (
              <div className="lg:hidden mb-6 pb-4 border-b border-border/70">
                <button
                  type="button"
                  onClick={() => setShowMobileToc(!showMobileToc)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-muted/60 hover:bg-muted text-xs font-bold text-foreground transition border border-border/80"
                >
                  <span className="flex items-center gap-2">
                    <List className="w-4 h-4 text-primary" />
                    <span>Mục lục điều hướng nhanh ({tocItems.length} mục)</span>
                  </span>
                  <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${showMobileToc ? 'rotate-90' : ''}`} />
                </button>

                {showMobileToc && (
                  <div className="mt-2 p-3 bg-muted/30 border border-border rounded-xl space-y-1 animate-in fade-in">
                    {tocItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => scrollToHeading(item.id)}
                        className={`w-full text-left text-xs py-1.5 px-2 rounded-lg transition truncate ${
                          activeHeadingId === item.id
                            ? 'bg-primary text-primary-foreground font-bold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        }`}
                        style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Rendered Full Markdown */}
            <MarkdownRenderer content={cleanBody} />
          </div>

          {/* Sticky Table of Contents on Desktop */}
          <div className="hidden lg:block lg:col-span-3 sticky top-20 space-y-4">
            <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-thin">
              <div className="flex items-center justify-between pb-2 border-b border-border/70">
                <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <List className="w-3.5 h-3.5 text-primary" />
                  <span>MỤC LỤC TÀI LIỆU</span>
                </span>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {tocItems.length} mục
                </span>
              </div>

              {tocItems.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Chưa có tiêu đề các mục (H2, H3) trong văn bản.
                </p>
              ) : (
                <nav className="space-y-1">
                  {tocItems.map((item) => {
                    const isActive = activeHeadingId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => scrollToHeading(item.id)}
                        className={`w-full text-left text-xs py-1.5 px-2.5 rounded-xl transition-all flex items-center gap-1.5 truncate ${
                          isActive
                            ? 'bg-primary/10 text-primary font-bold border-l-2 border-primary pl-2'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                        }`}
                        style={{
                          paddingLeft: item.level === 3 ? '1.25rem' : '0.625rem',
                        }}
                        title={item.title}
                      >
                        <span className="text-[10px] opacity-40 shrink-0">#</span>
                        <span className="truncate">{item.title}</span>
                      </button>
                    );
                  })}
                </nav>
              )}

              <div className="pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={scrollToTop}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                  <span>Lên đầu trang</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Raw Markdown View Mode */
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900 border-b border-neutral-800 text-xs text-neutral-400">
            <span className="font-mono text-neutral-300 font-semibold">
              {screen.slug || 'handover-doc'}.md
            </span>
            <button
              onClick={handleCopyRaw}
              className="flex items-center gap-1.5 hover:text-white transition px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
            >
              {copiedRaw ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedRaw ? 'Đã sao chép' : 'Sao chép Markdown'}</span>
            </button>
          </div>
          <pre className="p-4 sm:p-6 overflow-x-auto text-xs font-mono text-neutral-200 leading-relaxed max-h-[700px] scrollbar-thin whitespace-pre-wrap select-text">
            {screen.raw_content}
          </pre>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center gap-3 text-destructive">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Xóa Màn Hình Đặc Tả
                </h3>
                <p className="text-xs text-muted-foreground truncate max-w-[260px]">
                  {screen.title}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Bạn có chắc chắn muốn xóa tài liệu đặc tả này? Toàn bộ nội dung markdown và các hình ảnh đính kèm sẽ bị xóa vĩnh viễn khỏi hệ thống.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/80">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl hover:bg-accent text-muted-foreground transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteScreen}
                disabled={deleting}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition shadow-sm disabled:opacity-50"
              >
                {deleting ? 'Đang xóa...' : 'Xác Nhận Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ScreenDetail;
