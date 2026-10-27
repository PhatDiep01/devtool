# HỢP ĐỒNG KỸ THUẬT: TÍNH NĂNG ĐÁNH DẤU HÌNH ẢNH BUG (BUG IMAGE ANNOTATION CONTRACT)

Tài liệu này xác định hợp đồng dữ liệu, quy ước giao tiếp, hệ thống màu sắc và phím tắt dùng chung giữa tất cả các thành phần của tính năng Đánh Dấu Hình Ảnh Bug (Bug Image Annotation).

---

## 1. Mô Hình Dữ Liệu (Data Model)

### 1.1. Kiểu Đánh Dấu (AnnotationItem)
Tất cả tọa độ được lưu trữ dưới dạng **chuẩn hóa (Normalized Coordinates) từ 0.0 đến 1.0** tương đối so với kích thước gốc (naturalWidth, naturalHeight) của hình ảnh.

```typescript
export type AnnotationType = 
  | 'rect'       // Khung chữ nhật
  | 'circle'     // Khung elip / tròn
  | 'arrow'      // Mũi tên chỉ điểm lỗi
  | 'line'       // Đường thẳng gạch chân / nối
  | 'text'       // Hộp văn bản ghi chú
  | 'badge'      // Huy hiệu số thứ tự (Pin / Number Badge)
  | 'highlight'; // Vùng làm nổi bật / bôi sáng bán trong suốt

export type AnnotationStatus = 'open' | 'fixing' | 'resolved';

export interface NormalizedPoint {
  x: number; // 0.0 -> 1.0 (trục ngang, 0 là mép trái, 1 là mép phải)
  y: number; // 0.0 -> 1.0 (trục dọc, 0 là mép trên, 1 là mép dưới)
}

export interface AnnotationComment {
  id: string;
  author: string;
  text: string;
  created_at: string;
}

export interface AnnotationItem {
  id: string;                      // UUID định danh duy nhất của đánh dấu
  type: AnnotationType;            // Loại hình vẽ
  sequence: number;                // Số thứ tự hiển thị (1, 2, 3...)
  
  // Tọa độ chuẩn hóa (Normalized coordinates 0.0 -> 1.0)
  x: number;                       // Điểm gốc X (left)
  y: number;                       // Điểm gốc Y (top)
  width?: number;                  // Chiều rộng (dành cho rect, circle, text, highlight)
  height?: number;                 // Chiều cao (dành cho rect, circle, text, highlight)
  x2?: number;                     // Điểm kết thúc X (dành cho arrow, line)
  y2?: number;                     // Điểm kết thúc Y (dành cho arrow, line)
  points?: NormalizedPoint[];      // Danh sách điểm vẽ tự do nếu có

  // Thuộc tính hiển thị & phong cách
  color: string;                   // Mã màu Hex (ví dụ: '#EF4444')
  strokeWidth: number;             // Độ dày viền nét vẽ (2, 3, 4, 6)
  fontSize?: number;               // Cỡ chữ (dành cho text: 12, 14, 16, 20...)
  fillOpacity?: number;            // Độ trong suốt nền (0 -> 1)

  // Nội dung ghi chú & trạng thái
  title?: string;                  // Tiêu đề ngắn của điểm lỗi
  note: string;                    // Mô tả chi tiết lỗi hoặc hướng dẫn fix
  status: AnnotationStatus;        // 'open' | 'fixing' | 'resolved'
  comments?: AnnotationComment[];  // Danh sách thảo luận phụ

  // Timestamps
  created_at: string;
  updated_at: string;
}
```

### 1.2. Bản Ghi Lưu Trữ Hình Ảnh (BugImageAnnotationRecord)
Gắn liền với từng ảnh đính kèm của một bug:

```typescript
export interface BugImageAnnotationRecord {
  id?: number;
  bug_id: number;                  // Khóa ngoại liên kết bảng bugs
  image_id: string;                // ID hoặc filename của attachment
  annotations: AnnotationItem[];   // Mảng JSON các điểm đánh dấu
  version: number;                 // Concurrency lock (1, 2, 3...)
  created_at?: string;
  updated_at?: string;
}
```

---

## 2. Giao Diện Lập Trình (API & Interface Contract)

### 2.1. Backend Endpoints (Express REST API)

| Phương thức | Endpoint | Tham số Body / Query | Mô tả |
|---|---|---|---|
| `GET` | `/api/bugs/:id/annotations` | Không | Lấy toàn bộ đánh dấu của tất cả hình ảnh thuộc bug `:id` |
| `GET` | `/api/bugs/:id/annotations/:imageId` | Không | Lấy bản ghi đánh dấu của ảnh `:imageId` |
| `PUT` | `/api/bugs/:id/annotations/:imageId` | `{ annotations: AnnotationItem[], version?: number }` | Lưu đánh dấu (hỗ trợ Concurrency Check nếu version không khớp) |
| `DELETE` | `/api/bugs/:id/annotations/:imageId` | Không | Xóa bản ghi đánh dấu của ảnh |
| `GET` | `/api/bugs` | `?has_annotations=all|yes|no` | Bổ sung trường `annotated_images_count` và `has_annotations` trong danh sách |

### 2.2. Interface Props của Trình Đánh Dấu (AnnotationModalProps)

```typescript
export interface AnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  bug: BugItem;
  initialImageId?: string;
  onSaved?: (updatedRecord: BugImageAnnotationRecord) => void;
}
```

---

## 3. Bảng Màu Dùng Chung (Shared Color Palette)

Các màu sắc được thiết kế tối ưu độ tương phản trên cả nền ảnh sáng và tối:

| Tên màu | Mã HEX | Mục đích khuyến nghị |
|---|---|---|
| Đỏ (Red) | `#EF4444` | Lỗi nghiêm trọng, vùng sai lệch chính, điểm nhấn khẩn cấp (Mặc định) |
| Cam (Orange) | `#F97316` | Cảnh báo giao diện, cảnh báo logic, sai lệch bố cục |
| Vàng (Yellow) | `#EAB308` | Chú ý, cần xem lại, bôi sáng text / highlight |
| Xanh lục (Green) | `#22C55E` | Trạng thái mong muốn, vùng đúng, đã giải quyết |
| Xanh lam (Blue) | `#3B82F6` | Hướng dẫn thao tác, liên kết, thông tin bổ sung |
| Tím (Purple) | `#A855F7` | Gợi ý cải tiến UX/UI, chỉnh sửa kiểu dáng |
| Trắng (White) | `#FFFFFF` | Nét viền tương phản cao trên nền tối |
| Đen (Black) | `#0F172A` | Nét viền tương phản cao trên nền sáng |

---

## 4. Danh Sách Phím Tắt (Keyboard Shortcuts)

| Phím tắt | Chức năng |
|---|---|
| `V` hoặc `Esc` | Chuyển sang công cụ Chọn & Di chuyển (Select / Pointer) |
| `R` | Chọn công cụ Hình chữ nhật (Rectangle) |
| `C` | Chọn công cụ Hình tròn / Elip (Circle) |
| `A` | Chọn công cụ Mũi tên (Arrow) |
| `L` | Chọn công cụ Đường thẳng (Line) |
| `T` | Chọn công cụ Văn bản (Text) |
| `N` hoặc `B` | Chọn công cụ Huy hiệu số thứ tự (Number Badge / Pin) |
| `H` | Chọn công cụ Làm sáng (Highlight) |
| `Delete` / `Backspace` | Xóa đánh dấu đang được chọn |
| `Ctrl + Z` / `Cmd + Z` | Hoàn tác (Undo) |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Làm lại (Redo) |
| `Ctrl + S` / `Cmd + S` | Lưu ngay lập tức (Save immediately) |
| `+` / `=` | Phóng to (Zoom In) |
| `-` | Thu nhỏ (Zoom Out) |
| `0` | Khôi phục 100% kích thước ảnh (Reset Zoom) |
| `F` | Vừa vặn khung nhìn (Fit to Screen) |
| `Space + Drag` | Kéo di chuyển không gian làm việc (Pan) |
