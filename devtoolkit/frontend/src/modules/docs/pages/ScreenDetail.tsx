import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FileText, 
  ArrowLeft, 
  ExternalLink, 
  Calendar, 
  User, 
  Tag, 
  Upload, 
  Trash2, 
  Check, 
  Share2,
  Download,
  Copy,
  Layers,
  Sparkles,
  GitBranch,
  Edit2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { docsApi, filesApi, settingsApi } from '../../../services/api';
import { useJiraAuthStore } from '../../../stores/jira-auth.store';
import { MarkdownRenderer } from '../components/MarkdownRenderer';

export const ScreenDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: jiraUser } = useJiraAuthStore();
  const [screen, setScreen] = useState<any>(null);
  const [jiraBaseUrl, setJiraBaseUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteScreen = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await docsApi.deleteScreen(Number(id));
      toast.success('Đã xóa màn hình đặc tả');
      navigate('/docs');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Xóa màn hình thất bại');
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      docsApi.getScreen(Number(id)),
      settingsApi.getAll().catch(() => ({ data: {} as any }))
    ])
      .then(([screenRes, settingsRes]) => {
        setScreen(screenRes.data);
        const jiraConfig = (settingsRes.data as any)?.jira || {};
        const effectiveBaseUrl = jiraUser?.baseUrl || jiraConfig.jira_base_url;
        if (effectiveBaseUrl) {
          setJiraBaseUrl(effectiveBaseUrl.replace(/\/+$/, ''));
        }
        const sections = screenRes.data.parsed_data?.sections || {};
        // Auto-select first non-empty section if overview is missing
        if (!sections.overview && sections.features) {
          setActiveTab('features');
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  const handleImageDrop = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploadingImage(true);
    setUploadedImageUrl(null);
    const formData = new FormData();
    formData.append('image', file);
    formData.append('screen_id', id);

    try {
      const res = await filesApi.uploadImage(formData);
      setUploadedImageUrl(res.data.url);
      navigator.clipboard.writeText(`![${file.name}](${res.data.url})`);
      toast.success('Đã tải ảnh lên và sao chép thẻ Markdown vào clipboard!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Tải ảnh lên thất bại');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyRaw = () => {
    if (!screen?.raw_content) return;
    navigator.clipboard.writeText(screen.raw_content);
    setCopiedRaw(true);
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
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <span>Loading specification document...</span>
      </div>
    );
  }

  if (!screen) {
    return (
      <div className="p-12 text-center space-y-4 max-w-md mx-auto">
        <h3 className="text-lg font-bold text-foreground">Document not found</h3>
        <p className="text-xs text-muted-foreground">The requested handover document may have been deleted or moved.</p>
        <button 
          onClick={() => navigate('/docs')} 
          className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl"
        >
          Return to Handover Docs
        </button>
      </div>
    );
  }

  const parsed = screen.parsed_data || { sections: {}, frontmatter: {} };
  const sections = parsed.sections || {};
  const frontmatter = parsed.frontmatter || {};

  const tabs = [
    { id: 'overview', label: 'Overview', hasContent: Boolean(sections.overview) },
    { id: 'features', label: 'Features & AC', hasContent: Boolean(sections.features) },
    { id: 'rules', label: 'Business Rules', hasContent: Boolean(sections.businessRules) },
    { id: 'api', label: 'API Endpoints', hasContent: Boolean(sections.apiEndpoints) },
    { id: 'db', label: 'Database & ER', hasContent: Boolean(sections.database) },
    { id: 'testing', label: 'QA & Test Cases', hasContent: Boolean(sections.testing) },
    { id: 'config', label: 'Config & Deps', hasContent: Boolean(sections.configuration || sections.dependencies) },
    { id: 'uiux', label: 'UI/UX & States', hasContent: Boolean(sections.uiUx) },
    { id: 'notes', label: 'Notes & Warnings', hasContent: Boolean(sections.notes) },
    { id: 'raw', label: 'Raw Markdown', hasContent: true }
  ];

  const getActiveContent = () => {
    switch (activeTab) {
      case 'overview':
        return sections.overview || '_No overview section documented yet._';
      case 'features':
        return sections.features || '_No features or acceptance criteria documented yet._';
      case 'rules':
        return sections.businessRules || '_No business rules documented yet._';
      case 'api':
        return sections.apiEndpoints || '_No API endpoints specified._';
      case 'db':
        return sections.database || '_No database schema or ER relationships specified._';
      case 'testing':
        return sections.testing || '_No QA test cases or test guidelines documented yet._';
      case 'config':
        return (
          (sections.configuration ? `### Configuration & Environment\n${sections.configuration}\n\n` : '') +
          (sections.dependencies ? `### Dependencies & Third Parties\n${sections.dependencies}` : '') ||
          '_No configuration or package dependencies documented._'
        );
      case 'uiux':
        return sections.uiUx || '_No UI/UX specifications, states or breakpoints documented._';
      case 'notes':
        return sections.notes || '_No special notes, technical debts or warnings recorded._';
      case 'raw':
        return `\`\`\`markdown\n${screen.raw_content}\n\`\`\``;
      default:
        return '';
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Breadcrumb & Navigation Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate('/docs')}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Về Danh Sách Đặc Tả</span><span className="sm:hidden">Quay lại</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {/* Edit Screen in Markdown Editor */}
          <button
            onClick={() => navigate(`/docs/screen/${id}/edit`)}
            className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm"
            title="Chỉnh sửa tài liệu trong Markdown Editor"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Chỉnh sửa</span>
          </button>

          {/* Download .md */}
          <button
            onClick={handleDownloadMd}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-accent text-foreground transition shadow-sm"
            title="Tải về file Markdown sạch"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Export .md</span>
          </button>

          {/* Copy Raw Markdown */}
          <button
            onClick={handleCopyRaw}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-accent text-foreground transition shadow-sm"
            title="Sao chép toàn bộ mã nguồn Markdown"
          >
            {copiedRaw ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
            <span className="hidden sm:inline">{copiedRaw ? 'Đã chép' : 'Copy MD'}</span>
          </button>

          {/* Share Link */}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-accent text-foreground transition shadow-sm"
            title="Sao chép liên kết"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Share2 className="w-3.5 h-3.5 text-muted-foreground" />}
            <span className="hidden sm:inline">{copiedLink ? 'Đã chép' : 'Chia sẻ'}</span>
          </button>

          {/* Delete Screen */}
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition shadow-sm"
            title="Xóa màn hình đặc tả"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Xóa</span>
          </button>
        </div>
      </div>

      {/* Header Info Card */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                screen.status === 'Published' 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              }`}>
                {screen.status}
              </span>

              <span className="text-xs text-muted-foreground">
                in <b className="text-foreground">{screen.module_name}</b>
              </span>

              {frontmatter.version && (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-accent text-muted-foreground font-mono">
                  v{frontmatter.version}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-foreground break-words [overflow-wrap:anywhere] min-w-0">
              {screen.title}
            </h1>
          </div>

          {/* External Links (Jira / Figma) */}
          <div className="flex flex-wrap items-center gap-2 self-start">
            {screen.jira_key && (
              jiraBaseUrl ? (
                <a
                  href={`${jiraBaseUrl}/browse/${screen.jira_key}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded-xl text-xs font-semibold transition border border-blue-500/20"
                >
                  <span>Jira: {screen.jira_key}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <button
                  onClick={() => {
                    toast('Vui lòng cấu hình URL Jira trong Cài đặt để kích hoạt liên kết công việc trực tiếp', { icon: '⚙️' });
                    navigate('/settings');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded-xl text-xs font-semibold transition border border-blue-500/20"
                  title="Cấu hình URL Jira trong Cài đặt"
                >
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
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 rounded-xl text-xs font-semibold transition border border-purple-500/20"
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
            <span>Author: <b className="text-foreground">{screen.author}</b></span>
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Updated: <b className="text-foreground">{new Date(screen.updated_at).toLocaleDateString()}</b></span>
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

      {/* Tabs Navigation (Responsive Horizontal Scroll) */}
      <div className="border-b border-border overflow-x-auto scrollbar-thin pb-px flex gap-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3.5 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <span>{t.label}</span>
            {t.hasContent && t.id !== 'raw' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Section has content" />
            )}
          </button>
        ))}
      </div>

      {/* Active Tab Markdown Content */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-8 shadow-sm min-h-[420px]">
        <MarkdownRenderer content={getActiveContent()} />
      </div>

      {/* Attached Images & Drag-and-Drop Area */}
      <div className="border-2 border-dashed border-border rounded-2xl p-6 text-center bg-muted/10 hover:bg-muted/20 transition-colors">
        <label className="cursor-pointer space-y-2 block">
          <input type="file" accept="image/*" onChange={handleImageDrop} className="hidden" />
          <Upload className="w-6 h-6 mx-auto text-primary" />
          <div className="text-xs font-semibold text-foreground">
            {uploadingImage ? 'Uploading image to local server...' : 'Upload screenshot, UI mockup or ER diagram'}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Saved securely in <span className="font-mono">data_docs_tooldev/images/</span> • Markdown link automatically copied to clipboard
          </p>
        </label>

        {uploadedImageUrl && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-between max-w-lg mx-auto">
            <span className="font-mono truncate">![Screenshot]({uploadedImageUrl})</span>
            <span className="font-bold shrink-0 ml-2">Copied!</span>
          </div>
        )}
      </div>

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
              Bạn có chắc chắn muốn xóa tài liệu đặc tả này? Toàn bộ nội dung markdown và cấu hình liên quan sẽ bị xóa vĩnh viễn khỏi hệ thống.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/80">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl hover:bg-accent text-muted-foreground"
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
