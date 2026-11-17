export interface AclConnection {
  id: string;
  name: string;
  server: string;
  database: string;
  authType: 'sql' | 'windows';
  username?: string;
  isRoot: boolean; // Root Database Protection: cannot be sync target
  status: 'online' | 'offline' | 'checking';
  hardwareFingerprint: string; // {Server}|{DB_ID}|{BrokerGuid}
  environment: 'dev' | 'test' | 'staging' | 'master' | 'prod';
  latencyMs?: number;
  lastChecked?: string;
}

export interface AclLanguage {
  id: number;
  ma: string;
  ten: string;
  maQuocGia: string;
  isActive: boolean;
}

export interface AclPhanHe {
  id: number;
  ma: string;
  tenPhanHe: string;
  soThuTu: number;
  isHienThi: boolean;
  moduleCount?: number;
}

export interface AclModule {
  id: number;
  keyModule: string;
  tenModule: string;
  moTa: string;
  idPhanHe: number | null;
  tenPhanHe?: string;
  groupName?: string;
  cssClass?: string;
  cssIcon?: string;
  soThuTu: number;
  isActive: boolean;
  isCustom?: boolean; // Root vs Custom from ACL_ModulesCustom
  idFileIcon?: number;
  ngayTao?: string;
  nguoiTao?: string;
  ngayCapNhat?: string;
  nguoiCapNhat?: string;
}

export interface AclFunction {
  id: number;
  functionName: string;
  parentId: number | null;
  idModule: number | null; // null => Orphan
  isGroup: boolean; // 1: Folder/Group, 0: Executable Screen
  actionName?: string | null;
  controllerName?: string | null;
  order: number;
  routing?: string | null;
  langKey?: string | null;
  cssClass?: string | null;
  cssBadge?: string | null;
  isActive: boolean;
  isDelete: boolean;
  isCustom?: boolean; // Root vs Custom from ACL_FunctionsCustom
  idRoot?: number | null;
  idCustom?: number | null;
  soLuongManHinhCon?: number;
  actionCount?: number;
}

export interface AclAction {
  id: number;
  functionId: number;
  actionName: string; // API endpoint / method
  controllerName: string;
  actionType: number; // 1: Xem, 2: Thêm, 3: Sửa, 4: Xóa, 5: Export/Custom
  typeName: string; // 'Xem' | 'Thêm' | 'Sửa' | 'Xóa' | 'Xuất dữ liệu' ...
  keyOption?: string | null;
  notes?: string | null;
  isActive: boolean;
}

export interface AclGroupPermission {
  id: number;
  idParent: number | null;
  groupName: string;
  notes?: string | null;
  ordering: number;
  actionCount?: number;
  assignedActionIds?: number[]; // List of Action IDs granted to this group
}

export interface AclGroupPermissionAction {
  id: number;
  idAction: number;
  idGroupPermission: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export interface AclSyncPreview {
  sourceConnection: AclConnection;
  targetConnection: AclConnection;
  isCompatible: boolean;
  compatibilityErrors: string[];
  counts: {
    phanHe: { source: number; target: number };
    modules: { source: number; target: number };
    functions: { source: number; target: number };
    actions: { source: number; target: number };
    roles: { source: number; target: number };
  };
  targetHasTriggers: boolean;
  targetHasFkConstraints: boolean;
  previewToken: string;
}

export interface AclOperation {
  id: string;
  type: 'sync' | 'backup' | 'permission_grant';
  sourceDb: string;
  targetDb: string;
  status: 'Queued' | 'BackingUp' | 'Writing' | 'Committing' | 'Succeeded' | 'Failed';
  progressPercent: number;
  message: string;
  backupFile?: string;
  backupChecksum?: string;
  startedAt: string;
  completedAt?: string;
}
