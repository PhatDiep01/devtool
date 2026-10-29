# DevToolkit Design System Tokens (v1.3)

Tài liệu đặc tả hệ thống Design Tokens dùng chung cho toàn bộ giao diện DevToolkit, tuân thủ tiêu chuẩn thiết kế cao cấp, thẩm mỹ tối giản (Pro Developer UX), nhất quán và đạt chuẩn tiếp cận WCAG AA.

---

## 1. Họ Font (Typography Stack)

| Nhóm | Token / Class | Font Family | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| **Giao diện chính** | `font-sans` | `Inter`, `ui-sans-serif`, `system-ui`, `-apple-system`, `sans-serif` | Toàn bộ text, tiêu đề, menu, bảng biểu, modal, nút bấm. Hỗ trợ đầy đủ bộ ký tự Tiếng Việt UTF-8 (dấu hỏi, ngã, nặng không bị cắt). |
| **Mã & Kỹ thuật** | `font-mono` | `JetBrains Mono`, `ui-monospace`, `Menlo`, `Consolas`, `monospace` | CHỈ dùng cho code blocks, Markdown editor, ID Jira/Bug (`#123`), phím tắt `<kbd>`, và Diff viewer. |
| **Số liệu thống kê** | `tabular-nums` | Dùng font-sans với tính năng `tabular-nums` | Mọi chỉ số thống kê, đếm bug, thời gian logwork. KHÔNG dùng font-mono cho số thống kê. |

### Thang cỡ chữ (Type Scale) & Line-height
* **Display / Page Title:** `text-2xl` (24px) / `text-xl` (20px) — `font-bold` (600–700), Sentence case (không viết HOA toàn bộ).
* **Section Heading:** `text-lg` (18px) / `text-base` (16px) — `font-semibold` (600).
* **Body / Content:** `text-sm` (14px) — `leading-relaxed` (1.6) để tiếng Việt thoáng, rõ dấu.
* **Secondary / UI Meta:** `text-xs` (12px – 13px) — `font-medium`, `leading-normal`.
* **Micro Badge / Kbd:** `text-[11px]` (tối thiểu 11px, không dùng cỡ < 11px).

---

## 2. Bảng Màu Hệ Thống (Semantic Color Tokens)

Tất cả màu được định nghĩa bằng HSL CSS variables, hỗ trợ chuyển đổi mượt mà giữa Chế độ Sáng (Light) và Tối (Dark), đạt độ tương phản tối thiểu 4.5:1 (WCAG AA).

| Token | Light Value | Dark Value | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| `--background` | `210 20% 98%` (#f8fafc) | `222 47% 7%` (#0b0f19) | Nền tổng thể của toàn bộ ứng dụng |
| `--card` | `0 0% 100%` (#ffffff) | `222 47% 10%` (#111827) | Bề mặt card, container, bảng dữ liệu (Elevation L1) |
| `--card-elevated`| `0 0% 100%` | `222 47% 14%` (#1a2234) | Bề mặt modal, dropdown, popover nổi (Elevation L2) |
| `--foreground` | `222 47% 11%` | `210 40% 98%` | Màu chữ chính (Primary text) |
| `--muted-foreground` | `215 16% 47%` | `215 20% 65%` | Màu chữ phụ, mô tả, chú thích (Secondary text) |
| `--border` | `214 32% 91%` | `217 33% 18%` | Viền ngăn cách card, thanh toolbar, bảng |
| `--border-subtle` | `220 13% 94%` | `217 33% 14%` | Đường viền mờ, phân cách dòng nhẹ |
| `--primary` | `221 83% 53%` | `217 91% 60%` | Màu thương hiệu chủ đạo (Accent Blue/Indigo) |
| `--success` | `152 69% 40%` | `152 69% 48%` | Trạng thái thành công, Đã fix, Published |
| `--warning` | `38 92% 50%` | `38 92% 55%` | Trạng thái cảnh báo, In Review, Đang chờ |
| `--destructive` | `0 84% 60%` | `0 84% 65%` | Lỗi, nút xóa, hành động nguy hiểm |

---

## 3. Thang Bo Góc (Border Radius Scale)

* `rounded-sm`: `0.25rem` (4px) — Cho checkbox, tag nhỏ, shortcut `<kbd>`.
* `rounded-md`: `0.375rem` (6px) — Cho icon button mini, sub-item menu.
* `rounded-lg`: `0.5rem` (8px) — Cho dropdown item, nút bấm chuẩn, tab item.
* `rounded-xl`: `0.75rem` (12px) — Cho input field, button chính, card nhỏ.
* `rounded-2xl`: `1rem` (16px) — Cho thẻ chính (cards), thanh toolbar, modal dialogs.
* `rounded-full`: `9999px` — Cho avatars, pills, status dots.

---

## 4. Hệ Thống Đổ Bóng & Bề Mặt (Elevation & Shadow)

Giảm thiểu đổ bóng gắt, ưu tiên viền mờ kết hợp độ đổ bóng ambient tinh tế:
* **Level 0 (Flat):** `border border-border bg-card` — Card hiển thị thông tin tĩnh.
* **Level 1 (Hover / Interactive):** `shadow-xs hover:border-primary/40 transition-all` — Card có thể bấm, item danh sách.
* **Level 2 (Popovers / Dropdowns):** `shadow-lg border border-border bg-card-elevated` — Dropdown menu, tooltip.
* **Level 3 (Modals / Dialogs):** `shadow-2xl border border-border/80 bg-card` — Dialog modal trung tâm.

---

## 5. Thang Khoảng Cách (Spacing Grid - Bội số 4px)

* `space-1` (4px) / `space-1.5` (6px) — Khoảng cách giữa icon và label.
* `space-2` (8px) / `space-3` (12px) — Khoảng cách giữa các nút trong toolbar, padding badge.
* `space-4` (16px) — Padding tiêu chuẩn của card, ô nhập liệu.
* `space-6` (24px) / `space-8` (32px) — Khoảng cách giữa các khối nội dung lớn.

---

## 6. Chuyển Động & Phản Hồi (Motion & Feedback)

* **Thời lượng chuẩn:** `150ms` (cho hover, button press) đến `200ms` (cho modal open, expand accordion).
* **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (mượt mà, tự nhiên).
* **Khả năng tiếp cận:** Hỗ trợ `@media (prefers-reduced-motion: reduce)` để tắt hoàn toàn hiệu ứng chuyển động nếu người dùng có cài đặt chống chóng mặt trên hệ điều hành.
