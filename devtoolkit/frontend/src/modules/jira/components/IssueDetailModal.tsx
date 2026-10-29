import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  ChevronUp,
  ChevronsUpDown,
  ChevronsDownUp,
  ArrowUpDown,
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
  Minimize2,
  Trash2,
  Edit3
} from 'lucide-react';
import { jiraApi, resolveApiUrl, getJiraProxyImageUrl } from '../../../services/api';
import { useJiraAuthStore } from '../../../stores/jira-auth.store';
import { JiraIssue } from '../../../types';
import { LogWorkModal } from './LogWorkModal';
import { EditWorklogModal, EditableWorklog } from './EditWorklogModal';
import { CreateIssueModal } from './CreateIssueModal';
import { IssueTypeIcon } from './IssueTypeIcon';
import { EditStoryModal } from './EditStoryModal';
import { JiraAvatar } from './JiraAvatar';
import { formatRelativeTime } from '../../../utils/dateUtils';
import { toast } from 'react-hot-toast';
import { ConfirmModal } from '../../../components/ui';

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

// Format subtask logwork time (e.g. 2.5h, 45m, 1d)
function formatSubtaskLoggedTime(fields: any): { text: string; hasTime: boolean } {
  if (!fields) return { text: '0h', hasTime: false };

  // 1. Check formatted string from timetracking.timeSpent
  if (fields.timetracking?.timeSpent && typeof fields.timetracking.timeSpent === 'string') {
    const raw = fields.timetracking.timeSpent.trim();
    if (raw && raw !== '0h' && raw !== '0m') {
      return { text: raw, hasTime: true };
    }
  }

  // 2. Check numeric seconds from timespent or timetracking.timeSpentSeconds
  const seconds = fields.timespent ?? fields.timetracking?.timeSpentSeconds;
  if (typeof seconds === 'number' && seconds > 0) {
    const hours = seconds / 3600;
    if (hours >= 8 && hours % 8 === 0) {
      return { text: `${hours / 8}d`, hasTime: true };
    }
    if (hours >= 1) {
      const rounded = Math.round(hours * 10) / 10;
      return { text: `${rounded}h`, hasTime: true };
    }
    const mins = Math.round(seconds / 60);
    return { text: `${mins}m`, hasTime: true };
  }

  return { text: '0h', hasTime: false };
}

// Clean text snippet for collapsed comment preview
function getCommentSnippet(body: any): string {
  if (!body) return 'Không có nội dung';
  let text = '';
  if (typeof body === 'string') {
    text = body
      .replace(/\{code[\s\S]*?\{code\}/g, '[Mã nguồn]')
      .replace(/\{noformat[\s\S]*?\{noformat\}/g, '[Văn bản]')
      .replace(/!.*?(\||!)/g, '[Hình ảnh]')
      .replace(/\[([^|\]\r\n]+)\|([^\]\r\n]+)\]/g, '$1')
      .replace(/\[(https?:\/\/[^\]\r\n]+)\]/g, '$1')
      .replace(/[#*_{}\[\]|]/g, '')
      .trim();
  } else {
    text = renderAdfToMarkdown(body).replace(/[#*`_~\[\]]/g, '').trim();
  }
  return text.replace(/\s+/g, ' ') || 'Không có nội dung';
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

  // Transitions custom dropdown & Confirmation state
  const [showTransitionMenu, setShowTransitionMenu] = useState(false);
  const transitionRef = useRef<HTMLDivElement>(null);
  const [pendingTransition, setPendingTransition] = useState<{
    key: string;
    id: string;
    name: string;
    summary?: string;
    isSubtask?: boolean;
  } | null>(null);
  const [openSubtaskMenuKey, setOpenSubtaskMenuKey] = useState<string | null>(null);
  const [subtaskTransitionsMap, setSubtaskTransitionsMap] = useState<Record<string, any[]>>({});
  const [loadingSubtaskTransitions, setLoadingSubtaskTransitions] = useState<string | null>(null);

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
  const [editingWorklog, setEditingWorklog] = useState<EditableWorklog | null>(null);
  const [pendingDeleteWorklog, setPendingDeleteWorklog] = useState<{
    id: string;
    timeSpent: string;
    started?: string;
    author?: string;
  } | null>(null);
  const [isDeletingWorklog, setIsDeletingWorklog] = useState(false);
  const [showEditStoryModal, setShowEditStoryModal] = useState(false);
  const [showDeleteStoryConfirm, setShowDeleteStoryConfirm] = useState(false);
  const [isDeletingCurrentIssue, setIsDeletingCurrentIssue] = useState(false);

  const executeDeleteCurrentIssue = async () => {
    setIsDeletingCurrentIssue(true);
    try {
      await jiraApi.deleteIssue(currentKey, { deleteSubtasks: true });
      toast.success(`Đã xóa ${currentKey} thành công!`);
      setShowDeleteStoryConfirm(false);
      onClose();
      onIssueUpdated?.();
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Xóa thất bại';
      toast.error(`Xóa thất bại: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    } finally {
      setIsDeletingCurrentIssue(false);
    }
  };

  // Comments sort order & expanded state
  const [commentSortOrder, setCommentSortOrder] = useState<'desc' | 'asc'>('desc');
  const [expandedCommentIds, setExpandedCommentIds] = useState<Set<string>>(new Set());

  // Close transition menu & subtask menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (transitionRef.current && !transitionRef.current.contains(event.target as Node)) {
        setShowTransitionMenu(false);
      }
      if (openSubtaskMenuKey) {
        const target = event.target as HTMLElement;
        if (!target.closest('.subtask-status-container')) {
          setOpenSubtaskMenuKey(null);
        }
      }
    };
    if (showTransitionMenu || openSubtaskMenuKey) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTransitionMenu, openSubtaskMenuKey]);

  const handleOpenSubtaskTransitions = async (e: React.MouseEvent, subtaskKey: string) => {
    e.stopPropagation();
    if (openSubtaskMenuKey === subtaskKey) {
      setOpenSubtaskMenuKey(null);
      return;
    }
    setOpenSubtaskMenuKey(subtaskKey);
    if (!subtaskTransitionsMap[subtaskKey]) {
      setLoadingSubtaskTransitions(subtaskKey);
      try {
        const res = await jiraApi.getTransitions(subtaskKey);
        setSubtaskTransitionsMap(prev => ({ ...prev, [subtaskKey]: res.data || [] }));
      } catch (err) {
        toast.error(`Không thể lấy danh sách trạng thái của ${subtaskKey}`);
      } finally {
        setLoadingSubtaskTransitions(null);
      }
    }
  };

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
      const issueData = issueRes.data;
      setIssue(issueData);
      setTransitions(transRes.data || []);

      // Client-side auto-enrich subtasks with assignee and timetracking if missing
      const rawSubtasks = issueData?.fields?.subtasks || [];
      const needsEnrich = rawSubtasks.length > 0 && rawSubtasks.some(
        (st: any) => !st.fields?.assignee || st.fields?.timetracking === undefined
      );
      if (needsEnrich) {
        jiraApi.search({ jql: `parent = ${key}`, maxResults: 150 }).then((subRes) => {
          const fetchedIssues: any[] = subRes.data?.issues || (Array.isArray(subRes.data) ? subRes.data : []);
          if (fetchedIssues.length > 0) {
            const map = new Map<string, any>();
            fetchedIssues.forEach((fi) => {
              if (fi.key) {
                map.set(fi.key, {
                  assignee: fi.fields?.assignee || null,
                  timetracking: fi.fields?.timetracking || null,
                  timespent: fi.fields?.timespent || null
                });
              }
            });
            setIssue((prev: any) => {
              if (!prev || prev.key !== key || !prev.fields?.subtasks) return prev;
              const enriched = prev.fields.subtasks.map((st: any) => {
                const info = map.get(st.key);
                return {
                  ...st,
                  fields: {
                    ...st.fields,
                    assignee: info?.assignee !== undefined ? info.assignee : (st.fields?.assignee || null),
                    timetracking: info?.timetracking || st.fields?.timetracking || null,
                    timespent: info?.timespent !== undefined ? info.timespent : (st.fields?.timespent || null)
                  }
                };
              });
              return {
                ...prev,
                fields: {
                  ...prev.fields,
                  subtasks: enriched
                }
              };
            });
          }
        }).catch((err) => {
          console.warn('Could not auto-enrich subtasks with assignee and logwork:', err);
        });
      }
    } catch (err: any) {
      toast.error(`Không thể tải thông tin công việc ${key}`);
    } finally {
      setLoading(false);
    }
  };

  const executeTransition = async (targetKey: string, transitionId: string, transitionName: string) => {
    setTransitioning(true);
    try {
      await jiraApi.transitionIssue(targetKey, transitionId);
      toast.success(`Đã chuyển trạng thái ${targetKey} sang "${transitionName}"`);
      await loadIssue(currentKey);
      onIssueUpdated?.();
    } catch (err: any) {
      toast.error(`Chuyển trạng thái thất bại: ${err.message || 'Lỗi không xác định'}`);
    } finally {
      setTransitioning(false);
      setPendingTransition(null);
    }
  };

  const executeDeleteWorklog = async () => {
    if (!pendingDeleteWorklog) return;
    setIsDeletingWorklog(true);
    try {
      await jiraApi.deleteWorklog(currentKey, pendingDeleteWorklog.id);
      toast.success(`Đã xóa lượt log work (${pendingDeleteWorklog.timeSpent}) thành công!`);
      await loadIssue(currentKey);
      onIssueUpdated?.();
    } catch (err: any) {
      toast.error(`Xóa log work thất bại: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsDeletingWorklog(false);
      setPendingDeleteWorklog(null);
    }
  };

  // Prevent background scroll when modal or lightbox is open
  useEffect(() => {
    if (isOpen || previewImage) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, !!previewImage]);


  const commentsList = issue?.fields?.comment?.comments || [];

  // Sort comments by created date: newest first by default ('desc')
  const sortedComments = React.useMemo(() => {
    return [...commentsList].sort((a, b) => {
      const tA = new Date(a.created).getTime() || 0;
      const tB = new Date(b.created).getTime() || 0;
      return commentSortOrder === 'desc' ? tB - tA : tA - tB;
    });
  }, [commentsList, commentSortOrder]);

  // Keep track of loaded issue to initialize expanded comments
  const lastLoadedIssueRef = useRef<string>('');
  const lastCommentsCountRef = useRef<number>(0);

  useEffect(() => {
    const isNewIssue = lastLoadedIssueRef.current !== currentKey;
    const isNewCount = lastCommentsCountRef.current !== commentsList.length;

    if (isNewIssue || isNewCount) {
      lastLoadedIssueRef.current = currentKey;
      lastCommentsCountRef.current = commentsList.length;

      if (sortedComments.length > 0) {
        setExpandedCommentIds((prev) => {
          const next = new Set<string>();
          if (sortedComments.length <= 2) {
            sortedComments.forEach((c) => next.add(c.id));
          } else {
            // Expand the first (newest) comment by default
            next.add(sortedComments[0].id);
            // If same issue and user had expanded others, keep them
            if (!isNewIssue) {
              prev.forEach((id) => next.add(id));
            }
          }
          return next;
        });
      } else {
        setExpandedCommentIds(new Set());
      }
    }
  }, [currentKey, commentsList.length, sortedComments]);

  const toggleComment = (id: string) => {
    setExpandedCommentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAllComments = () => {
    setExpandedCommentIds(new Set(sortedComments.map((c) => c.id)));
  };

  const collapseAllComments = () => {
    setExpandedCommentIds(new Set());
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setCommenting(true);
    try {
      const res = await jiraApi.addComment(currentKey, commentText.trim());
      toast.success('Đã thêm bình luận thành công!');
      const newCommentId = res?.data?.id ? String(res.data.id) : null;
      setCommentText('');
      await loadIssue(currentKey);
      if (newCommentId) {
        setExpandedCommentIds((prev) => new Set([...prev, newCommentId]));
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Không thể đăng bình luận';
      toast.error(`Không thể đăng bình luận: ${typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg)}`);
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

  const worklogsList = issue?.fields?.worklog?.worklogs || [];
  const attachments = issue?.fields?.attachment || [];
  const imageAttachments = attachments.filter((a) => a.mimeType?.startsWith('image/'));
  const docAttachments = attachments.filter((a) => !a.mimeType?.startsWith('image/'));

  return typeof document !== 'undefined' ? createPortal(
    <>
      <div 
        className={`fixed inset-0 z-[70] flex items-center justify-center ${isExpanded ? 'p-1 sm:p-2 md:p-3' : 'p-3 sm:p-4 md:p-6'} bg-background/80 backdrop-blur-sm animate-in fade-in duration-200`}
      >
        <div 
          className={`bg-card border border-border shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ${
            isExpanded 
              ? 'w-[99vw] h-[97vh] max-h-[97vh] max-w-none rounded-2xl' 
              : 'w-full max-w-4xl max-h-[92dvh] rounded-3xl'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
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

                <IssueTypeIcon type={issue?.fields?.issuetype} className="w-4 h-4" />
                
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
                              setPendingTransition({
                                key: currentKey,
                                id: t.id,
                                name: t.name,
                                summary: issue?.fields?.summary,
                                isSubtask: Boolean(issue?.fields?.issuetype?.subtask)
                              });
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

              {/* Edit Issue Button */}
              {issue && (
                <button
                  type="button"
                  onClick={() => setShowEditStoryModal(true)}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition"
                  title="Chỉnh sửa thông tin"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
              )}

              {/* Delete Issue Button */}
              {issue && (
                <button
                  type="button"
                  onClick={() => setShowDeleteStoryConfirm(true)}
                  className="p-2 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                  title="Xóa Story / Issue này"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
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
                      <img 
                        src={getJiraProxyImageUrl(issue.fields.priority.iconUrl)} 
                        alt="" 
                        className="w-3.5 h-3.5 object-contain" 
                        onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                      />
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
                    <JiraAvatar 
                      avatarUrl={issue.fields.assignee.avatarUrls?.['24x24'] || issue.fields.assignee.avatarUrls?.['32x32']} 
                      displayName={issue.fields.assignee.displayName}
                      className="w-5 h-5"
                      sizeText="text-[9px]"
                    />
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
                    <JiraAvatar 
                      avatarUrl={issue.fields.reporter.avatarUrls?.['24x24'] || issue.fields.reporter.avatarUrls?.['32x32']} 
                      displayName={issue.fields.reporter.displayName}
                      className="w-5 h-5"
                      sizeText="text-[9px]"
                    />
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
                                    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                                      {/* Assignee Avatar & Name */}
                                      {st.fields.assignee ? (
                                        <div 
                                          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/70 border border-border/70 text-foreground font-medium text-[11px]"
                                          title={`Người thực hiện: ${st.fields.assignee.displayName}`}
                                        >
                                          <JiraAvatar 
                                            avatarUrl={st.fields.assignee.avatarUrls?.['24x24'] || st.fields.assignee.avatarUrls?.['32x32'] || (st.fields.assignee as any).avatarUrl}
                                            displayName={st.fields.assignee.displayName}
                                            className="w-4 h-4"
                                            sizeText="text-[8px]"
                                          />
                                          <span className="truncate max-w-[120px] hidden sm:inline">
                                            {st.fields.assignee.displayName}
                                          </span>
                                        </div>
                                      ) : (
                                        <span 
                                          className="text-[11px] text-muted-foreground/60 italic px-1 hidden sm:inline"
                                          title="Chưa gán người thực hiện"
                                        >
                                          Chưa gán
                                        </span>
                                      )}

                                      {/* Logwork Time Spent (Right next to status) */}
                                      {(() => {
                                        const logInfo = formatSubtaskLoggedTime(st.fields);
                                        return (
                                          <span
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-mono tabular-nums transition shrink-0 ${
                                              logInfo.hasTime
                                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 font-semibold'
                                                : 'text-muted-foreground/50 border border-border/40 bg-muted/20 font-normal'
                                            }`}
                                            title={logInfo.hasTime ? `Thời gian đã log: ${logInfo.text}` : 'Chưa có thời gian logwork'}
                                          >
                                            <Clock className={`w-3 h-3 shrink-0 ${logInfo.hasTime ? 'text-blue-500 dark:text-blue-400' : 'text-muted-foreground/40'}`} />
                                            <span>{logInfo.text}</span>
                                          </span>
                                        );
                                      })()}

                                      {/* Status badge with interactive transition dropdown */}
                                      <div className="relative shrink-0 subtask-status-container">
                                        <button
                                          type="button"
                                          onClick={(e) => handleOpenSubtaskTransitions(e, st.key)}
                                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 transition border hover:brightness-105 active:scale-95 cursor-pointer ${
                                            st.fields.status?.statusCategory?.key === 'done'
                                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                                              : 'bg-muted text-muted-foreground border-border/60 hover:bg-accent hover:text-foreground'
                                          }`}
                                          title="Bấm để đổi trạng thái sub-task"
                                        >
                                          <span>{st.fields.status?.name}</span>
                                          <ChevronDown className={`w-2.5 h-2.5 transition-transform duration-150 ${openSubtaskMenuKey === st.key ? 'rotate-180' : ''}`} />
                                        </button>

                                        {openSubtaskMenuKey === st.key && (
                                          <div 
                                            className="absolute right-0 top-full mt-1 w-44 bg-popover/95 backdrop-blur-md border border-border/80 rounded-xl shadow-xl z-50 p-1 animate-in fade-in zoom-in-95 duration-100"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50 mb-1 flex items-center justify-between">
                                              <span>Chuyển trạng thái</span>
                                              <span className="font-mono text-[9px] text-muted-foreground">{st.key}</span>
                                            </div>
                                            {loadingSubtaskTransitions === st.key ? (
                                              <div className="px-3 py-2 text-xs text-muted-foreground flex items-center justify-center gap-2">
                                                <RefreshCw className="w-3 h-3 animate-spin text-primary" />
                                                <span>Đang tải...</span>
                                              </div>
                                            ) : (subtaskTransitionsMap[st.key] || []).length === 0 ? (
                                              <div className="px-3 py-2 text-xs text-muted-foreground italic text-center">
                                                Không có bước chuyển
                                              </div>
                                            ) : (
                                              (subtaskTransitionsMap[st.key] || []).map((t: any) => (
                                                <button
                                                  key={t.id}
                                                  type="button"
                                                  onClick={() => {
                                                    setPendingTransition({
                                                      key: st.key,
                                                      id: t.id,
                                                      name: t.name,
                                                      summary: st.fields.summary,
                                                      isSubtask: true
                                                    });
                                                    setOpenSubtaskMenuKey(null);
                                                  }}
                                                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium hover:bg-accent hover:text-primary text-foreground flex items-center justify-between transition group cursor-pointer"
                                                >
                                                  <span>{t.name}</span>
                                                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-primary transition shrink-0" />
                                                </button>
                                              ))
                                            )}
                                          </div>
                                        )}
                                      </div>
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

                    {/* Comments Header Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 pb-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-foreground uppercase tracking-wider">
                          Bình luận ({sortedComments.length})
                        </span>
                        {sortedComments.length > 0 && (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            ({expandedCommentIds.size}/{sortedComments.length} đang mở)
                          </span>
                        )}
                      </div>

                      {sortedComments.length > 0 && (
                        <div className="flex items-center gap-2">
                          {/* Sort Toggle */}
                          <button
                            type="button"
                            onClick={() => setCommentSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-accent text-foreground transition flex items-center gap-1.5 shadow-2xs"
                            title={commentSortOrder === 'desc' ? 'Đang xếp: Mới nhất trên đầu. Bấm để xếp Cũ nhất trước.' : 'Đang xếp: Cũ nhất trên đầu. Bấm để xếp Mới nhất trước.'}
                          >
                            <ArrowUpDown className="w-3.5 h-3.5 text-primary" />
                            <span>{commentSortOrder === 'desc' ? 'Mới nhất trước' : 'Cũ nhất trước'}</span>
                          </button>

                          {/* Expand/Collapse All */}
                          {expandedCommentIds.size === sortedComments.length ? (
                            <button
                              type="button"
                              onClick={collapseAllComments}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition flex items-center gap-1.5 shadow-2xs"
                              title="Thu gọn tất cả bình luận"
                            >
                              <ChevronsDownUp className="w-3.5 h-3.5" />
                              <span>Thu gọn tất cả</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={expandAllComments}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-accent text-primary transition flex items-center gap-1.5 shadow-2xs"
                              title="Mở rộng tất cả bình luận"
                            >
                              <ChevronsUpDown className="w-3.5 h-3.5" />
                              <span>Mở rộng tất cả</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Comments List */}
                    <div className="space-y-2.5">
                      {sortedComments.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic text-center py-8">Chưa có bình luận nào trên công việc này.</p>
                      ) : (
                        sortedComments.map((c, index) => {
                          const isNewest = index === 0 && commentSortOrder === 'desc';
                          const isExpanded = expandedCommentIds.has(c.id);
                          const relativeTime = formatRelativeTime(c.created);
                          const exactDateTime = new Date(c.created).toLocaleString('vi-VN');

                          if (!isExpanded) {
                            // Collapsed compact row
                            return (
                              <div
                                key={c.id}
                                onClick={() => toggleComment(c.id)}
                                className="group rounded-xl bg-card border border-border/80 hover:border-primary/50 transition cursor-pointer p-2.5 px-3 flex items-center justify-between gap-3 text-xs select-none shadow-2xs hover:bg-accent/40"
                                title="Bấm để mở rộng chi tiết bình luận này"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <button
                                    type="button"
                                    className="p-0.5 -ml-1 rounded text-muted-foreground group-hover:text-primary transition shrink-0"
                                    title="Mở rộng bình luận"
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </button>

                                  <JiraAvatar
                                    avatarUrl={c.author?.avatarUrls?.['24x24'] || c.author?.avatarUrls?.['32x32']}
                                    displayName={c.author?.displayName}
                                    className="w-5 h-5 shrink-0"
                                    sizeText="text-[9px]"
                                  />

                                  <span className="font-bold text-foreground shrink-0 text-xs">
                                    {c.author?.displayName || 'Unknown Author'}
                                  </span>

                                  {isNewest && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shrink-0">
                                      Mới nhất
                                    </span>
                                  )}

                                  <span className="text-muted-foreground truncate text-[11px] flex-1">
                                    — {getCommentSnippet(c.body)}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 text-xs">
                                  <span
                                    className="font-semibold text-primary dark:text-primary/90 bg-primary/10 px-2 py-0.5 rounded-md text-[11px] shrink-0"
                                    title={`Thời gian gửi: ${exactDateTime}`}
                                  >
                                    {relativeTime}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground hidden sm:inline" title={exactDateTime}>
                                    {new Date(c.created).toLocaleDateString()}
                                  </span>
                                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition opacity-60 group-hover:opacity-100 shrink-0" />
                                </div>
                              </div>
                            );
                          }

                          // Expanded full card
                          return (
                            <div
                              key={c.id}
                              className="rounded-2xl bg-card border border-border shadow-2xs overflow-hidden transition-all duration-150 hover:border-primary/40 space-y-0"
                            >
                              {/* Header */}
                              <div
                                onClick={() => toggleComment(c.id)}
                                className="p-3 bg-muted/30 hover:bg-muted/50 cursor-pointer flex items-center justify-between gap-3 select-none transition border-b border-border/60"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <button
                                    type="button"
                                    className="p-1 -ml-1 rounded text-muted-foreground hover:text-foreground transition shrink-0"
                                    title="Thu gọn bình luận"
                                  >
                                    <ChevronDown className="w-4 h-4 text-primary" />
                                  </button>

                                  <JiraAvatar
                                    avatarUrl={c.author?.avatarUrls?.['24x24'] || c.author?.avatarUrls?.['32x32']}
                                    displayName={c.author?.displayName}
                                    className="w-5 h-5 shrink-0"
                                    sizeText="text-[9px]"
                                  />

                                  <span className="font-bold text-foreground text-xs truncate">
                                    {c.author?.displayName || 'Unknown Author'}
                                  </span>

                                  {isNewest && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shrink-0">
                                      Mới nhất
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0 text-xs">
                                  <span
                                    className="font-semibold text-primary dark:text-primary/90 bg-primary/10 px-2 py-0.5 rounded-md text-[11px]"
                                    title={`Thời gian gửi: ${exactDateTime}`}
                                  >
                                    {relativeTime}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground hidden sm:inline" title={exactDateTime}>
                                    • {new Date(c.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {new Date(c.created).toLocaleDateString()}
                                  </span>
                                  <ChevronUp className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition shrink-0" />
                                </div>
                              </div>

                              {/* Body */}
                              <div className="p-3.5 text-xs text-foreground leading-relaxed max-h-[480px] overflow-y-auto">
                                <div className="prose prose-xs sm:prose-sm dark:prose-invert max-w-none space-y-2">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                      img: ({ src, alt }) => (
                                        <img
                                          src={src}
                                          alt={alt || 'Image'}
                                          onClick={() => src && setPreviewImage({ url: src, title: alt || 'Comment Image' })}
                                          className="rounded-xl border border-border/80 shadow-xs hover:border-primary/60 transition cursor-zoom-in max-w-full max-h-[350px] object-contain my-2 bg-muted/20"
                                          loading="lazy"
                                        />
                                      ),
                                      a: ({ href, children }) => (
                                        <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium break-all inline-flex items-center gap-0.5">
                                          <span>{children}</span>
                                          <ExternalLink className="w-3 h-3 shrink-0" />
                                        </a>
                                      ),
                                      code: ({ children }) => (
                                        <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[11px] text-foreground border border-border/50">
                                          {children}
                                        </code>
                                      ),
                                      pre: ({ children }) => (
                                        <pre className="p-3 bg-muted/80 rounded-xl overflow-x-auto text-xs my-2 border border-border/70 font-mono">
                                          {children}
                                        </pre>
                                      ),
                                      p: ({ children }) => <p className="mb-1.5 leading-relaxed">{children}</p>,
                                      ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 my-1">{children}</ul>,
                                      ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 my-1">{children}</ol>,
                                      table: ({ children }) => (
                                        <div className="overflow-x-auto my-2 rounded-lg border border-border">
                                          <table className="min-w-full divide-y divide-border text-xs">{children}</table>
                                        </div>
                                      ),
                                      th: ({ children }) => (
                                        <th className="px-3 py-1.5 bg-muted/60 font-bold text-foreground border-b border-border text-left">
                                          {children}
                                        </th>
                                      ),
                                      td: ({ children }) => (
                                        <td className="px-3 py-1.5 border-b border-border/50 text-foreground">
                                          {children}
                                        </td>
                                      ),
                                    }}
                                  >
                                    {typeof c.body === 'string'
                                      ? convertJiraWikiToMarkdown(c.body, attachments, activeToken)
                                      : renderAdfToMarkdown(c.body, attachments, activeToken)}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            </div>
                          );
                        })
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
                          <div key={w.id} className="p-3.5 rounded-2xl bg-card border border-border flex items-start justify-between gap-3 text-xs group hover:border-primary/40 transition">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground">
                                  {w.author?.displayName || 'User'}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  logged on {new Date(w.started).toLocaleString()}
                                </span>
                              </div>
                              {w.comment && (
                                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                  {renderAdfToText(w.comment)}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-bold text-xs shrink-0">
                                {w.timeSpent}
                              </span>
                              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                                <button
                                  type="button"
                                  onClick={() => setEditingWorklog({
                                    id: w.id,
                                    issueKey: currentKey,
                                    issueSummary: issue?.fields?.summary,
                                    timeSpent: w.timeSpent,
                                    started: w.started,
                                    comment: w.comment
                                  })}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 transition"
                                  title="Chỉnh sửa log work"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPendingDeleteWorklog({
                                    id: w.id,
                                    timeSpent: w.timeSpent,
                                    started: w.started,
                                    author: w.author?.displayName
                                  })}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition"
                                  title="Xóa log work"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
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
      {/* Confirm Status Transition Modal */}
      <ConfirmModal
        isOpen={!!pendingTransition}
        title={pendingTransition?.isSubtask ? "Xác nhận chuyển trạng thái Sub-task" : "Xác nhận chuyển trạng thái"}
        description={
          pendingTransition ? (
            <span>
              Bạn có chắc chắn muốn chuyển trạng thái của{' '}
              <strong className="text-foreground">{pendingTransition.key}</strong>
              {pendingTransition.summary ? ` (${pendingTransition.summary})` : ''} sang{' '}
              <span className="font-semibold text-primary">"{pendingTransition.name}"</span> không?
            </span>
          ) : ''
        }
        confirmText="Xác nhận chuyển"
        cancelText="Hủy bỏ"
        variant="primary"
        loading={transitioning}
        onConfirm={() => {
          if (pendingTransition) {
            executeTransition(pendingTransition.key, pendingTransition.id, pendingTransition.name);
          }
        }}
        onClose={() => {
          if (!transitioning) setPendingTransition(null);
        }}
      />

      {/* Edit Worklog Modal */}
      {editingWorklog && (
        <EditWorklogModal
          isOpen={Boolean(editingWorklog)}
          onClose={() => setEditingWorklog(null)}
          worklog={editingWorklog}
          onSuccess={() => {
            loadIssue(currentKey);
            onIssueUpdated?.();
          }}
        />
      )}

      {/* Confirm Delete Worklog Modal */}
      <ConfirmModal
        isOpen={!!pendingDeleteWorklog}
        title="Xác nhận xóa Log Work"
        description={
          pendingDeleteWorklog ? (
            <span>
              Bạn có chắc chắn muốn xóa lượt log work <strong className="text-foreground">{pendingDeleteWorklog.timeSpent}</strong>
              {pendingDeleteWorklog.started ? ` (ngày ${new Date(pendingDeleteWorklog.started).toLocaleDateString()})` : ''} của{' '}
              <span className="font-semibold text-foreground">{pendingDeleteWorklog.author || 'người dùng'}</span> trên công việc{' '}
              <span className="font-semibold text-primary">{currentKey}</span> không? Thao tác này sẽ xóa vĩnh viễn thời gian làm việc đã ghi nhận trên Jira.
            </span>
          ) : ''
        }
        confirmText="Xác nhận xóa"
        cancelText="Hủy bỏ"
        variant="destructive"
        loading={isDeletingWorklog}
        onConfirm={executeDeleteWorklog}
        onClose={() => {
          if (!isDeletingWorklog) setPendingDeleteWorklog(null);
        }}
      />

      {/* Edit Story / Issue Modal */}
      {showEditStoryModal && issue && (
        <EditStoryModal
          isOpen={showEditStoryModal}
          onClose={() => setShowEditStoryModal(false)}
          story={issue}
          onSuccess={() => {
            loadIssue(currentKey);
            onIssueUpdated?.();
          }}
        />
      )}

      {/* Confirm Delete Issue Modal */}
      <ConfirmModal
        isOpen={showDeleteStoryConfirm}
        title={`Xác nhận xóa ${issue?.fields?.issuetype?.name || 'Issue'} ${currentKey}`}
        description={
          <span>
            Bạn có chắc chắn muốn xóa vĩnh viễn <strong className="text-foreground">{currentKey}</strong>: "{issue?.fields?.summary}"?
            {issue?.fields?.subtasks && issue.fields.subtasks.length > 0 && (
              <span className="block mt-2 text-rose-500 font-medium">
                Cảnh báo: Tất cả {issue.fields.subtasks.length} subtask liên quan cũng sẽ bị xóa vĩnh viễn khỏi Jira!
              </span>
            )}
          </span>
        }
        confirmText="Xác nhận xóa"
        cancelText="Hủy bỏ"
        variant="destructive"
        loading={isDeletingCurrentIssue}
        onConfirm={executeDeleteCurrentIssue}
        onClose={() => {
          if (!isDeletingCurrentIssue) setShowDeleteStoryConfirm(false);
        }}
      />
    </>,
    document.body
  ) : null;
};
