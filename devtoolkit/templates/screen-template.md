---
title: "[Tên Màn Hình / Tính Năng]"
module: "[Tên Module / Domain]"
screen: "[screen-slug-kebab-case]"
author: "[Họ Tên Dev / BA] <email@company.com>"
date: "2026-10-24"
version: "1.0.0"
status: "Draft" # Draft | In Review | Approved | Published | Deprecated
jira: "PROJECT-101"
figma: "https://www.figma.com/file/..."
tags: [CRUD, Export, Workflow, BackgroundJob, RBAC]
---

## Overview

### 1. Mục Đích & Bối Cảnh Nghiệp Vụ
- **Mục tiêu**: Mô tả lý do tính năng này ra đời, giải quyết bài toán gì cho doanh nghiệp hoặc người dùng.
- **Đối tượng sử dụng (Personas)**:
  - `Admin`: Toàn quyền cấu hình, phê duyệt và xuất dữ liệu.
  - `Manager`: Quản lý các bản ghi thuộc phạm vi đơn vị (OrgUnit).
  - `User`: Thao tác theo phân quyền chuẩn.
- **Workflow cốt lõi (User Journey)**:
  `Tạo dự thảo (Draft) → Nhập dữ liệu & validate → Trình duyệt/Publish → Xử lý nghiệp vụ → Kết thúc/Đóng`

### 2. Tiền Điều Kiện & Hậu Điều Kiện (Pre/Post Conditions)
- **Pre-conditions**: Người dùng đã đăng nhập, tài khoản còn hoạt động và có quyền hạn tương ứng.
- **Post-conditions**: Dữ liệu lưu vào database có đầy đủ Audit Logs (CreatedBy, CreatedAt).

---

## Features

### Danh Mục Tính Năng (Feature Matrix)

| # | Feature Code | Tên Tính Năng | Loại | Mức Độ | Trạng Thái | Mô Tả Nghiệp Vụ |
|---|--------------|---------------|------|--------|------------|-----------------|
| 1 | FEAT-001 | Danh Sách & Phân Trang | Read | P0 | Done | Hiển thị bảng dữ liệu phân trang, lọc theo trạng thái, tìm kiếm từ khóa |
| 2 | FEAT-002 | Tạo Mới Dữ Liệu | Create | P0 | Done | Mở form tạo mới, tự sinh mã định danh, validate client & server |
| 3 | FEAT-003 | Chỉnh Sửa Dữ Liệu | Update | P1 | Done | Chỉnh sửa thông tin chỉ khi bản ghi ở trạng thái Draft |
| 4 | FEAT-004 | Xóa / Hủy Bản Ghi | Delete | P1 | Done | Soft delete, giữ lại dữ liệu lịch sử phục vụ đối soát |
| 5 | FEAT-005 | Xuất Dữ Liệu (Excel/CSV) | Export | P2 | Done | Xuất dữ liệu theo bộ lọc hiện hành, giới hạn số dòng cho phép |

### Tiêu Chí Chấp Nhận (Acceptance Criteria - AC)

#### AC-01: Tìm kiếm & Lọc Dữ Liệu
- **Given**: Người dùng đang ở màn hình danh sách.
- **When**: Nhập từ khóa tìm kiếm (tối thiểu 2 ký tự) và nhấn Enter hoặc chọn bộ lọc trạng thái.
- **Then**: Hệ thống lọc danh sách kết quả trong vòng < 500ms, hiển thị số lượng bản ghi thỏa mãn. Nếu không có kết quả, hiển thị Empty State kèm nút xóa bộ lọc.

#### AC-02: Tạo Mới & Validate Dữ Liệu
- **Given**: Người dùng mở form tạo mới.
- **When**: Bỏ trống trường bắt buộc hoặc nhập sai định dạng.
- **Then**: Nút Lưu bị vô hiệu hóa hoặc hiển thị thông báo lỗi inline đỏ rõ ràng tại trường vi phạm.

---

## Business Rules

### BR-001: Quy Tắc Định Danh & Tự Sinh Mã [critical]
- **Mã hệ thống**: Sinh tự động theo định dạng `{PREFIX}-{YYYYMMDD}-{SEQUENCE_4}` (Ví dụ: `DOC-20261024-0001`).
- **Ràng buộc**: Bắt buộc là duy nhất (Unique), không cho phép người dùng chỉnh sửa trên giao diện (`Readonly`).
- **Thời điểm**: Được cấp phát khi lưu bản ghi vào hệ thống trong Transaction an toàn.

### BR-002: Ma Trận Phân Quyền Theo Role (RBAC) [critical]

| Hành Động | Admin | Manager | User | Guest |
|-----------|-------|---------|------|-------|
| Xem danh sách & chi tiết | ✅ Tất cả | ✅ Thuộc OrgUnit | ✅ Do mình tạo | ❌ |
| Tạo mới bản ghi | ✅ Cho phép | ✅ Cho phép | ⚠️ Cần cấp quyền | ❌ |
| Chỉnh sửa (Draft) | ✅ Cho phép | ✅ Thuộc OrgUnit | ✅ Chỉ của mình | ❌ |
| Chỉnh sửa (Published) | ⚠️ Chỉ Admin | ❌ | ❌ | ❌ |
| Xóa mềm bản ghi | ✅ Tất cả | ⚠️ Chỉ Draft | ❌ | ❌ |

### BR-003: Chính Sách Xóa Dữ Liệu (Soft Delete) [important]
- Tất cả thao tác xóa chỉ cập nhật cờ `IsDeleted = 1`, `DeletedAt = UtcNow()`, `DeletedBy = CurrentUserId`.
- Tuyệt đối không xóa vật lý (Hard Delete) để bảo toàn tính toàn vẹn tham chiếu cho các module liên kết.
- Các truy vấn đọc mặc định phải luôn lọc `WHERE IsDeleted = 0` (Global Query Filter).

### BR-004: Giới Hạn Tải & Thao Tác Đồng Thời (Concurrency) [important]
- Sử dụng cơ chế Optimistic Concurrency Control qua cột `RowVersion` / `UpdatedAt`.
- Khi 2 người dùng cùng sửa một bản ghi, người lưu sau sẽ nhận thông báo lỗi 409 Conflict: *"Dữ liệu đã được người khác cập nhật, vui lòng tải lại trang."*

---

## API Endpoints

### 1. GET /api/v1/resources
- **Mục đích**: Lấy danh sách tài nguyên có phân trang và bộ lọc.
- **Bảo mật**: `Bearer Token` + Quyền `Resource.Read`
- **Query Parameters**:
  - `page` (int, default: 1): Số trang (>= 1).
  - `pageSize` (int, default: 20, max: 100): Kích thước trang.
  - `search` (string, optional): Từ khóa tìm kiếm theo tên hoặc mã.
  - `status` (string, optional): Lọc theo trạng thái (`Draft`, `Published`, `Archived`).
  - `sort` (string, default: "-createdAt"): Trường sắp xếp (`+` tăng dần, `-` giảm dần).
- **Response 200 OK**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 101,
        "code": "RES-20261024-0001",
        "title": "Tên tài nguyên mẫu",
        "status": "Published",
        "author": "Nguyen Van A",
        "createdAt": "2026-10-24T02:00:00Z",
        "updatedAt": "2026-10-24T02:15:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalRecords": 105,
      "totalPages": 6
    }
  }
}
```

### 2. POST /api/v1/resources
- **Mục đích**: Khởi tạo bản ghi mới.
- **Bảo mật**: `Bearer Token` + Quyền `Resource.Create`
- **Headers**: `Content-Type: application/json`, `Idempotency-Key: <UUID>`
- **Request Body**:
```json
{
  "title": "Tên tài nguyên mới",
  "description": "Mô tả chi tiết tài nguyên...",
  "status": "Draft",
  "tags": ["CRUD", "Sample"]
}
```
- **Response 201 Created**:
```json
{
  "success": true,
  "data": {
    "id": 102,
    "code": "RES-20261024-0002",
    "title": "Tên tài nguyên mới",
    "status": "Draft",
    "createdAt": "2026-10-24T02:20:00Z"
  }
}
```
- **Response 400 Bad Request**:
```json
{
  "success": false,
  "errorCode": "VALIDATION_FAILED",
  "message": "Dữ liệu gửi lên không hợp lệ.",
  "errors": {
    "title": ["Trường tiêu đề là bắt buộc và không quá 255 ký tự."]
  }
}
```

---

## Database

### Cấu Trúc Bảng Dữ Liệu (Schema Definition)

#### Bảng: `Resources`

| Tên Cột | Kiểu Dữ Liệu | Khóa | Cho Phép Null | Giá Trị Mặc Định | Ghi Chú Nghiệp Vụ |
|---------|--------------|------|---------------|------------------|-------------------|
| `Id` | BIGINT | PK | ❌ NO | Auto Increment | Khóa chính bản ghi |
| `Code` | VARCHAR(50) | UK | ❌ NO | - | Mã định danh duy nhất |
| `Title` | NVARCHAR(255) | - | ❌ NO | - | Tiêu đề hiển thị |
| `Status` | VARCHAR(30) | - | ❌ NO | 'Draft' | Trạng thái (Draft, Published, Archived) |
| `IsDeleted` | BOOLEAN | - | ❌ NO | 0 | Cờ xóa mềm (Soft delete) |
| `CreatedBy` | VARCHAR(100) | - | ❌ NO | - | Tài khoản khởi tạo |
| `CreatedAt` | DATETIME2 | - | ❌ NO | SYSUTCDATETIME() | Thời điểm tạo (UTC) |
| `UpdatedBy` | VARCHAR(100) | - | ⚠️ YES | NULL | Tài khoản cập nhật sau cùng |
| `UpdatedAt` | DATETIME2 | - | ⚠️ YES | NULL | Thời điểm cập nhật (UTC) |

### Chỉ Mục & Ràng Buộc (Indexes & Constraints)
- `PK_Resources`: PRIMARY KEY (`Id`)
- `UK_Resources_Code`: UNIQUE INDEX (`Code`) WHERE `IsDeleted = 0`
- `IX_Resources_Status_Created`: INDEX (`Status`, `CreatedAt` DESC)
- `IX_Resources_Search`: Full-Text Search trên trường `Title`, `Description`

### Sơ Đồ Quan Hệ Dữ Liệu (ER Relationships)
- `Modules` (1) ─── 0..N ─── `Resources` (FK: `ModuleId`)
- `Resources` (1) ─── 0..N ─── `ResourceDetails` (FK: `ResourceId`)
- `Resources` (1) ─── 0..N ─── `AuditLogs` (FK: `EntityId`, Target: 'Resources')

---

## QA & Testing Guidelines

### Kế Hoạch & Ma Trận Kiểm Thử (QA Test Matrix)

| Test Case ID | Phân Loại | Kịch Bản Kiểm Thử | Điều Kiện Đầu Vào | Kết Quả Mong Đợi |
|--------------|-----------|-------------------|-------------------|------------------|
| TC-FUNC-001 | Happy Path | Tạo mới bản ghi hợp lệ với role Admin | Nhập đủ các trường bắt buộc, bấm Lưu | Tạo thành công (201), cấp mã hợp lệ, xuất hiện trên danh sách |
| TC-VAL-002 | Negative | Tạo bản ghi với Tiêu đề trống | Tiêu đề = "" | Báo lỗi 400 rõ ràng: "Trường tiêu đề là bắt buộc" |
| TC-VAL-003 | Boundary | Tạo bản ghi với Tiêu đề dài 256 ký tự (max 255) | Tiêu đề = 256 ký tự | Báo lỗi 400: Không vượt quá 255 ký tự |
| TC-SEC-004 | Security | User role bình thường cố xóa bản ghi Published | Gửi request `DELETE /api/v1/resources/101` | Trả về 403 Forbidden |
| TC-SEC-005 | Security | Kiểm tra tấn công SQL Injection & XSS | Nhập `' OR '1'='1` và `<script>alert(1)</script>` | Ký tự được sanitize an toàn, không thực thi script |
| TC-EDGE-006 | Edge Case | 2 users cùng lưu chỉnh sửa tại một thời điểm | Cùng edit bản ghi có Version 1 | User thứ hai nhận thông báo 409 Conflict |

---

## Configuration & Dependencies

### 1. Cấu Hình Ứng Dụng (AppSettings / Environment Variables)
```ini
# Resource Module Config
Resource:MaxBatchUpload = 50
Resource:DefaultPageSize = 20
Resource:MaxExportRows = 10000
Resource:IdPrefix = "RES"
Resource:EnableAuditLog = true
```

### 2. Feature Flags
- `Feature.ResourceExport`: Bật/tắt tính năng xuất Excel (Mặc định: `true`).
- `Feature.RealtimeNotification`: Bật thông báo qua WebSocket/SignalR (Mặc định: `false`).

### 3. Background Jobs
- `ResourceCleanUpJob`: Cron `0 2 * * *` (02:00 AM mỗi ngày) dọn dẹp các bản nháp mồ côi quá 90 ngày.

### 4. Gói Phụ Thuộc (Dependencies)
- **Backend Packages**:
  - `FluentValidation` v11.x: Quản lý validation rules tập trung.
  - `ClosedXML` v0.102.x: Hỗ trợ tạo file Excel hiệu năng cao.
- **Frontend Libraries**:
  - `lucide-react`: Hệ thống icon chuẩn giao diện.
  - `clsx`: Xử lý class linh hoạt.

---

## UI/UX & States

### 1. Quy Định Giao Diện & Hành Vi
- **Trạng thái tải (Loading State)**: Hiển thị Skeleton loader khi fetch dữ liệu, không làm giật layout.
- **Trạng thái rỗng (Empty State)**: Khi danh sách không có dữ liệu, hiển thị hình minh họa, thông điệp rõ ràng và nút kêu gọi hành động (CTA) "Tạo bản ghi mới".
- **Thông báo phản hồi (Feedback)**:
  - Thành công: Toast xanh lá góc phải màn hình, tự ẩn sau 3s.
  - Thất bại: Toast đỏ kèm mã lỗi và thông báo hướng dẫn xử lý.
- **Xác nhận hành động nguy hiểm**: Trước khi xóa bản ghi, bắt buộc hiển thị Modal Dialog xác nhận: *"Hành động này sẽ xóa dữ liệu. Bạn có chắc chắn muốn tiếp tục?"*

### 2. Tiêu Chuẩn Responsive (Mobile / Tablet / Desktop)
- **Desktop (>= 1024px)**: Hiển thị đầy đủ tất cả các cột của bảng dữ liệu và thanh lọc mở rộng.
- **Tablet (768px - 1023px)**: Rút gọn các cột thứ yếu, bảng có thanh cuộn ngang mượt mà.
- **Mobile (< 768px)**: Chuyển bảng dạng grid sang dạng Card view xếp chồng, ẩn các nút ít dùng vào menu Action dropdown, kích thước vùng bấm (touch target) tối thiểu 44x44px.

---

## Notes & Technical Debt

> [!WARNING]
> Tuyệt đối không thực hiện Hard Delete đối với các bản ghi đã liên kết với hóa đơn hoặc báo cáo nghiệp vụ.

> [!IMPORTANT]
> Tất cả các API chỉnh sửa phải kèm token xác thực hợp lệ và kiểm tra quyền hạn RBAC nghiêm ngặt tại middleware.

### Nợ Kỹ Thuật Cần Giải Quyết (Technical Debt)
- [ ] Bổ sung tầng Redis Caching cho API danh sách để giảm tải database khi lưu lượng truy cập cao.
- [ ] Nâng cấp tính năng xuất Excel từ synchronous sang asynchronous qua background worker đối với tập dữ liệu > 10,000 dòng.
- [ ] Bổ sung kiểm thử tự động E2E bằng Playwright cho luồng tạo và phê duyệt.
