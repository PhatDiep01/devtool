# 🚀 DevToolkit - Setup & Operation Guide

Personal Developer Toolkit với kiến trúc:
- **Frontend**: React 18 + Vite + Tailwind + Lucide Icons (Deploy trên **Firebase Hosting**)
- **Backend API**: Express + TypeScript + **SQLite** + Multer + Jira API Proxy (Chạy **Local trên máy của bạn**)
- **Networking**: **Cloudflare Tunnel** (Mở tunnel public an toàn cho máy local về domain của bạn)

---

## 1. Cấu trúc thư mục

```
d:\Source\devtoolkit\
├── backend/                   # Local Express API + SQLite
│   ├── src/
│   │   ├── routes/            # Docs, Files, Jira, Settings, Auth
│   │   ├── services/          # Markdown parser, File manager
│   │   └── db/sqlite.ts       # SQLite Schema & Full-text search (FTS5)
│   ├── data/
│   │   ├── docs/modules/      # Lưu trữ file .md gốc
│   │   └── images/            # Lưu trữ screenshots upload
│   └── .env
│
├── frontend/                  # React SPA
│   ├── src/
│   │   ├── modules/docs/      # Handover Docs viewer & import
│   │   ├── modules/jira/      # Jira Dashboard & Kanban Board
│   │   └── modules/settings/  # Cấu hình Jira & Theme
│   └── firebase.json          # Cấu hình deploy Firebase Hosting
│
├── templates/
│   ├── screen-template.md     # Template chuẩn cho Dev viết handover doc
│   └── example-survey-management.md # File mẫu thực tế đầy đủ
│
└── scripts/
    ├── start-backend.bat      # Chạy backend local
    ├── start-tunnel.bat       # Khởi động Cloudflare Tunnel
    └── start-all.bat          # Khởi động toàn bộ chỉ bằng 1 click
```

---

## 2. Hướng dẫn chạy thử nghiệm tại Local

### Bước 1: Khởi động Backend
```powershell
cd d:\Source\devtoolkit\backend
npm install
npm run dev
```
Backend sẽ khởi chạy tại: `http://localhost:3001` (SQLite tự động khởi tạo trong thư mục `data/devtoolkit.db`).

### Bước 2: Khởi động Frontend
```powershell
cd d:\Source\devtoolkit\frontend
npm install
npm run dev
```
Frontend sẽ chạy tại: `http://localhost:5173`.

---

## 3. Kết nối Cloudflare Tunnel (Miễn phí & Bảo mật)

### Cài đặt Cloudflare Tunnel:
```powershell
winget install Cloudflare.cloudflared
```

### Cách 1: Quick Tunnel (Không cần sở hữu domain)
```powershell
cloudflared tunnel --url http://localhost:3001
```
Terminal sẽ in ra 1 link dạng `https://xxxx.trycloudflare.com`.

### Cách 2: Named Tunnel với Custom Domain
1. Đăng nhập: `cloudflared tunnel login`
2. Tạo tunnel: `cloudflared tunnel create devtoolkit`
3. Route DNS: `cloudflared tunnel route dns devtoolkit devapi.your-domain.com`
4. Chạy tunnel: `cloudflared tunnel run devtoolkit`

---

## 4. Deploy Frontend lên Firebase Hosting

1. Cài đặt Firebase CLI:
```powershell
npm install -g firebase-tools
```
2. Đăng nhập và liên kết dự án:
```powershell
cd d:\Source\devtoolkit\frontend
firebase login
firebase init hosting
```
3. Cập nhật file `.env.production` với URL backend (link từ Cloudflare Tunnel):
```env
VITE_API_URL=https://devapi.your-domain.com
```
4. Build và Deploy:
```powershell
npm run build
firebase deploy --only hosting
```

---

## 5. Quy trình Dev sử dụng hàng ngày

1. **Dev làm xong 1 màn hình**: Copy template từ `templates/screen-template.md`
2. Điền thông tin theo các mục: Overview, Features, Business Rules, API Endpoints, DB, Config, Notes.
3. Mở web DevToolkit -> Chọn **Import Markdown** (hoặc kéo thả file `.md` và hình ảnh đính kèm).
4. Hệ thống tự động phân loại, index vào SQLite (hỗ trợ tìm kiếm toàn văn FTS5) và hiển thị giao diện chi tiết phân tab cho cả BA, QA và Dev cùng xem!
