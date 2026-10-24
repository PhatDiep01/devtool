# 🚀 DevToolkit & Handover Docs Platform (`docs_tooldev`)

Trung tâm tài liệu bàn giao kỹ thuật chuẩn mực (Handover Documentation Portal) và bộ công cụ DevToolkit dành riêng cho BA, Software Engineer, QA và DevOps.

---

## 📁 Cấu Trúc Thư Mục Chuẩn Nghiệp Vụ

```
d:\Source\docs_tooldev\
├── devtoolkit/                  # SOURCE CODE BỘ CÔNG CỤ (Frontend + Backend + Tools)
│   ├── backend/                 # Express API + Node.js Built-in SQLite + FTS5
│   │   ├── src/
│   │   │   ├── db/              # SQLite schema, indexes & auto-migration
│   │   │   ├── middleware/      # Constant-time auth & security middleware
│   │   │   ├── routes/          # Handover docs, secure file upload, Jira proxy, settings
│   │   │   └── services/        # Safe file manager (path traversal proof), markdown parser
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── frontend/                # React 18 + Vite + Tailwind CSS + Lucide Icons
│   │   ├── src/
│   │   │   ├── components/      # Responsive AppShell (mobile drawer + desktop rail), Topbar, CommandPalette
│   │   │   ├── modules/docs/    # Handover Dashboard, Module Screens, Screen Detail (10 chuyên mục BA/Dev/QA), MarkdownRenderer
│   │   │   ├── modules/jira/    # Responsive Kanban Board & Sprint issue manager
│   │   │   └── modules/settings/# Jira Cloud connection, storage stats, appearance themes
│   │   └── package.json
│   │
│   ├── scripts/                 # Batch automation scripts (start-all.bat, start-backend.bat, start-tunnel.bat)
│   └── templates/               # Mẫu bàn giao kỹ thuật chuẩn (screen-template.md, example-survey-management.md)
│
└── data_docs_tooldev/           # PERSISTENT DATA REPOSITORY (Dữ liệu lưu trữ độc lập an toàn)
    ├── devtoolkit.db            # Cơ sở dữ liệu SQLite3 (WAL mode, FTS5 full-text index)
    ├── docs/
    │   └── modules/             # File markdown gốc phân loại theo Domain/Module
    │       ├── survey-management/
    │       │   └── survey-management-screen.md   # Mẫu khảo sát đầy đủ chuẩn BA/Dev/QA
    │       └── general/
    ├── images/                  # Screenshots, mockup UI và sơ đồ ER đính kèm
    ├── schemas/                 # OpenAPI JSON specs, SQL DDL scripts, JSON validation schemas
    ├── backups/                 # Bản sao lưu định kỳ database & tài liệu
    └── templates/               # Kho template phiên bản hóa
```

---

## 🛡️ Điểm Nổi Bật Về Nghiệp Vụ & Kỹ Thuật

1. **Chuẩn Hóa Nghiệp Vụ Handover Toàn Diện (BA - Dev - QA)**:
   - **Overview**: Bối cảnh, mục tiêu kinh doanh, chân dung người dùng (Personas), luồng trải nghiệm (User Journey).
   - **Features & Acceptance Criteria**: Ma trận tính năng (P0/P1/P2), tiêu chí nghiệm thu chi tiết (Given-When-Then).
   - **Business Rules & RBAC**: Quy tắc nghiệp vụ phân cấp `[critical]`, `[important]`, `[info]`, ma trận phân quyền chi tiết theo vai trò.
   - **API Endpoints**: Hợp đồng API chuẩn RESTful, headers, query params, request body, các mã phản hồi 200, 201, 400, 403, 404, 500.
   - **Database & ER Schema**: Thiết kế bảng, kiểu dữ liệu, khóa chính/ngoại, indexes, soft delete, quan hệ thực thể.
   - **QA Guidelines & Test Matrix**: Bộ test cases mẫu (Happy path, Negative, Boundary testing, Security injection, Concurrency race conditions).
   - **Configuration & Dependencies**: Biến môi trường, Feature Flags, Background Cron Jobs (Hangfire), thư viện tích hợp (ClosedXML, SendGrid).
   - **UI/UX & States**: Loading skeletons, Empty states, xác nhận thao tác nguy hiểm, tiêu chuẩn responsive đa thiết bị.

2. **Giao Diện Hiện Đại & Responsive Hoàn Hảo**:
   - Tối ưu hóa mượt mà cho **Mobile (< 768px)**, **Tablet (768px - 1023px)** và **Desktop (>= 1024px)**.
   - **Mobile Drawer & Hamburger Menu**: Thanh điều hướng trượt sang với vùng chạm chuẩn 44px, backdrop mờ sang trọng.
   - **Adaptive Topbar**: Tự co giãn thanh tìm kiếm thông minh, phím tắt `⌘K` / `Ctrl+K`.
   - **Bảng Dữ Liệu Tự Cuộn (Responsive Tables)**: Cuộn ngang mượt mà kèm thanh trượt mỏng `scrollbar-thin`, xen kẽ màu nền dễ đọc.
   - **Chế Độ Sáng/Tối (Dark/Light Mode)**: Phối màu chuẩn Linear/Vercel với độ tương phản cao, dịu mắt khi làm việc ban đêm.
   - **Kanban Board Linh Hoạt**: Cung cấp bộ lọc cột nhanh trên thiết bị di động, không bị méo hay tràn màn hình.

3. **Bảo Mật & Kiến Trúc Tối Ưu (Zero Vulnerabilities)**:
   - **Chống Path Traversal**: Hàm `assertPathInside` và `sanitizeSlug` ngăn chặn tuyệt đối các kỹ thuật tấn công chèn `../` hoặc thao tác ngoài thư mục cho phép.
   - **Chống Stored XSS**: Bộ lọc upload ảnh kiểm tra định dạng an toàn, chặn mã script trong file SVG.
   - **Chống Lỗ Hổng Timing Attack**: Sử dụng `crypto.timingSafeEqual` khi so khớp token xác thực.
   - **Chống FTS Injection**: Làm sạch chuỗi tìm kiếm trước khi định dạng truy vấn SQLite FTS5, tự động fallback về câu lệnh LIKE an toàn khi có cú pháp lạ.
   - **Zero Compilation Dependency**: Sử dụng module chuẩn `node:sqlite` của Node.js v24, không cần cài đặt Python hay Visual C++ Build Tools.

---

## ⚡ Hướng Dẫn Vận Hành

### Cách 1: Khởi Động Nhanh Toàn Bộ (1-Click)
Chạy script:
```cmd
d:\Source\docs_tooldev\devtoolkit\scripts\start-all.bat
```

### Cách 2: Khởi Động Từng Thành Phần
- **Backend API**:
  ```powershell
  cd d:\Source\docs_tooldev\devtoolkit\backend
  npm run dev
  ```
  API hoạt động tại: `http://localhost:3001`
  Data directory kết nối tự động: `d:\Source\docs_tooldev\data_docs_tooldev`

- **Frontend Application**:
  ```powershell
  cd d:\Source\docs_tooldev\devtoolkit\frontend
  npm run dev
  ```
  Truy cập giao diện tại: `http://localhost:5173`
