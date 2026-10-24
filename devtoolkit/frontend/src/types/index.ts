export interface Module {
  id: number;
  name: string;
  slug: string;
  icon: string;
  color?: string;
  description?: string;
  sort_order: number;
  screen_count?: number;
}

export interface Screen {
  id: number;
  module_id: number;
  title: string;
  slug: string;
  file_path: string;
  author: string;
  status: string;
  tags: string[];
  jira_key: string;
  overview: string;
  raw_content: string;
  parsed_data: ParsedDocument | null;
  created_at: string;
  updated_at: string;
  module_name?: string;
  module_slug?: string;
  module_icon?: string;
  module_color?: string;
}

export interface ParsedDocument {
  frontmatter: Record<string, any>;
  sections: {
    overview?: string;
    features?: string;
    businessRules?: string;
    apiEndpoints?: string;
    database?: string;
    testing?: string;
    configuration?: string;
    dependencies?: string;
    uiUx?: string;
    notes?: string;
  };
}

export interface JiraIssue {
  id?: string;
  key: string;
  fields: {
    summary: string;
    status: { 
      name: string; 
      statusCategory?: { key: string; colorName: string; name?: string };
      id?: string;
    };
    priority?: { name: string; iconUrl?: string; id?: string };
    issuetype: { 
      name: string; 
      iconUrl?: string; 
      subtask?: boolean; 
      id?: string; 
      hierarchyLevel?: number;
    };
    assignee?: { 
      displayName: string; 
      accountId?: string; 
      emailAddress?: string; 
      avatarUrls?: Record<string, string>;
    } | null;
    reporter?: { 
      displayName: string; 
      accountId?: string; 
      emailAddress?: string; 
      avatarUrls?: Record<string, string>;
    } | null;
    parent?: {
      id?: string;
      key: string;
      fields?: {
        summary: string;
        status?: { name: string; statusCategory?: { key: string } };
        issuetype?: { name: string; iconUrl?: string };
      };
    };
    subtasks?: Array<{
      id: string;
      key: string;
      fields: {
        summary: string;
        status: { name: string; statusCategory?: { key: string } };
        priority?: { name: string; iconUrl?: string };
        issuetype?: { name: string; iconUrl?: string; subtask?: boolean };
        assignee?: { displayName: string; avatarUrls?: Record<string, string> } | null;
      };
    }>;
    timetracking?: {
      originalEstimate?: string;
      remainingEstimate?: string;
      timeSpent?: string;
      originalEstimateSeconds?: number;
      remainingEstimateSeconds?: number;
      timeSpentSeconds?: number;
    };
    timespent?: number;
    timeestimate?: number;
    timeoriginalestimate?: number;
    aggregatetimeoriginalestimate?: number;
    description?: any;
    created?: string;
    updated?: string;
    comment?: {
      total: number;
      comments: Array<{
        id: string;
        author?: { displayName: string; avatarUrls?: Record<string, string> };
        body: any;
        created: string;
        updated?: string;
      }>;
    };
    worklog?: {
      total: number;
      worklogs: Array<{
        id: string;
        author?: { displayName: string; avatarUrls?: Record<string, string> };
        comment?: any;
        started: string;
        timeSpent: string;
        timeSpentSeconds: number;
        created: string;
      }>;
    };
    // Story points customfields
    customfield_10110?: number;
    customfield_10103?: number;
    customfield_10402?: number;
    customfield_10016?: number;
    customfield_10026?: number;
    storyPoints?: number;
    attachment?: Array<{
      id: string;
      filename: string;
      author?: { displayName: string };
      created?: string;
      size: number;
      mimeType: string;
      content: string;
      thumbnail?: string;
    }>;
    components?: Array<{ id: string; name: string }>;
  };
}

export interface JiraBoard {
  id: number;
  name: string;
  type: string;
}

export interface JiraBoardColumnStatus {
  id: string;
  self?: string;
}

export interface JiraBoardColumn {
  name: string;
  statuses: JiraBoardColumnStatus[];
  min?: number;
  max?: number;
}

export interface JiraBoardConfiguration {
  id: number;
  name: string;
  type: string;
  columnConfig?: {
    columns: JiraBoardColumn[];
    constraintType?: string;
  };
  estimation?: {
    type?: string;
    field?: {
      fieldId?: string;
      displayName?: string;
    };
  };
}

export interface JiraSprint {
  id: number;
  name: string;
  state: 'active' | 'future' | 'closed' | string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  originBoardId?: number;
  goal?: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey?: string;
  avatarUrls?: Record<string, string>;
  lead?: { displayName: string; accountId?: string };
}

export interface JiraIssueType {
  id: string;
  name: string;
  description?: string;
  subtask: boolean;
  iconUrl?: string;
  hierarchyLevel?: number;
}

export interface JiraPriority {
  id: string;
  name: string;
  iconUrl?: string;
}

export interface JiraAssignableUser {
  accountId: string;
  name?: string;
  key?: string;
  displayName: string;
  emailAddress?: string;
  avatarUrls?: Record<string, string>;
  active?: boolean;
}

export interface JiraWorklogItem {
  issueKey: string;
  issueSummary: string;
  issueType?: { name: string; iconUrl?: string };
  issueStatus?: { name: string };
  isSubtask?: boolean;
  worklogId: string;
  author?: { displayName: string; avatarUrls?: Record<string, string> };
  started: string;
  timeSpent: string;
  timeSpentSeconds: number;
  commentText?: string;
  created: string;
}

export interface JiraAssignedSubtask {
  key: string;
  summary: string;
  issueType?: { name: string; iconUrl?: string; subtask?: boolean };
  status: { name: string; id: string; statusCategory?: { key: string; name: string } };
  isSubtask: boolean;
  priority?: { name: string; iconUrl?: string };
  parent?: { key: string; summary: string; status?: { name: string } };
  timetracking?: { timeSpent?: string; remainingEstimate?: string; originalEstimate?: string };
  updated?: string;
}

export interface WeeklyCalendarDay {
  date: string;
  dayOfWeek: number;
  dayName: string;
  totalSeconds: number;
  totalHours: number;
  taskCount: number;
  subtaskCount: number;
  worklogs: JiraWorklogItem[];
}

export interface WeeklyCalendarResponse {
  startDate: string;
  endDate: string;
  totalSeconds: number;
  totalHours: number;
  totalTaskCount: number;
  totalSubtaskCount: number;
  totalWorklogsCount: number;
  days: WeeklyCalendarDay[];
  allWorklogs: JiraWorklogItem[];
}

export interface SearchResult {
  id: number;
  title: string;
  title_hl: string;
  module_name: string;
  module_slug: string;
  author: string;
  status: string;
  updated_at: string;
  snippet?: string;
}

export interface StorageStats {
  docsPath: string;
  imagesPath: string;
  totalDocs: number;
  totalImages: number;
  docsSize: string;
  imagesSize: string;
  totalSize: string;
}

export interface DashboardStats {
  totalModules: number;
  totalScreens: number;
  byStatus: Record<string, number>;
  recentScreens: Screen[];
}

export interface JiraUser {
  displayName: string;
  emailAddress: string;
  avatarUrl?: string;
  baseUrl: string;
  authType?: 'basic' | 'bearer';
}

export interface JiraConfigInfo {
  hasConfigured: boolean;
  configuredBaseUrl: string;
  configuredEmail: string;
  authType?: string;
}

export interface JiraLoginParams {
  baseUrl?: string;
  email?: string;
  apiToken?: string;
  authType?: 'basic' | 'bearer';
  accessToken?: string;
  bearerToken?: string;
  useWorkspace?: boolean;
  rememberMe?: boolean;
}

export interface JiraAuthResponse {
  success: boolean;
  token: string;
  expiresAt: string;
  user: JiraUser;
  message?: string;
}

export interface JiraCreateIssuePayload {
  projectKey: string;
  issueTypeId?: string;
  issueTypeName?: string;
  summary: string;
  description?: string | any;
  priorityId?: string;
  assigneeAccountId?: string;
  assignee?: string;
  reporter?: string;
  parentKey?: string;
  storyPoints?: number;
  components?: string[];
  originalEstimate?: string;
  subtaskTypeId?: string;
}

// ==========================================
// BUG TRACKER (FIX NOTES) TYPES
// ==========================================
export type BugType = 'FE' | 'BE' | 'BOTH';
export type BugStatus = 'todo' | 'in_progress' | 'resolved';
export type BugSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface BugAttachment {
  id: string;
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  isImage: boolean;
}

export interface BugItem {
  id: number;
  title: string;
  us_key?: string | null;
  us_link?: string | null;
  type: BugType;
  status: BugStatus;
  severity: BugSeverity;
  description?: string | null;
  fix_solution?: string | null;
  attachments: BugAttachment[];
  created_by?: string | null;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BugStats {
  total: number;
  todo: number;
  in_progress: number;
  resolved: number;
  fe_count: number;
  be_count: number;
  both_count: number;
}

export interface BugListResponse {
  bugs: BugItem[];
  stats: BugStats;
}

export interface JiraCreateWorklogPayload {
  timeSpent: string;
  timeSpentSeconds?: number;
  started?: string;
  comment?: string;
  adjustEstimate?: 'auto' | 'leave' | 'manual';
}

export * from './sticky-notes';


