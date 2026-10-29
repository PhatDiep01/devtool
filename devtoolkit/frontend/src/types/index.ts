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

export interface ScreenImage {
  id: number;
  screen_id?: number | null;
  original_name: string;
  stored_name: string;
  mime_type?: string;
  size_bytes?: number;
  created_at?: string;
  url: string;
  isPending?: boolean;
  tempId?: string;
  file?: File;
  width?: number;
  height?: number;
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
  images?: ScreenImage[];
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
    project?: { key: string; name?: string; id?: string };
    assignee?: { 
      name?: string;
      key?: string;
      displayName: string; 
      accountId?: string; 
      emailAddress?: string; 
      avatarUrls?: Record<string, string>;
    } | null;
    reporter?: { 
      name?: string;
      key?: string;
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
        timetracking?: {
          originalEstimate?: string;
          remainingEstimate?: string;
          timeSpent?: string;
          originalEstimateSeconds?: number;
          remainingEstimateSeconds?: number;
          timeSpentSeconds?: number;
        };
        timespent?: number;
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
  timetracking?: {
    timeSpent?: string;
    remainingEstimate?: string;
    originalEstimate?: string;
    timeSpentSeconds?: number;
    remainingEstimateSeconds?: number;
    originalEstimateSeconds?: number;
  };
  updated?: string;
  duedate?: string;
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
  dataDir?: string;
  docsPath: string;
  imagesPath: string;
  bugFilesPath?: string;
  totalDocs: number;
  totalImages: number;
  docsSize: string;
  imagesSize: string;
  totalSize: string;
  totalStickyNotes?: number;
  stickyNotesSize?: string;
  databaseSize?: string;
  overallFileCount?: number;
  dbScreensCount?: number;
  dbModulesCount?: number;
  bugFilesCount?: number;
  genericImagesCount?: number;
}

export interface DashboardStats {
  totalModules: number;
  totalScreens: number;
  byStatus: Record<string, number>;
  recentScreens: Screen[];
}

export interface JiraSavedAccount {
  username: string;
  userEmail?: string;
  displayName: string;
  avatarUrl?: string;
  baseUrl: string;
  authType?: string;
  isDefault?: boolean;
}

export interface JiraUser {
  username?: string;
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
  configuredUsername?: string;
  configuredDisplayName?: string;
  authType?: string;
  savedAccounts?: JiraSavedAccount[];
}

export interface JiraLoginParams {
  baseUrl?: string;
  email?: string;
  username?: string;
  password?: string;
  apiToken?: string;
  authType?: 'basic' | 'bearer';
  accessToken?: string;
  bearerToken?: string;
  useWorkspace?: boolean;
  rememberMe?: boolean;
  captchaId?: string;
  captchaResponse?: string;
}

export interface JiraAuthResponse {
  success: boolean;
  token?: string;
  expiresAt?: string;
  user?: JiraUser;
  message?: string;
  isCaptcha?: boolean;
  captchaId?: string;
  captchaImage?: string;
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

export type AnnotationType = 
  | 'rect'
  | 'circle'
  | 'arrow'
  | 'line'
  | 'text'
  | 'badge'
  | 'highlight';

export type AnnotationStatus = 'open' | 'fixing' | 'resolved';

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface AnnotationComment {
  id: string;
  author: string;
  text: string;
  created_at: string;
}

export interface AnnotationItem {
  id: string;
  type: AnnotationType;
  sequence: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  x2?: number;
  y2?: number;
  points?: NormalizedPoint[];
  color: string;
  strokeWidth: number;
  fontSize?: number;
  fillOpacity?: number;
  title?: string;
  note: string;
  status: AnnotationStatus;
  comments?: AnnotationComment[];
  created_at: string;
  updated_at: string;
}

export interface BugImageAnnotationRecord {
  id?: number;
  bug_id: number;
  image_id: string;
  annotations: AnnotationItem[];
  version: number;
  created_at?: string;
  updated_at?: string;
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
  payload?: string | null;
  fix_solution?: string | null;
  attachments: BugAttachment[];
  annotations?: Record<string, BugImageAnnotationRecord>;
  annotated_images_count?: number;
  has_annotations?: boolean;
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
  annotated_count?: number;
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

export interface ActivityStreamWorklog {
  worklogId: string;
  issueKey: string;
  issueSummary: string;
  issueType?: { name: string; iconUrl?: string; subtask?: boolean };
  issueStatus?: { name: string; statusCategory?: { key: string } };
  project?: { key: string; name: string };
  isSubtask: boolean;
  parent?: { key: string; summary?: string } | null;
  author: {
    name: string;
    displayName: string;
    avatarUrl?: string;
    emailAddress?: string;
  };
  started: string;
  startedDate: string;
  timeSpent: string;
  timeSpentSeconds: number;
  commentText: string;
  created?: string;
  updated?: string;
}

export interface ActivityStreamUserAgg {
  name: string;
  displayName: string;
  avatarUrl?: string;
  emailAddress?: string;
  totalSeconds: number;
  totalHours: number;
  formattedTime: string;
  worklogsCount: number;
}

export interface ActivityStreamResponse {
  startDate: string;
  endDate: string;
  totalSeconds: number;
  totalHours: number;
  totalWorklogsCount: number;
  uniqueUsersCount: number;
  uniqueIssuesCount: number;
  users: ActivityStreamUserAgg[];
  worklogs: ActivityStreamWorklog[];
}

export * from './sticky-notes';

// ==========================================
// API DOCUMENTATION TYPES
// ==========================================
export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type ApiStatus = 'draft' | 'stable' | 'deprecated' | 'removed';
export type ApiAuthType = 'none' | 'bearer' | 'apikey' | 'basic' | 'custom';
export type ApiParameterLocation = 'path' | 'query' | 'header' | 'cookie';

export interface ApiParameter {
  name: string;
  in: ApiParameterLocation;
  type: string;
  required: boolean;
  default?: string;
  example?: string;
  description?: string;
  constraints?: string;
}

export interface ApiRequestBodySample {
  name: string;
  contentType: string;
  schemaModel?: string;
  body: string;
}

export interface ApiResponseHeader {
  name: string;
  value: string;
  description?: string;
}

export interface ApiResponseSample {
  name: string;
  body: string;
}

export interface ApiResponse {
  statusCode: number;
  description: string;
  headers?: ApiResponseHeader[];
  schemaModel?: string;
  examples: ApiResponseSample[];
}

export interface ApiHistoryItem {
  author: string;
  action: string;
  timestamp: string;
}

export interface ApiEndpoint {
  id: number;
  module_id: number;
  folder: string;
  version: string;
  method: ApiMethod;
  path: string;
  title: string;
  description?: string;
  status: ApiStatus;
  deprecated_reason?: string;
  replaced_by_id?: number;
  tags: string[];
  assignee?: string;
  auth_type: ApiAuthType;
  auth_roles?: string;
  parameters: ApiParameter[];
  request_bodies: ApiRequestBodySample[];
  responses: ApiResponse[];
  related_error_codes: string[];
  business_notes?: string;
  rate_limit?: string;
  change_history: ApiHistoryItem[];
  linked_screen_id?: number;
  linked_bug_id?: number;
  is_pinned: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ApiModelField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  example?: any;
  constraints?: string;
  enum?: string[];
  children?: ApiModelField[];
}

export interface ApiModel {
  id: number;
  module_id: number;
  name: string;
  description?: string;
  fields: ApiModelField[];
  created_at?: string;
  updated_at?: string;
}

export interface ApiErrorCode {
  id: number;
  module_id?: number | null;
  code: string;
  http_status: number;
  message: string;
  description?: string;
  resolution?: string;
  category: 'auth' | 'validation' | 'business' | 'system';
  created_at?: string;
  updated_at?: string;
}

export interface ApiEnvironment {
  id: string;
  name: string;
  url: string;
  is_default: boolean;
}


