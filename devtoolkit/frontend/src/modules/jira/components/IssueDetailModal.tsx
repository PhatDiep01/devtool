import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  X, 
  Clock, 
  Calendar, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Tag, 
  MessageSquare, 
  GitBranch, 
  Plus, 
  ChevronRight, 
  ChevronDown,
  ChevronsUpDown,
  ChevronsDownUp,
  Check, 
  ArrowRight,
  Copy,
  RefreshCw,
  Image as ImageIcon,
  Paperclip,
  Download,
  FileSpreadsheet,
  FileText,
  File as FileIcon,
  ZoomIn,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { jiraApi, resolveApiUrl } from '../../../services/api';
import { useJiraAuthStore } from '../../../stores/jira-auth.store';
import { JiraIssue } from '../../../types';
import { LogWorkModal } from './LogWorkModal';
import { CreateIssueModal } from './CreateIssueModal';
import { toast } from 'react-hot-toast';

interface IssueDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  issueKey: string;
  onIssueUpdated?: () => void;
}

// Convert ADF node (Jira Cloud) to Markdown with image proxy mapping
function renderAdfToMarkdown(node: any, attachments: any[] = [], token?: string | null): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.text) return node.text;
  if (node.type === 'hardBreak') return '\n';

  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';

  if (node.type === 'media' && node.attrs?.id) {
    const att = attachments.find(a => a.id === node.attrs.id || a.filename === node.attrs.id);
    const src = resolveApiUrl(att
      ? `/api/jira/attachments/${att.id}/${encodeURIComponent(att.filename)}${tokenParam}`
      : `/api/jira/attachments/${node.attrs.id}/image.png${tokenParam}`);
    return `\n\n![${att?.filename || 'Attachment'}](${src})\n\n`;
  }

  if (Array.isArray(node.content)) {
    const inner = node.content.map((c: any) => renderAdfToMarkdown(c, attachments, token)).join('');
    if (node.type === 'paragraph') return inner + '\n\n';
    if (node.type === 'heading') return `\n\n${'#'.repeat(node.attrs?.level || 2)} ${inner}\n\n`;
    if (node.type === 'bulletList') return inner;
    if (node.type === 'listItem') return `* ${inner.trim()}\n`;
    if (node.type === 'codeBlock') return `\n\`\`\`${node.attrs?.language || ''}\n${inner}\n\`\`\`\n\n`;
    return inner;
  }
  return '';
}

const renderAdfToText = renderAdfToMarkdown;

// Convert Jira Server Wiki Markup to Markdown with image proxy URLs
function convertJiraWikiToMarkdown(text: string, attachments: any[] = [], token?: string | null): string {
  if (!text) return '';
  let md = text;
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';

  // 1. Replace inline Jira attachments/images: !filename.png|options! or !filename.png! or !attachmentId!
  md = md.replace(/!([^!|\r\n]+)(?:\|([^!\r\n]+))?!/g, (match, rawName) => {
    const cleanName = rawName.trim();
    // Match in attachments list
    const att = attachments.find(
      (a) => a.filename === cleanName || a.id === cleanName || cleanName.includes(a.filename) || (a.filename && a.filename.includes(cleanName))
    );
    if (att) {
      const imgUrl = resolveApiUrl(`/api/jira/attachments/${att.id}/${encodeURIComponent(att.filename)}${tokenParam}`);
      return `\n\n![${att.filename}](${imgUrl})\n\n`;
    }
    const isId = /^\d+$/.test(cleanName);
    if (isId) {
      return `\n\n![Attachment](${resolveApiUrl(`/api/jira/attachments/${cleanName}/image.png${tokenParam}`)})\n\n`;
    }
    return `\n\n![${cleanName}](${resolveApiUrl(`/api/jira/attachments/file/${encodeURIComponent(cleanName)}${tokenParam}`)})\n\n`;
  });

  // 2. Jira Headings: h1. -> # , h2. -> ## , etc.
  md = md.replace(/^(h[1-6])\.\s*(.+)$/gm, (_, level, title) => {
    const count = parseInt(level[1], 10);
    return `${'#'.repeat(count)} ${title}`;
  });

  // 3. Jira Bold: {*}text{*} or *text*
  md = md.replace(/\{\*\}(.*?)\{\*\}/g, '**$1**');
  // Bold with single asterisk, avoiding list items (not at start of line)
  md = md.replace(/(^|[^*_~+\s])\*([^*\r\n]+)\*([^*_~+\s]|$)/g, '$1**$2**$3');

  // 4. Jira Italic: _text_
  md = md.replace(/(^|[\s(])_([^\r\n_]+)_([\s).,!?:;]|$)/g, '$1*$2*$3');

  // 5. Jira Monospace: {{text}}
  md = md.replace(/\{\{([^\r\n}]+)\}\}/g, '`$1`');

  // 6. Jira Code blocks: {code:lang} ... {code} or {noformat} ... {noformat}
  md = md.replace(/\{code(?::([a-zA-Z0-9_-]+))?\}([\s\S]*?)\{code\}/g, (_, lang, code) => {
    return `\n\`\`\`${lang || ''}\n${code.trim()}\n\`\`\`\n`;
  });
  md = md.replace(/\{noformat\}([\s\S]*?)\{noformat\}/g, (_, code) => {
    return `\n\`\`\`\n${code.trim()}\n\`\`\`\n`;
  });

  // 7. Jira Links: [Text|URL] -> [Text](URL) and [URL] -> [URL](URL)
  md = md.replace(/\[([^|\]\r\n]+)\|([^\]\r\n]+)\]/g, '[$1]($2)');
  md = md.replace(/\[(https?:\/\/[^\]\r\n]+)\]/g, '[$1]($1)');

  // 8. Jira Tables:
  // Convert Jira table syntax ||heading 1||heading 2|| to markdown
  md = md.replace(/^[ \t]*\|\|(.+)\|\|[ \t]*$/gm, (match, content) => {
    const headers = content.split('||').map((h: string) => h.trim());
    const headerRow = `| ${headers.join(' | ')} |`;
    const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
    return `${headerRow}\n${separatorRow}`;
  });

  // Convert table cells: |cell 1|cell 2|
  md = md.replace(/^[ \t]*\|(?!\|)(.+)\|[ \t]*$/gm, (match, content) => {
    const cells = content.split('|').map((c: string) => c.trim());
    return `| ${cells.join(' | ')} |`;
  });

  // 9. Jira Blockquote: bq. text
  md = md.replace(/^bq\.\s*(.+)$/gm, '> $1');

  return md;
}

// Format bytes helper
function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  isOpen,
  onClose,
  issueKey: initialKey,
  onIssueUpdated
}) => {
  const { user, token } = useJiraAuthStore();
  const activeToken = token || (typeof window !== 'undefined' ? (localStorage.getItem('jira_session_token') || sessionStorage.getItem('jira_session_token') || '') : '');
  const [currentKey, setCurrentKey] = useState(initialKey);
  const [issue, setIssue] = useState<JiraIssue | null>(null);
  const [transitions, setTransitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'worklogs'>('details');

  // Transitions custom dropdown
  const [showTransitionMenu, setShowTransitionMenu] = useState(false);
  const transitionRef = useRef<HTMLDivElement>(null);

  // Subtasks collapse toggle
  const [isSubtasksCollapsed, setIsSubtasksCollapsed] = useState(false);

  // Zoom / Fullscreen modal expand toggle
  const [isExpanded, setIsExpanded] = useState(false);

  // Image Lightbox preview
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // New comment input
  const [commentText, setCommentText] = useState('');
  const [commenting, setCommenting] = useState(false);

  // Sub-modals
  const [showLogWork, setShowLogWork] = useState(false);
  const [showCreateSubtask, setShowCreateSubtask] = useState(false);

  // Close transition menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (transitionRef.current && !transitionRef.current.contains(event.target as Node)) {
        setShowTransitionMenu(false);
      }
    };
    if (showTransitionMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTransitionMenu]);

  useEffect(() => {
    if (isOpen && initialKey) {
      setCurrentKey(initialKey);
      loadIssue(initialKey);
    }
  }, [isOpen, initialKey]);

  const loadIssue = async (key: string) => {
    setLoading(true);
    setShowTransitionMenu(false);
    try {
      const [issueRes, transRes] = await Promise.all([
        jiraApi.getIssue(key),
        jiraApi.getTransitions(key).catch(() => ({ data: [] }))
      ]);
      setIssue(issueRes.data);
      setTransitions(transRes.data || []);
    } catch (err: any) {
      toast.error(`Không thể tải thông tin công việc ${key}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTransition = async (transitionId: string, transitionName: string) => {
    setTransitioning(true);
    try {
      await jiraApi.transitionIssue(currentKey, transitionId);
      toast.success(`Đã chuyển trạng thái ${currentKey} sang "${transitionName}"`);
      await loadIssue(currentKey);
      onIssueUpdated?.();
    } catch (err: any) {
      toast.error(`Chuyển trạng thái thất bại: ${err.message || 'Lỗi không xác định'}`);
    } finally {
      setTransitioning(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setCommenting(true);
    try {
      await jiraApi.addComment(currentKey, commentText.trim());
      toast.success('Đã thêm bình luận thành công!');
      setCommentText('');
      await loadIssue(currentKey);
    } catch (err: any) {
      toast.error('Không thể đăng bình luận');
    } finally {
      setCommenting(false);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(currentKey);
    toast.success(`Đã sao chép mã ${currentKey}!`);
  };

  if (!isOpen) return null;

  const jiraBaseUrl = user?.baseUrl?.replace(/\/+$/, '') || '';
  const jiraBrowseUrl = jiraBaseUrl ? `${jiraBaseUrl}/browse/${currentKey}` : null;

  const subtasks = issue?.fields?.subtasks || [];
  const completedSubtasks = subtasks.filter(
    (st) => st.fields.status?.statusCategory?.key === 'done'
  ).length;
  const subtasksPercent = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;

  const commentsList = issue?.fields?.comment?.comments || [];
  const worklogsList = issue?.fields?.worklog?.worklogs || [];
  const attachments = issue?.fields?.attachment || [];
  const imageAttachments = attachments.filter((a) => a.mimeType?.startsWith('image/'));
  const docAttachments = attachments.filter((a) => !a.mimeType?.startsWith('image/'));

  return (
    <>
      <div className={`fixed inset-0 z-50 flex items-center justify-center ${isExpanded ? 'p-1 sm:p-2 md:p-3' : 'p-3 sm:p-4 md:p-6'} bg-background/80 backdrop-blur-sm animate-in fade-in duration-200`}>
        <div className={`bg-card border border-border shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ${
          isExpanded 
            ? 'w-[99vw] h-[97vh] max-h-[97vh] max-w-none rounded-2xl' 
            : 'w-full max-w-4xl max-h-[92dvh] rounded-3xl'
        }`}>
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-border bg-muted/30 flex items-start justify-between gap-3 shrink-0">
            <div className="space-y-1.5 min-w-0 flex-1">
              {/* Type, Key, Parent breadcrumb */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {issue?.fields?.parent && (
                  <button
                    type="button"
                    onClick={() => {
                      const pKey = issue.fields.parent!.key;
                      setCurrentKey(pKey);
                      loadIssue(pKey);
                    }}
                    className="inline-flex items-center gap-1 font-mono text-blue-600 dark:text-blue-400 hover:underline bg-blue-500/10 px-2 py-0.5 rounded-md"
                    title={`Open Parent: ${issue.fields.parent.fields?.summary || ''}`}
                  >
                    <GitBranch className="w-3 h-3" />
                    <span>{issue.fields.parent.key}</span>
                  </button>
                )}

                {issue?.fields?.parent && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}

                {issue?.fields?.issuetype?.iconUrl && (
                  <img src={issue.fields.issuetype.iconUrl} alt="" className="w-4 h-4 rounded shrink-0" />
                )}
                
                <span className="font-semibold text-muted-foreground">
                  {issue?.fields?.issuetype?.name || 'Issue'}
                </span>

                <span className="font-mono font-bold text-foreground bg-accent px-2 py-0.5 rounded-md">
                  {currentKey}
                </span>

                <button
                  type="button"
                  onClick={copyKey}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition"
                  title="Copy Issue Key"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>

                {jiraBrowseUrl && (
                  <a
                    href={jiraBrowseUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition inline-flex items-center gap-1"
                    title="Open in Jira Cloud"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Summary */}
              <h2 className="text-base sm:text-lg font-bold text-foreground leading-snug break-words [overflow-wrap:anywhere] min-w-0">
                {issue?.fields?.summary || (loading ? 'Loading issue...' : currentKey)}
              </h2>
            </div>

            {/* Actions: Transition dropdown & Close */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Transitions Dropdown */}
              {transitions.length > 0 && (
                <div className="relative" ref={transitionRef}>
                  <button
                    type="button"
                    disabled={transitioning}
                    onClick={() => setShowTransitionMenu((prev) => !prev)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer transition shadow-sm flex items-center gap-1.5 focus:outline-none disabled:opacity-50"
                  >
                    {transitioning ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        <span>Đang chuyển...</span>
                      </>
                    ) : (
                      <>
                        <span>Transition</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showTransitionMenu ? 'rotate-180' : ''}`} />
                      </>
                    )}
                  </button>

                  {showTransitionMenu && (
                    <div className="absolute right-0 top-full mt-1.5 w-52 sm:w-60 bg-card border border-border rounded-2xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/60 flex items-center justify-between">
                        <span>Chuyển trạng thái</span>
                        <span className="font-mono text-[9px] bg-accent px-1.5 py-0.5 rounded text-muted-foreground">
                          {transitions.length} trạng thái
                        </span>
                      </div>
                      <div className="max-h-60 overflow-y-auto p-1 space-y-0.5">
                        {transitions.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            disabled={transitioning}
                            onClick={() => {
                              setShowTransitionMenu(false);
                              handleTransition(t.id, t.name);
                            }}
                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-accent text-foreground hover:text-primary transition flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/70 shrink-0" />
                              <span className="truncate">{t.name}</span>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Zoom / Fullscreen Button */}
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition"
                title={isExpanded ? 'Thu nhỏ popup' : 'Phóng to popup'}
              >
                {isExpanded ? (
                  <Minimize2 className="w-5 h-5 text-primary" />
                ) : (
                  <Maximize2 className="w-5 h-5" />
                )}
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition"
                title="Đóng popup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Info Bar */}
          <div className="px-4 sm:px-6 py-3 border-b border-border bg-card flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex flex-wrap items-center gap-4">
              {/* Status */}
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Status:</span>
                <span className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                  issue?.fields?.status?.statusCategory?.key === 'done'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                    : issue?.fields?.status?.statusCategory?.key === 'indeterminate'
                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}>
                  {issue?.fields?.status?.name || 'Unknown'}
                </span>
              </div>

              {/* Priority */}
              {issue?.fields?.priority && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Priority:</span>
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    {issue.fields.priority.iconUrl && (
                      <img src={issue.fields.priority.iconUrl} alt="" className="w-3.5 h-3.5" />
                    )}
                    <span>{issue.fields.priority.name}</span>
                  </span>
                </div>
              )}

              {/* Assignee */}
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Assignee:</span>
                {issue?.fields?.assignee ? (
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    {issue.fields.assignee.avatarUrls?.['24x24'] ? (
                      <img
                        src={issue.fields.assignee.avatarUrls['24x24']}
                        alt=""
                        className="w-4 h-4 rounded-full"
                      />
                    ) : (
                      <User className="w-3.5 h-3.5" />
                    )}
                    <span>{issue.fields.assignee.displayName}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground italic">Unassigned</span>
                )}
              </div>

              {/* Reporter */}
              {issue?.fields?.reporter && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Reporter:</span>
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    {issue.fields.reporter.avatarUrls?.['24x24'] ? (
                      <img
                        src={issue.fields.reporter.avatarUrls['24x24']}
                        alt=""
                        className="w-4 h-4 rounded-full"
                      />
                    ) : (
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <span>{issue.fields.reporter.displayName}</span>
                  </div>
                </div>
              )}

              {/* Time Spent */}
              {(issue?.fields?.timetracking?.timeSpent || issue?.fields?.timespent) && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Logged:</span>
                  <span className="font-bold text-foreground">
                    {issue.fields.timetracking?.timeSpent || `${Math.round((issue.fields.timespent || 0) / 3600)}h`}
                  </span>
                </div>
              )}

              {/* Remaining Estimate */}
              {(issue?.fields?.timetracking?.remainingEstimate || issue?.fields?.timeestimate) && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Remaining:</span>
                  <span className="font-bold text-foreground">
                    {issue.fields.timetracking?.remainingEstimate || `${Math.round((issue.fields.timeestimate || 0) / 3600)}h`}
                  </span>
                </div>
              )}

              {/* Story Points */}
              {(issue?.fields?.customfield_10016 ?? issue?.fields?.customfield_10026 ?? issue?.fields?.storyPoints) !== undefined && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Points:</span>
                  <span className="font-mono font-bold text-foreground">
                    {issue.fields.customfield_10016 ?? issue.fields.customfield_10026 ?? issue.fields.storyPoints} pts
                  </span>
                </div>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowLogWork(true)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600/20 transition flex items-center gap-1"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Log Time</span>
              </button>

              {!issue?.fields?.issuetype?.subtask && (
                <button
                  type="button"
                  onClick={() => setShowCreateSubtask(true)}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-purple-600/10 text-purple-600 dark:text-purple-400 hover:bg-purple-600/20 transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Sub-task</span>
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center px-4 sm:px-6 border-b border-border bg-card shrink-0 gap-4 text-xs font-semibold overflow-x-auto scrollbar-thin flex-nowrap">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`py-3 border-b-2 transition whitespace-nowrap shrink-0 ${
                activeTab === 'details'
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Details & Description
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('comments')}
              className={`py-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'comments'
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Comments ({commentsList.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('worklogs')}
              className={`py-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'worklogs'
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Worklogs ({worklogsList.length})</span>
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {loading ? (
              <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                <span>Loading issue details...</span>
              </div>
            ) : (
              <>
                {/* TAB 1: DETAILS & DESCRIPTION */}
                {activeTab === 'details' && (
                  <div className="space-y-6">
                    {/* Subtasks Progress & Tree (If has subtasks or can have subtasks) */}
                    {!issue?.fields?.issuetype?.subtask && (
                      <div className="bg-muted/30 border border-border rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div 
                            className={`flex items-center gap-2 ${subtasks.length > 0 ? 'cursor-pointer select-none group/title' : ''}`}
                            onClick={() => subtasks.length > 0 && setIsSubtasksCollapsed(!isSubtasksCollapsed)}
                          >
                            {subtasks.length > 0 && (
                              <button
                                type="button"
                                className="p-0.5 -ml-1 rounded text-muted-foreground group-hover/title:text-foreground transition"
                                title={isSubtasksCollapsed ? 'Mở rộng subtasks' : 'Thu gọn subtasks'}
                              >
                                {isSubtasksCollapsed ? (
                                  <ChevronRight className="w-4 h-4 text-purple-500" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-purple-500" />
                                )}
                              </button>
                            )}
                            <GitBranch className="w-4 h-4 text-purple-500" />
                            <span className="font-bold text-xs text-foreground group-hover/title:text-primary transition">
                              Sub-tasks ({completedSubtasks}/{subtasks.length} Completed)
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {subtasks.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setIsSubtasksCollapsed(!isSubtasksCollapsed)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition flex items-center gap-1.5 shadow-2xs"
                                title={isSubtasksCollapsed ? 'Mở rộng danh sách subtask' : 'Thu gọn danh sách subtask'}
                              >
                                {isSubtasksCollapsed ? (
                                  <>
                                    <ChevronsUpDown className="w-3.5 h-3.5 text-primary" />
                                    <span>Mở rộng ({subtasks.length})</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronsDownUp className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span>Thu gọn</span>
                                  </>
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setShowCreateSubtask(true)}
                              className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Sub-task</span>
                            </button>
                          </div>
                        </div>

                        {subtasks.length > 0 ? (
                          <>
                            {/* Progress bar */}
                            <div className="w-full bg-accent h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full transition-all duration-300"
                                style={{ width: `${subtasksPercent}%` }}
                              />
                            </div>

                            {/* Subtasks Collapsed Summary */}
                            {isSubtasksCollapsed ? (
                              <div
                                onClick={() => setIsSubtasksCollapsed(false)}
                                className="p-2.5 rounded-xl bg-card/70 border border-dashed border-border/80 hover:border-primary/50 transition cursor-pointer flex items-center justify-between text-xs text-muted-foreground hover:text-foreground group"
                              >
                                <span className="italic">
                                  Đã thu gọn {subtasks.length} subtask ({completedSubtasks} hoàn thành). Bấm vào đây để mở rộng chi tiết.
                                </span>
                                <span className="text-[11px] font-bold text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition">
                                  Mở rộng <ChevronRight className="w-3.5 h-3.5" />
                                </span>
                              </div>
                            ) : (
                              /* Subtasks Expanded List with max-height scroll */
                              <div className="space-y-1.5 pt-1 max-h-72 overflow-y-auto pr-1">
                                {subtasks.map((st) => (
                                  <div
                                    key={st.key}
                                    onClick={() => {
                                      setCurrentKey(st.key);
                                      loadIssue(st.key);
                                    }}
                                    className="p-2.5 rounded-xl bg-card border border-border/80 hover:border-primary/50 transition cursor-pointer flex items-center justify-between gap-3 text-xs group"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="font-mono font-bold text-foreground group-hover:text-primary transition shrink-0">
                                        {st.key}
                                      </span>
                                      <span className="text-muted-foreground truncate">
                                        {st.fields.summary}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                        st.fields.status?.statusCategory?.key === 'done'
                                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                          : 'bg-muted text-muted-foreground'
                                      }`}>
                                        {st.fields.status?.name}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">No sub-tasks attached yet.</p>
                        )}
                      </div>
                    )}

                    {/* Description Section with Rich Markdown & Inline Images */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-xs text-foreground uppercase tracking-wider text-muted-foreground">
                          Description
                        </h4>
                        {issue?.fields?.description && (
                          <span className="text-[10px] text-muted-foreground">
                            Hỗ trợ hình ảnh & bảng biểu
                          </span>
                        )}
                      </div>

                      <div className="bg-background border border-border rounded-2xl p-4 text-xs sm:text-sm text-foreground leading-relaxed min-h-[120px]">
                        {issue?.fields?.description ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none space-y-3">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                img: ({ src, alt }) => (
                                  <span className="block my-3">
                                    <img
                                      src={src}
                                      alt={alt || 'Image'}
                                      onClick={() => src && setPreviewImage({ url: src, title: alt || 'Image Preview' })}
                                      className="rounded-2xl border border-border/80 shadow-xs hover:border-primary/60 hover:shadow-md transition cursor-zoom-in max-w-full max-h-[600px] object-contain bg-muted/20"
                                      loading="lazy"
                                      onError={(e) => {
                                        const img = e.currentTarget as HTMLImageElement;
                                        if (img.src && img.src.includes('thumbnail=true')) {
                                          img.src = img.src.replace('thumbnail=true', '');
                                        }
                                      }}
                                    />
                                    {alt && (
                                      <span className="block text-[11px] text-muted-foreground mt-1 text-center font-mono italic">
                                        📷 {alt} (bấm vào ảnh để phóng to)
                                      </span>
                                    )}
                                  </span>
                                ),
                                table: ({ children }) => (
                                  <div className="overflow-x-auto my-3 rounded-xl border border-border">
                                    <table className="min-w-full divide-y divide-border text-xs text-left">
                                      {children}
                                    </table>
                                  </div>
                                ),
                                th: ({ children }) => (
                                  <th className="px-3 py-2 bg-muted/50 font-bold text-foreground border-b border-border">
                                    {children}
                                  </th>
                                ),
                                td: ({ children }) => (
                                  <td className="px-3 py-2 border-b border-border/60 text-foreground">
                                    {children}
                                  </td>
                                ),
                                a: ({ href, children }) => (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium break-all"
                                  >
                                    <span>{children}</span>
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                  </a>
                                ),
                                h1: ({ children }) => <h1 className="text-base sm:text-lg font-extrabold text-foreground mt-4 mb-2">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-sm sm:text-base font-bold text-foreground mt-3 mb-1.5">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-xs sm:text-sm font-bold text-foreground mt-2.5 mb-1">{children}</h3>,
                                p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
                                ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 my-2">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 my-2">{children}</ol>,
                              }}
                            >
                              {typeof issue.fields.description === 'string'
                                ? convertJiraWikiToMarkdown(issue.fields.description, attachments, activeToken)
                                : renderAdfToMarkdown(issue.fields.description, attachments, activeToken)}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">No description provided.</span>
                        )}
                      </div>
                    </div>

                    {/* Attachments & Images Section (Moved below Description) */}
                    {attachments.length > 0 && (
                      <div className="space-y-3 bg-muted/20 border border-border rounded-2xl p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Paperclip className="w-4 h-4 text-indigo-500" />
                            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">
                              Tệp đính kèm & Hình ảnh ({attachments.length})
                            </h4>
                          </div>
                          <span className="text-[11px] text-muted-foreground font-medium">
                            {imageAttachments.length} hình ảnh • {docAttachments.length} tài liệu
                          </span>
                        </div>

                        {/* Image Thumbnails Grid */}
                        {imageAttachments.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
                            {imageAttachments.map((att) => {
                              const tokenQuery = activeToken ? `token=${encodeURIComponent(activeToken)}` : '';
                              const downloadUrl = resolveApiUrl(`/api/jira/attachments/${att.id}/${encodeURIComponent(att.filename)}${tokenQuery ? `?${tokenQuery}` : ''}`);
                              const thumbUrl = resolveApiUrl(`/api/jira/attachments/${att.id}/${encodeURIComponent(att.filename)}?thumbnail=true${tokenQuery ? `&${tokenQuery}` : ''}`);

                              return (
                                <div
                                  key={att.id}
                                  onClick={() => setPreviewImage({ url: downloadUrl, title: att.filename })}
                                  className="group relative rounded-xl border border-border bg-card overflow-hidden hover:border-primary transition cursor-pointer shadow-2xs hover:shadow-sm flex flex-col"
                                >
                                  <div className="aspect-video w-full bg-muted/40 relative overflow-hidden flex items-center justify-center">
                                    <img
                                      src={thumbUrl}
                                      alt={att.filename}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                      loading="lazy"
                                      onError={(e) => {
                                        const img = e.currentTarget as HTMLImageElement;
                                        if (img.src !== downloadUrl && !img.dataset.failed) {
                                          img.dataset.failed = '1';
                                          img.src = downloadUrl;
                                        }
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white">
                                      <ZoomIn className="w-4 h-4" />
                                      <span className="text-[10px] font-bold">Xem ảnh</span>
                                    </div>
                                  </div>
                                  <div className="p-2 text-xs flex flex-col justify-between flex-1">
                                    <span className="font-semibold text-foreground truncate text-[11px]" title={att.filename}>
                                      {att.filename}
                                    </span>
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                                      <span>{formatFileSize(att.size)}</span>
                                      <a
                                        href={downloadUrl}
                                        download={att.filename}
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-1 rounded hover:bg-accent hover:text-foreground transition text-muted-foreground"
                                        title="Tải về"
                                      >
                                        <Download className="w-3 h-3" />
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Non-image document attachments */}
                        {docAttachments.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {docAttachments.map((doc) => {
                              const tokenQuery = activeToken ? `token=${encodeURIComponent(activeToken)}` : '';
                              const downloadUrl = resolveApiUrl(`/api/jira/attachments/${doc.id}/${encodeURIComponent(doc.filename)}${tokenQuery ? `?${tokenQuery}` : ''}`);
                              const isSpreadsheet = doc.filename.endsWith('.xlsx') || doc.filename.endsWith('.xls') || doc.filename.endsWith('.csv');
                              const isPdf = doc.filename.endsWith('.pdf');

                              return (
                                <div
                                  key={doc.id}
                                  className="p-2.5 rounded-xl bg-card border border-border/80 hover:border-primary/50 transition flex items-center justify-between gap-3 text-xs"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    {isSpreadsheet ? (
                                      <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                                    ) : isPdf ? (
                                      <FileText className="w-4 h-4 text-red-500 shrink-0" />
                                    ) : (
                                      <FileIcon className="w-4 h-4 text-blue-500 shrink-0" />
                                    )}
                                    <div className="min-w-0">
                                      <span className="font-semibold text-foreground truncate block" title={doc.filename}>
                                        {doc.filename}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground">
                                        {formatFileSize(doc.size)} {doc.author?.displayName ? `• ${doc.author.displayName}` : ''}
                                      </span>
                                    </div>
                                  </div>

                                  <a
                                    href={downloadUrl}
                                    download={doc.filename}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-1 rounded-lg bg-accent/80 hover:bg-accent text-foreground text-xs font-semibold flex items-center gap-1 transition shrink-0"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Tải về</span>
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: COMMENTS */}
                {activeTab === 'comments' && (
                  <div className="space-y-4">
                    {/* New Comment Box */}
                    <form onSubmit={handleAddComment} className="space-y-2.5 bg-muted/20 border border-border p-4 rounded-2xl">
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                        <span>Add Comment</span>
                      </label>
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        rows={3}
                        placeholder="Type a comment or status update..."
                        className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-primary resize-none transition"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={commenting || !commentText.trim()}
                          className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
                        >
                          {commenting ? 'Posting...' : 'Post Comment'}
                        </button>
                      </div>
                    </form>

                    {/* Comments List */}
                    <div className="space-y-3">
                      {commentsList.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic text-center py-6">No comments yet.</p>
                      ) : (
                        commentsList.map((c) => (
                          <div key={c.id} className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-foreground">
                                {c.author?.displayName || 'Unknown Author'}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {new Date(c.created).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-foreground whitespace-pre-wrap leading-relaxed">
                              {renderAdfToText(c.body)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: WORKLOGS */}
                {activeTab === 'worklogs' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">Work Log History</span>
                      <button
                        type="button"
                        onClick={() => setShowLogWork(true)}
                        className="px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-1.5 shadow-sm"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Log Time</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {worklogsList.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic text-center py-8">
                          No work logged on this issue yet.
                        </p>
                      ) : (
                        worklogsList.map((w) => (
                          <div key={w.id} className="p-3.5 rounded-2xl bg-card border border-border flex items-start justify-between gap-3 text-xs">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground">
                                  {w.author?.displayName || 'User'}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  logged on {new Date(w.started).toLocaleDateString()}
                                </span>
                              </div>
                              {w.comment && (
                                <p className="text-muted-foreground whitespace-pre-wrap">
                                  {renderAdfToText(w.comment)}
                                </p>
                              )}
                            </div>
                            <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-bold text-xs shrink-0">
                              {w.timeSpent}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Embedded Log Work Modal */}
      {showLogWork && (
        <LogWorkModal
          isOpen={showLogWork}
          onClose={() => setShowLogWork(false)}
          initialIssueKey={currentKey}
          initialIssueSummary={issue?.fields?.summary}
          onSuccess={() => {
            loadIssue(currentKey);
            onIssueUpdated?.();
          }}
        />
      )}

      {/* Embedded Create Subtask Modal */}
      {showCreateSubtask && (
        <CreateIssueModal
          isOpen={showCreateSubtask}
          onClose={() => setShowCreateSubtask(false)}
          defaultParentKey={currentKey}
          defaultProjectKey={currentKey.split('-')[0]}
          isSubtaskOnly={true}
          onSuccess={() => {
            loadIssue(currentKey);
            onIssueUpdated?.();
          }}
        />
      )}

      {/* Fullscreen Image Preview Lightbox */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex flex-col animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="p-4 flex items-center justify-between text-white shrink-0 bg-gradient-to-b from-black/80 to-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 min-w-0">
              <ImageIcon className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-bold truncate max-w-md">{previewImage.title}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={previewImage.url}
                download
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition flex items-center gap-1.5 text-xs font-semibold"
                title="Tải ảnh về máy"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Tải về</span>
              </a>
              <a
                href={previewImage.url}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition flex items-center gap-1.5 text-xs font-semibold"
                title="Mở tab mới"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">Mở gốc</span>
              </a>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            <img
              src={previewImage.url}
              alt={previewImage.title}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full object-contain rounded-xl shadow-2xl select-none"
            />
          </div>
        </div>
      )}
    </>
  );
};
