---
title: "Quản Lý Khảo Sát & Đánh Giá"
module: "Survey Management"
screen: "survey-management-screen"
author: "Lead Tech & BA Team <techlead@company.com>"
date: "2026-10-24"
version: "1.2.0"
status: "Published"
jira: "SURVEY-101"
figma: "https://www.figma.com/file/survey-management-spec"
tags: [Survey, CRUD, Export, Hangfire, SendGrid, RBAC, SoftDelete]
---

## Overview

### 1. Mục Đích & Bối Cảnh Nghiệp Vụ
Màn hình **Quản Lý Khảo Sát & Đánh Giá** là phân hệ trung tâm cho phép quản trị viên và các phòng ban tổ chức, phát hành và tổng hợp dữ liệu khảo sát trực tuyến trong toàn hệ thống.

- **Mục tiêu**: Tối ưu hóa chu trình từ lúc soạn thảo câu hỏi, phát hành có hẹn giờ, thu thập câu trả lời ẩn danh hoặc định danh, đến xuất báo cáo phân tích.
- **Đối tượng sử dụng (Personas)**:
  - `Super Admin`: Toàn quyền quản trị khảo sát, cấu hình mẫu chung toàn cơ quan và đối soát audit log.
  - `Department Manager`: Soạn thảo và quản lý các cuộc khảo sát thuộc phạm vi Đơn vị (OrgUnit) phụ trách.
  - `Survey Auditor / QA`: Kiểm thử luồng câu hỏi, xem trước khảo sát và kiểm toán kết quả phản hồi.
- **Luồng nghiệp vụ chính (End-to-End Workflow)**:
  `Soạn thảo (Draft) → Thêm danh mục câu hỏi & lựa chọn → Kiểm duyệt nội dung → Publish (Gửi email + Notify) → Tiếp nhận phản hồi (In-Progress) → Đóng khảo sát / Tự động hết hạn (Expired) → Kết xuất báo cáo (Export Excel)`

### 2. Tiền Điều Kiện & Hậu Điều Kiện
- **Tiền điều kiện**: Người dùng có tài khoản đang kích hoạt và thuộc danh sách quyền hạn Quản lý Khảo sát.
- **Hậu điều kiện**: Khảo sát khi Publish sẽ kích hoạt hàng đợi gửi thông báo SendGrid và tự động lên lịch Background Job kiểm tra hạn chót.

---

## Features

### Danh Mục Tính Năng (Feature Matrix)

| # | Mã Tính Năng | Tên Tính Năng | Phân Loại | Ưu Tiên | Trạng Thái | Mô Tả Nghiệp Vụ |
|---|--------------|---------------|-----------|---------|------------|-----------------|
| 1 | FEAT-SV-01 | Danh Sách Khảo Sát Phân Trang | Read | P0 | Done | Grid hiển thị danh sách có phân trang, bộ lọc đa tiêu chí (Trạng thái, Ngày tạo, Đơn vị) |
| 2 | FEAT-SV-02 | Tạo Mới Khảo Sát | Create | P0 | Done | Khởi tạo khảo sát, tự động cấp mã định danh duy nhất theo ngày, hỗ trợ gắn cờ ẩn danh |
| 3 | FEAT-SV-03 | Cập Nhật Khảo Sát | Update | P0 | Done | Chỉnh sửa thông tin tiêu đề, thời gian bắt đầu/kết thúc (chỉ áp dụng khi ở trạng thái Draft) |
| 4 | FEAT-SV-04 | Phát Hành Khảo Sát (Publish) | Workflow | P0 | Done | Chuyển trạng thái từ Draft sang Published, gửi email qua SendGrid và kích hoạt Hangfire job |
| 5 | FEAT-SV-05 | Xóa Khảo Sát (Soft Delete) | Delete | P1 | Done | Xóa mềm, bảo lưu toàn vẹn dữ liệu phản hồi của người tham gia |
| 6 | FEAT-SV-06 | Xuất Báo Cáo Ra Excel | Export | P1 | Done | Xuất toàn bộ danh sách khảo sát và số lượng phản hồi ra file Excel định dạng chuẩn |
| 7 | FEAT-SV-07 | Tự Động Hết Hạn (Auto Expire) | Background Job | P1 | Done | Job định kỳ 00:00 hàng ngày chuyển các khảo sát quá hạn sang trạng thái Expired |
| 8 | FEAT-SV-08 | Phân Quyền Dữ Liệu Theo OrgUnit | Security | P0 | Done | Global query filter giới hạn dữ liệu theo chi nhánh/phòng ban của tài khoản đăng nhập |

### Tiêu Chí Chấp Nhận Chi Tiết (Acceptance Criteria - AC)

#### AC-01: Quy Trình Publish Khảo Sát
- **Given**: Khảo sát đang ở trạng thái `Draft`, người dùng có quyền `Admin` hoặc `Manager` chủ quản.
- **When**: Nhấn nút "Publish" và xác nhận tại hộp thoại.
- **Then**:
  - Hệ thống kiểm tra điều kiện: Khảo sát phải có ít nhất 1 câu hỏi và `EndDate > StartDate > Now`.
  - Nếu thỏa mãn: Trạng thái đổi thành `Published`, trường `PublishedAt` cập nhật giờ UTC, gửi email thông báo thành công đến nhóm người dùng mục tiêu.
  - Nếu không thỏa mãn: Trả về mã lỗi 400 kèm thông điệp chi tiết lý do từ chối.

#### AC-02: Cơ Chế Xóa An Toàn (Soft Delete)
- **Given**: Khảo sát đã có người dùng gửi phản hồi (Responses count > 0).
- **When**: Quản trị viên thực hiện xóa khảo sát.
- **Then**:
  - Cập nhật trường `IsDeleted = 1`, `DeletedAt = UtcNow()`.
  - Bản ghi ẩn khỏi giao diện chung, nhưng toàn bộ bảng phản hồi liên quan vẫn được lưu trữ đầy đủ trong database để báo cáo kiểm toán.

---

## Business Rules

### BR-SV-001: Quy Tắc Đặt Mã Khảo Sát Tự Động [critical]
- **Định dạng**: `SV-{YYYYMMDD}-{SEQUENCE_4}` (Ví dụ: `SV-20261024-0001`, `SV-20261024-0002`).
- **Nguyên tắc**: Sequence đếm tăng dần và tự động reset về `0001` vào 00:00 mỗi ngày.
- **Ràng buộc UI**: Trường này là **Chỉ đọc (Read-only)**, người dùng tuyệt đối không thể tự nhập hoặc can thiệp trên giao diện.

### BR-SV-002: Ma Trận Phân Quyền Thao Tác (RBAC Matrix) [critical]

| Thao Tác Nghiệp Vụ | Super Admin | Department Manager | Regular User | Khách Vãng Lai |
|--------------------|-------------|--------------------|--------------|----------------|
| Xem danh sách khảo sát | ✅ Toàn hệ thống | ✅ Thuộc OrgUnit mình | ✅ Chỉ khảo sát được mời | ❌ |
| Tạo khảo sát mới | ✅ Cho phép | ✅ Cho phép | ❌ | ❌ |
| Sửa khảo sát (Draft) | ✅ Cho phép | ✅ Thuộc OrgUnit | ❌ | ❌ |
| Sửa khảo sát (Published) | ⚠️ Chỉ sửa ngày kết thúc | ❌ | ❌ | ❌ |
| Publish khảo sát | ✅ Cho phép | ✅ Thuộc OrgUnit | ❌ | ❌ |
| Xóa khảo sát | ✅ Soft Delete | ⚠️ Chỉ xóa bản nháp (Draft) | ❌ | ❌ |
| Xuất dữ liệu Excel | ✅ Toàn quyền | ✅ Thuộc OrgUnit | ❌ | ❌ |

### BR-SV-003: Điều Kiện Ràng Buộc Thời Gian Hiệu Lực [important]
- `StartDate` phải lớn hơn hoặc bằng thời điểm hiện tại khi tạo mới (`StartDate >= Now`).
- `EndDate` bắt buộc phải lớn hơn `StartDate` ít nhất 1 giờ.
- Khi thời gian thực tế chạm mốc `EndDate`, khảo sát tự động chuyển sang chế độ không cho tiếp nhận câu trả lời mới (`IsClosed = true`).

### BR-SV-004: Khảo Sát Ẩn Danh (Anonymous Privacy) [important]
- Khi cờ `IsAnonymous = true` được bật:
  - Hệ thống không ghi nhận thông tin `UserId`, `UserEmail`, hoặc `IPAddress` vào bảng `SurveyResponses`.
  - Phản hồi được mã hóa một chiều qua mã Hash phiên làm việc ngẫu nhiên để chống gian lận trả lời nhiều lần mà vẫn bảo toàn tính riêng tư tuyệt đối.

---

## API Endpoints

### 1. GET /api/v1/surveys
- **Mục đích**: Lấy danh sách khảo sát có phân trang, tìm kiếm và lọc dữ liệu.
- **Xác thực**: `Bearer Token` + Role `Admin, Manager`
- **Query Parameters**:
  - `page` (number, default: 1): Số trang cần lấy.
  - `pageSize` (number, default: 20, max: 100): Số lượng bản ghi mỗi trang.
  - `search` (string, optional): Tìm kiếm theo tiêu đề hoặc mã khảo sát.
  - `status` (string, optional): Lọc theo trạng thái (`Draft`, `Published`, `Expired`, `Closed`).
  - `orgUnitId` (number, optional): Lọc theo mã đơn vị phòng ban.
- **Response 200 OK**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 42,
        "code": "SV-20261024-0001",
        "title": "Khảo sát mức độ hài lòng dịch vụ nội bộ Q4/2026",
        "status": "Published",
        "startDate": "2026-11-01T08:00:00Z",
        "endDate": "2026-12-31T17:00:00Z",
        "orgUnitId": 5,
        "orgUnitName": "Khối Công Nghệ Thông Tin",
        "isAnonymous": true,
        "questionCount": 15,
        "responseCount": 342,
        "createdBy": "techlead@company.com",
        "createdAt": "2026-10-24T02:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalRecords": 85,
      "totalPages": 5
    }
  }
}
```

### 2. POST /api/v1/surveys
- **Mục đích**: Khởi tạo khảo sát mới ở trạng thái dự thảo.
- **Xác thực**: `Bearer Token` + Role `Admin, Manager`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "title": "Đánh giá chất lượng môi trường làm việc 2026",
  "description": "Thu thập ý kiến đóng góp từ toàn thể nhân sự",
  "startDate": "2026-11-01T08:00:00Z",
  "endDate": "2026-11-30T18:00:00Z",
  "orgUnitId": 5,
  "isAnonymous": true
}
```
- **Response 201 Created**:
```json
{
  "success": true,
  "data": {
    "id": 43,
    "code": "SV-20261024-0002",
    "title": "Đánh giá chất lượng môi trường làm việc 2026",
    "status": "Draft",
    "createdAt": "2026-10-24T02:25:00Z"
  }
}
```
- **Response 400 Bad Request**:
```json
{
  "success": false,
  "errorCode": "VALIDATION_ERROR",
  "message": "Dữ liệu nhập vào không hợp lệ",
  "errors": {
    "endDate": ["Thời gian kết thúc phải lớn hơn thời gian bắt đầu."]
  }
}
```

### 3. POST /api/v1/surveys/{id}/publish
- **Mục đích**: Phát hành khảo sát ra công chúng và kích hoạt email thông báo.
- **Xác thực**: `Bearer Token` + Role `Admin, Manager`
- **Response 200 OK**: `{ "success": true, "message": "Khảo sát đã phát hành thành công." }`
- **Response 400 Bad Request**: `{ "success": false, "message": "Khảo sát phải có tối thiểu 1 câu hỏi trước khi phát hành." }`

### 4. GET /api/v1/surveys/{id}/export
- **Mục đích**: Tải xuống file Excel báo cáo chi tiết phản hồi khảo sát.
- **Headers**: `Accept: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **Giới hạn**: Tối đa 10,000 dòng. Vượt quá sẽ kích hoạt xuất ngầm qua email.

---

## Database

### Cấu Trúc Bảng Dữ Liệu (Schema DDL)

#### Bảng: `Surveys` (Bảng chính lưu trữ khảo sát)

| Tên Cột | Kiểu Dữ Liệu | Ràng Buộc | Nullable | Mặc Định | Ý Nghĩa Nghiệp Vụ |
|---------|--------------|-----------|----------|----------|-------------------|
| `Id` | BIGINT | PK, Identity | NO | - | Khóa chính tự tăng |
| `Code` | VARCHAR(50) | Unique Index | NO | - | Mã khảo sát tự sinh (SV-YYYYMMDD-XXXX) |
| `Title` | NVARCHAR(255) | Full-Text | NO | - | Tên khảo sát |
| `Description` | NVARCHAR(MAX) | - | YES | NULL | Mô tả chi tiết mục đích khảo sát |
| `Status` | VARCHAR(30) | Index | NO | 'Draft' | Trạng thái (Draft, Published, Expired, Closed) |
| `StartDate` | DATETIME2 | - | NO | - | Ngày bắt đầu nhận phản hồi |
| `EndDate` | DATETIME2 | Index | NO | - | Ngày hết hạn nhận phản hồi |
| `OrgUnitId` | INT | FK, Index | NO | - | Đơn vị chủ quản khảo sát |
| `IsAnonymous` | BOOLEAN | - | NO | 0 | Cờ ẩn danh thông tin người phản hồi |
| `IsDeleted` | BOOLEAN | Index | NO | 0 | Cờ xóa mềm (1 = Đã xóa) |
| `CreatedBy` | VARCHAR(100) | - | NO | - | Tài khoản khởi tạo |
| `CreatedAt` | DATETIME2 | - | NO | SYSUTCDATETIME() | Thời điểm tạo bản ghi |
| `UpdatedBy` | VARCHAR(100) | - | YES | NULL | Tài khoản cập nhật cuối |
| `UpdatedAt` | DATETIME2 | Index | YES | NULL | Thời điểm cập nhật cuối |

#### Bảng Phụ Trợ & Liên Kết:
1. `SurveyQuestions`: Lưu nội dung câu hỏi (`SurveyId`, `QuestionText`, `QuestionType`, `SortOrder`, `IsRequired`).
2. `SurveyQuestionOptions`: Lưu các lựa chọn trắc nghiệm (`QuestionId`, `OptionText`, `Score`).
3. `SurveyResponses`: Đầu mục phiếu trả lời (`SurveyId`, `UserId` [Nullable nếu Anonymous], `SubmittedAt`).
4. `SurveyResponseDetails`: Chi tiết câu trả lời của từng câu hỏi (`ResponseId`, `QuestionId`, `AnswerValue`).

### Sơ Đồ Quan Hệ Bảng (ER Diagram)
- `Surveys` (1) ─── 0..N ─── `SurveyQuestions` (Khóa ngoại: `SurveyId`, On Delete: Cascade)
- `SurveyQuestions` (1) ─── 0..N ─── `SurveyQuestionOptions` (Khóa ngoại: `QuestionId`)
- `Surveys` (1) ─── 0..N ─── `SurveyResponses` (Khóa ngoại: `SurveyId`, Soft delete safe)
- `SurveyResponses` (1) ─── 1..N ─── `SurveyResponseDetails` (Khóa ngoại: `ResponseId`)

---

## QA & Testing Guidelines

### Ma Trận Kiểm Thử Nghiệp Vụ & Kỹ Thuật (QA Test Matrix)

| Mã Test Case | Loại Kiểm Thử | Kịch Bản & Hành Động | Dữ Liệu Đầu Vào | Kết Quả Mong Đợi Chuẩn |
|--------------|---------------|----------------------|-----------------|------------------------|
| TC-SV-001 | Functional (P0) | Tạo khảo sát hợp lệ | Tiêu đề: "Khảo sát Test", StartDate: Mai, EndDate: Tuần tới | Tạo thành công 201, sinh mã `SV-{Date}-0001`, status Draft |
| TC-SV-002 | Validation (P0) | Tạo khảo sát có EndDate < StartDate | StartDate: 2026-11-10, EndDate: 2026-11-05 | Chặn 400 Bad Request, message lỗi tại trường EndDate |
| TC-SV-003 | Workflow (P0) | Publish khảo sát chưa có câu hỏi nào | Khảo sát ID = 42 có 0 câu hỏi | Báo lỗi 400: "Khảo sát phải có ít nhất 1 câu hỏi" |
| TC-SV-004 | Security (P0) | Department Manager xem khảo sát của phòng ban khác | Manager A truy cập khảo sát OrgUnit B | Không thấy trong danh sách, truy cập trực tiếp trả về 403 Forbidden |
| TC-SV-005 | Security (P1) | Kiểm tra rò rỉ danh tính trong khảo sát ẩn danh | Gửi response khi `IsAnonymous = true` | Bảng `SurveyResponses` ghi nhận `UserId = NULL`, không lưu IP |
| TC-SV-006 | Performance (P1)| Tải danh sách 50,000 bản ghi phân trang | Truy cập trang 1, trang 100, trang 500 | Phản hồi < 300ms nhờ Index trên cột `Status` và `CreatedAt` |
| TC-SV-007 | Concurrency (P2)| 2 Admin cùng nhấn Publish đồng thời | 2 request gửi đồng thời cách nhau 10ms | Chỉ 1 request thành công, request thứ hai trả về trạng thái hợp lệ |

---

## Configuration & Dependencies

### 1. Biến Cấu Hình Ứng Dụng (AppSettings)
```ini
# Survey Module Core Settings
Survey:MaxQuestionsPerSurvey = 100
Survey:MaxOptionsPerQuestion = 20
Survey:DefaultPageSize = 20
Survey:MaxDirectExportRows = 10000
Survey:CodePrefix = "SV"

# Background Job Schedule
Survey:ExpirationCron = "0 0 * * *"

# Third Party Integrations
SendGrid:ApiKey = "SG.production_secret_key"
SendGrid:SenderEmail = "survey-noreply@company.com"
```

### 2. Feature Flags
- `Feature.Survey.ExcelExport`: Bật/tắt tính năng xuất file Excel trực tiếp (Mặc định: `true`).
- `Feature.Survey.PublicSharingLink`: Cho phép chia sẻ link khảo sát công khai (Mặc định: `true`).
- `Feature.Survey.AICumulativeSummary`: (Roadmap v2) Tự động tóm tắt ý kiến khảo sát bằng AI (Mặc định: `false`).

### 3. Gói Phụ Thuộc (Libraries & Packages)
- **Backend (.NET / Node)**:
  - `ClosedXML` v0.102.2: Thư viện xuất Excel tốc độ cao.
  - `Hangfire` v1.8.x: Trình lập lịch tác vụ nền cho `SurveyExpirationJob`.
  - `SendGrid` v9.28.x: SDK gửi email thông báo tự động.
- **Frontend (React)**:
  - `lucide-react`: Bộ icon chuẩn cho các hành động CRUD và trạng thái.
  - `date-fns`: Xử lý định dạng ngày tháng và múi giờ quốc tế.

---

## UI/UX & States

### 1. Quy Định Giao Diện & Trạng Thái
- **Trạng thái bảng dữ liệu**:
  - `Loading`: Hiển thị Skeleton 5 dòng với hiệu ứng shimmer mượt mà.
  - `Empty`: Hiển thị icon hộp rỗng kèm thông điệp: *"Chưa có cuộc khảo sát nào được tạo. Hãy nhấn 'Tạo Khảo Sát Mới' để bắt đầu."*
  - `Error`: Hiển thị cảnh báo màu đỏ kèm nút "Thử lại".
- **Hộp thoại xác nhận (Confirmation Modal)**:
  - Khi xóa: *"Bạn có chắc chắn muốn xóa cuộc khảo sát [Mã khảo sát]? Thao tác này sẽ ẩn khảo sát khỏi hệ thống nhưng bảo lưu dữ liệu phản hồi."*
  - Khi Publish: *"Khảo sát sau khi phát hành sẽ gửi thông báo đến các thành viên liên quan. Bạn có muốn tiếp tục?"*

### 2. Thiết Kế Responsive Đa Thiết Bị
- **Desktop (>= 1024px)**: Đầy đủ các cột: Mã, Tiêu đề, Thời gian, Số câu hỏi, Phản hồi, Trạng thái, Thao tác.
- **Tablet (768px - 1023px)**: Rút gọn các cột không quan trọng, hỗ trợ cuộn ngang mượt mà với thanh trượt mỏng.
- **Mobile (< 768px)**:
  - Chuyển từ dạng bảng sang dạng **Thẻ thông tin (Card View)** xếp dọc.
  - Nút bấm hành động (Tạo mới, Lọc, Xuất) có chiều cao tối thiểu 44px phục vụ thao tác chạm ngón tay.
  - Menu phân loại trạng thái hỗ trợ cuộn vuốt ngang (Horizontal Swipe).

---

## Notes & Technical Debt

> [!WARNING]
> Tuyệt đối **KHÔNG Hard Delete** bất kỳ khảo sát nào đã có người dùng tham gia trả lời để tránh làm sai lệch báo cáo tổng hợp.

> [!IMPORTANT]
> Cần đảm bảo hệ thống SendGrid có cấu hình SPF, DKIM và DMARC hợp lệ để tránh email thông báo bị rơi vào hộp thư rác (Spam folder).

### Nợ Kỹ Thuật (Technical Debt)
- [ ] Bổ sung cơ chế **Distributed Redis Lock** khi sinh mã khảo sát để đảm bảo tính tuần tự tuyệt đối trong môi trường Multi-Server.
- [ ] Nâng cấp xuất dữ liệu lớn (> 10,000 dòng) sang cơ chế bất đồng bộ qua Hangfire và gửi link tải qua email.
- [ ] Bổ sung tính năng Khóa chỉnh sửa đồng thời (Optimistic Locking) khi 2 quản trị viên cùng mở một bản nháp khảo sát.
