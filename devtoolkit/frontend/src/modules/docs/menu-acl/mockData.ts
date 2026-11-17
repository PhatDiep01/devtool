import { 
  AclConnection, 
  AclLanguage, 
  AclPhanHe, 
  AclModule, 
  AclFunction, 
  AclAction, 
  AclGroupPermission 
} from './types';

export const INITIAL_CONNECTIONS: AclConnection[] = [
  {
    id: 'conn-local-hufi',
    name: 'CSDL HUFI ACL (192.168.0.90)',
    server: '192.168.0.90:43201',
    database: 'WEB_HUFI_EMS_ACL',
    authType: 'sql',
    username: 'sa',
    isRoot: false,
    status: 'online',
    hardwareFingerprint: '192.168.0.90:43201|8|A4B19C32-E67B-4B7C-9021-FE8832101BC4',
    environment: 'dev',
    latencyMs: 14,
    lastChecked: '2026-10-30 17:40:00'
  },
  {
    id: 'conn-master-org',
    name: 'CSDL GỐC MASTER ORG (Bảo vệ nghiêm ngặt)',
    server: '192.168.0.6',
    database: 'WEB_ORG_EMS_ACL',
    authType: 'sql',
    username: 'pmt-ems',
    isRoot: true,
    status: 'online',
    hardwareFingerprint: '192.168.0.6|1|7FF38210-901B-41DE-8012-A0BC54812EF1',
    environment: 'master',
    latencyMs: 8,
    lastChecked: '2026-10-30 17:35:00'
  }
];

export const INITIAL_LANGUAGES: AclLanguage[] = [
  { id: 1, ma: 'vi', ten: 'Tiếng Việt', maQuocGia: 'vn', isActive: true },
  { id: 2, ma: 'en', ten: 'Tiếng Anh (English)', maQuocGia: 'gb', isActive: false },
  { id: 4, ma: 'zh', ten: 'Tiếng Trung Quốc (中文)', maQuocGia: 'cn', isActive: false }
];

export const INITIAL_PHAN_HE: AclPhanHe[] = [
  { id: 5, ma: 'HT', tenPhanHe: 'Hệ thống & Quản trị', soThuTu: 1, isHienThi: true, moduleCount: 2 },
  { id: 3, ma: 'DT', tenPhanHe: 'Đào tạo & Học vụ', soThuTu: 2, isHienThi: true, moduleCount: 18 },
  { id: 8, ma: 'KT', tenPhanHe: 'Khảo thí & Đảm bảo chất lượng', soThuTu: 3, isHienThi: true, moduleCount: 4 },
  { id: 4, ma: 'EOFFICE', tenPhanHe: 'Hành chính điện tử (EOffice)', soThuTu: 4, isHienThi: true, moduleCount: 2 },
  { id: 12, ma: 'TC', tenPhanHe: 'Tài chính & Kế toán học vụ', soThuTu: 5, isHienThi: true, moduleCount: 3 },
  { id: 13, ma: 'TS', tenPhanHe: 'Tuyển sinh & Nhập học', soThuTu: 6, isHienThi: true, moduleCount: 3 },
  { id: 1, ma: 'CDR', tenPhanHe: 'Chuẩn đầu ra', soThuTu: 7, isHienThi: true, moduleCount: 2 },
  { id: 9, ma: 'NS', tenPhanHe: 'Tổ chức Cán bộ & Nhân sự', soThuTu: 8, isHienThi: true, moduleCount: 2 }
];

export const INITIAL_MODULES: AclModule[] = [
  {
    id: 1,
    keyModule: 'Mod_HT',
    tenModule: 'Quản trị và phân quyền hệ thống',
    moTa: 'Module lõi quản lý người dùng, vai trò quyền hạn, phân hệ và menu hệ thống',
    idPhanHe: 5,
    tenPhanHe: 'Hệ thống & Quản trị',
    groupName: 'Hệ thống',
    cssClass: 'fa fa-cogs',
    cssIcon: 'ShieldCheck',
    soThuTu: 1,
    isActive: true,
    isCustom: false
  },
  {
    id: 25,
    keyModule: 'Mod_MenuACL',
    tenModule: 'Menu Web ACL & Phân quyền',
    moTa: 'Module đồng bộ và tùy chỉnh cấu trúc Menu Web đa cơ sở dữ liệu',
    idPhanHe: 5,
    tenPhanHe: 'Hệ thống & Quản trị',
    groupName: 'Hệ thống',
    cssClass: 'fa fa-sitemap',
    cssIcon: 'Layers',
    soThuTu: 2,
    isActive: true,
    isCustom: true
  },
  {
    id: 2,
    keyModule: 'Mod_KHTH',
    tenModule: 'Kế hoạch thu & Học phí',
    moTa: 'Quản lý biểu mức học phí, điều chỉnh chính sách miễn giảm và thu chi',
    idPhanHe: 12,
    tenPhanHe: 'Tài chính & Kế toán học vụ',
    groupName: 'Tài chính',
    cssClass: 'fa fa-money-bill',
    cssIcon: 'CreditCard',
    soThuTu: 1,
    isActive: true,
    isCustom: false
  },
  {
    id: 18,
    keyModule: 'Mod_QLDRLKTKL',
    tenModule: 'Điểm rèn luyện & Khen thưởng',
    moTa: 'Đánh giá điểm rèn luyện sinh viên, hội đồng khen thưởng và kỷ luật',
    idPhanHe: 3,
    tenPhanHe: 'Đào tạo & Học vụ',
    groupName: 'Đào tạo',
    cssClass: 'fa fa-award',
    cssIcon: 'Award',
    soThuTu: 12,
    isActive: true,
    isCustom: false
  },
  {
    id: 61,
    keyModule: 'Mod_QLMH',
    tenModule: 'Quản lý môn học & CTĐT',
    moTa: 'Danh mục học phần, chương trình khung, điều kiện tiên quyết và đề cương',
    idPhanHe: 3,
    tenPhanHe: 'Đào tạo & Học vụ',
    groupName: 'Đào tạo',
    cssClass: 'fa fa-book',
    cssIcon: 'BookOpen',
    soThuTu: 57,
    isActive: true,
    isCustom: false
  },
  {
    id: 69,
    keyModule: 'Mod_QLKS_V2',
    tenModule: 'Khảo sát trực tuyến V2',
    moTa: 'Hệ thống khảo sát ý kiến người học, giảng viên và đối tượng ngoài',
    idPhanHe: 8,
    tenPhanHe: 'Khảo thí & Đảm bảo chất lượng',
    groupName: 'Khảo sát',
    cssClass: 'fa fa-poll',
    cssIcon: 'BarChart2',
    soThuTu: 59,
    isActive: true,
    isCustom: false
  }
];

export const INITIAL_FUNCTIONS: AclFunction[] = [
  // --- Module 1: Quản trị và phân quyền hệ thống ---
  // Nhóm cấp 1 (IsGroup = 1, ParentId = null)
  {
    id: 1,
    functionName: 'Cấu hình hệ thống',
    parentId: null,
    idModule: 1,
    isGroup: true,
    order: 1,
    isActive: true,
    isDelete: false,
    isCustom: false,
    soLuongManHinhCon: 4
  },
  {
    id: 4,
    functionName: 'Phân quyền & Vai trò',
    parentId: null,
    idModule: 1,
    isGroup: true,
    order: 2,
    isActive: true,
    isDelete: false,
    isCustom: false,
    soLuongManHinhCon: 4
  },
  {
    id: 7,
    functionName: 'Cấu hình Email tự động',
    parentId: null,
    idModule: 1,
    isGroup: true,
    order: 3,
    isActive: true,
    isDelete: false,
    isCustom: false,
    soLuongManHinhCon: 3
  },

  // Màn hình con thuộc Nhóm 1 (IsGroup = 0, ParentId = 1)
  {
    id: 935,
    functionName: 'Quản lý phân hệ (Subsystems)',
    parentId: 1,
    idModule: 1,
    isGroup: false,
    actionName: '/system/phan-he-ngon-ngu',
    controllerName: 'ACL_PhanHeController',
    order: 1,
    routing: '/system/phan-he-ngon-ngu',
    isActive: true,
    isDelete: false,
    isCustom: false,
    actionCount: 4
  },
  {
    id: 939,
    functionName: 'Quản lý module phân quyền',
    parentId: 1,
    idModule: 1,
    isGroup: false,
    actionName: '/system/quan-ly-module-phan-quyen',
    controllerName: 'ACL_ModulesCustomController',
    order: 2,
    routing: '/system/quan-ly-module-phan-quyen',
    isActive: true,
    isDelete: false,
    isCustom: true,
    actionCount: 3
  },
  {
    id: 941,
    functionName: 'Quản lý đa ngôn ngữ (Localization)',
    parentId: 1,
    idModule: 1,
    isGroup: false,
    actionName: '/system/ngon-ngu',
    controllerName: 'ACL_LanguageController',
    order: 3,
    routing: '/system/ngon-ngu',
    isActive: true,
    isDelete: false,
    isCustom: false,
    actionCount: 4
  },
  {
    id: 1152,
    functionName: 'Tham số cấu hình hệ thống',
    parentId: 1,
    idModule: 1,
    isGroup: false,
    actionName: '/system/tham-so-he-thong',
    controllerName: 'SysConfigController',
    order: 4,
    routing: '/system/tham-so-he-thong',
    isActive: true,
    isDelete: false,
    isCustom: false,
    actionCount: 3
  },

  // Màn hình con thuộc Nhóm 4 (IsGroup = 0, ParentId = 4)
  {
    id: 5,
    functionName: 'Vai trò & Nhóm quyền (Roles)',
    parentId: 4,
    idModule: 1,
    isGroup: false,
    actionName: '/system/vai-tro-quyen-han',
    controllerName: 'PermissionGroupsController',
    order: 1,
    routing: '/system/vai-tro-quyen-han',
    isActive: true,
    isDelete: false,
    isCustom: false,
    actionCount: 5
  },
  {
    id: 6,
    functionName: 'Phân quyền người dùng (Users)',
    parentId: 4,
    idModule: 1,
    isGroup: false,
    actionName: '/system/phan-quyen-nguoi-dung',
    controllerName: 'PermissionsController',
    order: 2,
    routing: '/system/phan-quyen-nguoi-dung',
    isActive: true,
    isDelete: false,
    isCustom: false,
    actionCount: 3
  },
  {
    id: 684,
    functionName: 'Phân quyền Khoa quản lý',
    parentId: 4,
    idModule: 1,
    isGroup: false,
    actionName: '/system/phan-quyen-khoa-quan-ly',
    controllerName: 'KhoaManagementController',
    order: 3,
    routing: '/system/phan-quyen-khoa-quan-ly',
    isActive: true,
    isDelete: false,
    isCustom: false,
    actionCount: 3
  },
  {
    id: 1219,
    functionName: 'Quản lý nhóm quyền mặc định',
    parentId: 4,
    idModule: 1,
    isGroup: false,
    actionName: '/system/quan-ly-nhom-quyen-mac-dinh',
    controllerName: 'DefaultPermissionsController',
    order: 4,
    routing: '/system/quan-ly-nhom-quyen-mac-dinh',
    isActive: true,
    isDelete: false,
    isCustom: false,
    actionCount: 2
  },

  // Màn hình con thuộc Nhóm 7 (IsGroup = 0, ParentId = 7)
  {
    id: 8,
    functionName: 'Biểu mẫu gửi email tự động',
    parentId: 7,
    idModule: 1,
    isGroup: false,
    actionName: '/system/bieu-mau-gui-mail',
    controllerName: 'MailTemplateController',
    order: 1,
    routing: '/system/bieu-mau-gui-mail',
    isActive: true,
    isDelete: false,
    isCustom: false,
    actionCount: 4
  },
  {
    id: 9,
    functionName: 'Cấu hình SMTP Google Mail',
    parentId: 7,
    idModule: 1,
    isGroup: false,
    actionName: '/system/system-mail',
    controllerName: 'MailConfigController',
    order: 2,
    routing: '/system/system-mail',
    isActive: true,
    isDelete: false,
    isCustom: false,
    actionCount: 3
  },
  {
    id: 10,
    functionName: 'Cấu hình tích hợp Microsoft Azure Mail',
    parentId: 7,
    idModule: 1,
    isGroup: false,
    actionName: '/system/system-mail-azure',
    controllerName: 'AzureMailController',
    order: 3,
    routing: '/system/system-mail-azure',
    isActive: true,
    isDelete: false,
    isCustom: false,
    actionCount: 3
  }
];

export const INITIAL_ACTIONS: AclAction[] = [
  // Actions cho Function 5 (Vai trò & Nhóm quyền)
  {
    id: 11,
    functionId: 5,
    actionName: 'GetPermissionGroupTreeAsync',
    controllerName: 'PermissionGroupsController',
    actionType: 1,
    typeName: 'Xem',
    keyOption: 'VIEW',
    notes: 'Xem cây danh sách vai trò và nhóm quyền',
    isActive: true
  },
  {
    id: 8,
    functionId: 5,
    actionName: 'CreatePermissionGroupsAsync',
    controllerName: 'PermissionGroupsController',
    actionType: 2,
    typeName: 'Thêm',
    keyOption: 'ADD',
    notes: 'Thêm mới nhóm vai trò quyền hạn',
    isActive: true
  },
  {
    id: 9,
    functionId: 5,
    actionName: 'UpdatePermissionGroupsAsync',
    controllerName: 'PermissionGroupsController',
    actionType: 3,
    typeName: 'Sửa',
    keyOption: 'EDIT',
    notes: 'Chỉnh sửa thông tin vai trò quyền hạn',
    isActive: true
  },
  {
    id: 10,
    functionId: 5,
    actionName: 'DeletePermissionGroupsAsync',
    controllerName: 'PermissionGroupsController',
    actionType: 4,
    typeName: 'Xóa',
    keyOption: 'DELETE',
    notes: 'Xóa nhóm quyền (chặn nếu còn user)',
    isActive: true
  },
  {
    id: 2355,
    functionId: 5,
    actionName: 'GetPermissionGroupActionsAsync',
    controllerName: 'PermissionGroupActionsController',
    actionType: 5,
    typeName: 'Thiết lập ma trận quyền',
    keyOption: 'SET_MATRIX',
    notes: 'Cấp phát hành động chi tiết cho nhóm',
    isActive: true
  },

  // Actions cho Function 6 (Phân quyền người dùng)
  {
    id: 13,
    functionId: 6,
    actionName: 'GetPermission',
    controllerName: 'PermissionsController',
    actionType: 1,
    typeName: 'Xem',
    keyOption: 'VIEW',
    notes: 'Xem danh sách phân quyền người dùng',
    isActive: true
  },
  {
    id: 12,
    functionId: 6,
    actionName: 'CreatePermissionsAsync',
    controllerName: 'PermissionsController',
    actionType: 2,
    typeName: 'Thêm',
    keyOption: 'ADD',
    notes: 'Gán người dùng vào nhóm quyền',
    isActive: true
  },
  {
    id: 14,
    functionId: 6,
    actionName: 'SavePermissions',
    controllerName: 'PermissionsController',
    actionType: 5,
    typeName: 'Ghi đè quyền riêng lẻ',
    keyOption: 'OVERRIDE',
    notes: 'Lưu quyền đặc thù cho từng tài khoản',
    isActive: true
  },

  // Actions cho Function 935 (Quản lý phân hệ)
  {
    id: 2358,
    functionId: 935,
    actionName: 'GetDataListAsync',
    controllerName: 'ACL_PhanHeController',
    actionType: 1,
    typeName: 'Xem',
    keyOption: 'VIEW',
    notes: 'Lấy danh sách phân hệ hệ thống',
    isActive: true
  },
  {
    id: 2359,
    functionId: 935,
    actionName: 'CreateACL_PhanHeAsync',
    controllerName: 'ACL_PhanHeController',
    actionType: 2,
    typeName: 'Thêm',
    keyOption: 'ADD',
    notes: 'Khai báo phân hệ mới',
    isActive: true
  },
  {
    id: 2360,
    functionId: 935,
    actionName: 'UpdateACL_PhanHeAsync',
    controllerName: 'ACL_PhanHeController',
    actionType: 3,
    typeName: 'Sửa',
    keyOption: 'EDIT',
    notes: 'Cập nhật phân hệ',
    isActive: true
  },
  {
    id: 2361,
    functionId: 935,
    actionName: 'DeleteACL_PhanHeAsync',
    controllerName: 'ACL_PhanHeController',
    actionType: 4,
    typeName: 'Xóa',
    keyOption: 'DELETE',
    notes: 'Xóa phân hệ (chặn nếu có module liên kết)',
    isActive: true
  },

  // Actions cho Function 939 (Quản lý module phân quyền)
  {
    id: 2371,
    functionId: 939,
    actionName: 'GetDataListAsync',
    controllerName: 'ACL_ModulesCustomController',
    actionType: 1,
    typeName: 'Xem',
    keyOption: 'VIEW',
    notes: 'Lấy danh sách module và tùy biến',
    isActive: true
  },
  {
    id: 2372,
    functionId: 939,
    actionName: 'CreateACL_ModulesCustomAsync',
    controllerName: 'ACL_ModulesCustomController',
    actionType: 2,
    typeName: 'Thêm',
    keyOption: 'ADD',
    notes: 'Thêm mới cấu hình module riêng',
    isActive: true
  },
  {
    id: 2373,
    functionId: 939,
    actionName: 'SaveCustomScreenConfig',
    controllerName: 'ACL_FunctionsCustomController',
    actionType: 5,
    typeName: 'Tùy chỉnh màn hình',
    keyOption: 'CUSTOM_SCREEN',
    notes: 'Tùy biến màn hình theo đặc thù đơn vị',
    isActive: true
  }
];

export const INITIAL_ROLES: AclGroupPermission[] = [
  {
    id: 1,
    idParent: null,
    groupName: 'Nhóm quyền dành cho Master',
    notes: 'Toàn quyền cấp cao nhất của hệ thống lõi',
    ordering: 1,
    actionCount: 3387,
    assignedActionIds: [11, 8, 9, 10, 2355, 13, 12, 14, 2358, 2359, 2360, 2361, 2371, 2372, 2373]
  },
  {
    id: 9,
    idParent: 0,
    groupName: 'Quản trị viên (Admin)',
    notes: 'Quản trị viên kỹ thuật toàn quyền phân hệ',
    ordering: 2,
    actionCount: 2558,
    assignedActionIds: [11, 8, 9, 10, 2355, 13, 12, 14, 2358, 2359, 2360, 2361, 2371, 2372, 2373]
  },
  {
    id: 10,
    idParent: null,
    groupName: 'Ban Giám Hiệu',
    notes: 'Chức năng phê duyệt, giám sát báo cáo và tra cứu toàn diện',
    ordering: 3,
    actionCount: 480,
    assignedActionIds: [11, 13, 2358, 2371]
  },
  {
    id: 11,
    idParent: null,
    groupName: 'Phòng Đào Tạo',
    notes: 'Nghiệp vụ kế hoạch giảng dạy, môn học và sinh viên',
    ordering: 4,
    actionCount: 603,
    assignedActionIds: [11, 13]
  },
  {
    id: 3042,
    idParent: null,
    groupName: 'Giảng viên [ĐKHP - Nhập điểm - Tốt nghiệp]',
    notes: 'Phân quyền giảng viên cơ hữu và thỉnh giảng',
    ordering: 5,
    actionCount: 244,
    assignedActionIds: [11]
  },
  {
    id: 3035,
    idParent: null,
    groupName: 'Quản trị hệ thống (System Operator)',
    notes: 'Vận hành hạ tầng, backup, phân quyền và giám sát kết nối',
    ordering: 6,
    actionCount: 383,
    assignedActionIds: [11, 8, 9, 13, 12, 2358, 2359, 2360, 2361, 2371, 2372, 2373]
  }
];
