# [METHOD] /api/v1/[endpoint-path]

## 1. Overview & Purpose
- **Mục đích**: Mô tả ngắn gọn chức năng của API endpoint này.
- **Microservice / Module**: [Tên Service, ví dụ: SurveyService, IdentityService]
- **Phân quyền truy cập (Authorization)**:
  - Required Header: `Authorization: Bearer <JWT_TOKEN>`
  - Required Roles / Scopes: `[ "Survey.Admin", "Survey.Manager" ]`

## 2. Request Contract

### 2.1 Route Parameters / Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | integer | Yes | - | ID bản ghi cần thao tác |
| `includeInactive` | boolean | No | `false` | Có lấy bản ghi đã hủy/hết hạn hay không |

### 2.2 Request Headers
- `Content-Type`: `application/json`
- `X-Correlation-ID`: `<GUID>` (Dùng để trace log qua các microservices)

### 2.3 Request Body Schema
```json
{
  "title": "string (min: 5, max: 255, required)",
  "categoryCode": "string (required)",
  "startTime": "ISO 8601 UTC timestamp (required)",
  "endTime": "ISO 8601 UTC timestamp (required, must be after startTime)",
  "isAnonymous": "boolean (default: false)"
}
```

## 3. Response Contract

### 3.1 Success Responses
- **200 OK** (hoặc **201 Created**):
```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "id": 1024,
    "surveyCode": "SRV-20261024-0012",
    "status": "Draft",
    "createdAt": "2026-10-24T08:30:00Z"
  }
}
```

### 3.2 Error Responses
| HTTP Status | Error Code | Triggers / Condition | Description & Action |
|-------------|------------|----------------------|----------------------|
| `400 Bad Request` | `VALIDATION_FAILED` | Bỏ trống trường bắt buộc hoặc EndTime <= StartTime | Client kiểm tra form và hiển thị inline lỗi |
| `401 Unauthorized` | `AUTH_TOKEN_EXPIRED` | Token JWT hết hạn hoặc không hợp lệ | Refresh token hoặc đăng nhập lại |
| `403 Forbidden` | `INSUFFICIENT_PERMISSIONS` | Tài khoản không có quyền thao tác trên OrgUnit này | Báo lỗi không có quyền truy cập |
| `404 Not Found` | `SURVEY_NOT_FOUND` | ID không tồn tại hoặc đã bị xóa mềm | Thông báo bản ghi không tồn tại |
| `409 Conflict` | `CONCURRENCY_CONFLICT` | RowVersion không khớp (bản ghi bị sửa bởi người khác) | Yêu cầu người dùng reload lại dữ liệu mới nhất |

## 4. Performance & SLA Requirements
- **SLA P95 Response Time**: < 150ms
- **Throughput target**: >= 1,000 RPS
- **Idempotency**: Requests tạo mới hoặc sửa phải hỗ trợ header `Idempotency-Key: <UUID>` để chống duplicate khi network retry.
