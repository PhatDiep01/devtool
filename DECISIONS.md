# TỔNG HỢP CÁC QUYẾT ĐỊNH KỸ THUẬT (ARCHITECTURAL DECISIONS)

Tài liệu này ghi lại toàn bộ các quyết định kiến trúc, giả định kỹ thuật và giải pháp ít xâm lấn nhất theo nguyên tắc First-Principles nhằm mở rộng tính năng Trình Đánh Dấu Hình Ảnh Bug (Bug Image Annotation) mà không làm ảnh hưởng đến các chức năng hiện có của DevToolkit.

---

## 1. Lưu trữ dữ liệu: Bảng SQLite chuyên biệt `bug_annotations`
- **Bối cảnh:** Cần lưu trữ các đối tượng đánh dấu gắn với từng ảnh đính kèm của từng bug.
- **Phương án cân nhắc:**
  1. *Lưu trực tiếp vào cột JSON `attachments` của bảng `bugs`*: Tiềm ẩn rủi ro xung đột dữ liệu khi người dùng sửa tiêu đề/mô tả của bug cùng lúc với lưu đánh dấu ảnh, làm tăng kích thước payload của toàn bộ bảng `bugs`.
  2. *Tạo bảng riêng `bug_annotations` với quan hệ `bug_id` và `image_id` (Được chọn)*:
     - Tạo bảng `bug_annotations (id, bug_id, image_id, annotations, version, created_at, updated_at)` với `FOREIGN KEY (bug_id) REFERENCES bugs(id) ON DELETE CASCADE`.
     - Chỉ mục `idx_bug_annotations_bug_id` giúp truy vấn tốc độ cao O(1).
     - Hỗ trợ cơ chế khóa lạc quan (Optimistic Concurrency Control) thông qua trường `version`.
     - Tự động cascade xóa khi bug bị xóa, tự động dọn dẹp khi ảnh đính kèm bị gỡ.

## 2. Hệ tọa độ chuẩn hóa (Normalized 0.0 - 1.0 Coordinate System)
- **Bối cảnh:** Hình ảnh có thể được hiển thị ở nhiều kích cỡ khác nhau (thumbnail trên card, modal chi tiết, màn hình retina, zoom 200%, kích thước cửa sổ co giãn responsive).
- **Quyết định:** Mọi tọa độ `(x, y, width, height, x2, y2, points)` đều được lưu trữ theo tỷ lệ chuẩn hóa từ `0.0` đến `1.0` so với chiều rộng (`naturalWidth`) và chiều cao (`naturalHeight`) gốc của ảnh.
- **Lợi ích:** 
  - Đảm bảo điểm đánh dấu nằm chính xác tuyệt đối trên mọi độ phân giải màn hình.
  - Khi render, chỉ cần nhân với kích thước hiển thị hiện tại.
  - Khi xuất ảnh PNG kích thước gốc, nhân với `naturalWidth` và `naturalHeight` để đạt độ phân giải cao nhất.

## 3. Lõi Đồ Họa (Canvas Engine): Hybrid Vector SVG + Offscreen Canvas
- **Bối cảnh:** Dự án hiện không cài sẵn thư viện canvas cồng kềnh như Fabric.js hay Konva. Cần một giải pháp hiệu năng cao, nhẹ, mượt mà và không tăng gánh nặng bundle.
- **Quyết định:** 
  - **Tương tác hiển thị & thao tác người dùng (Interactive Viewport):** Sử dụng các thẻ SVG vector overlay trên ảnh React. SVG hỗ trợ sắc nét ở mọi độ phóng đại (zoom in/out không vỡ hạt), hỗ trợ bắt sự kiện DOM mượt mà, dễ gắn nhãn trợ năng và accessibility.
  - **Xuất ảnh (Export & Clipboard):** Sử dụng HTML5 Offscreen `<canvas>` để vẽ ghép ảnh gốc và các vector vẽ đè lên nhau ở độ phân giải gốc 100%, sau đó chuyển đổi thành Blob PNG để tải về máy hoặc nạp vào Clipboard API (`navigator.clipboard.write`).

## 4. Tự Động Lưu (Debounced Auto-Save) & Chống Ghi Đè (Conflict Protection)
- **Bối cảnh:** Người dùng liên tục thêm, di chuyển, thay đổi ghi chú. Nếu mỗi thao tác đều gửi HTTP request sẽ gây nghẽn mạng; nếu chỉ lưu bằng tay thì người dùng dễ quên và mất dữ liệu.
- **Quyết định:**
  - Áp dụng cơ chế **Debounced Auto-save (khoảng trễ 1000ms)** sau khi người dùng ngừng tương tác.
  - Cung cấp nút "Lưu" thủ công và phím tắt `Ctrl + S` để lưu lập tức.
  - Hiển thị chỉ báo trạng thái trực quan: `Đã lưu`, `Đang lưu...`, `Chưa lưu thay đổi`, `Lỗi lưu`.
  - Phía backend kiểm tra trường `version` để phát hiện và ngăn chặn việc ghi đè vô tình khi có nhiều tab cùng mở.

## 5. Tương Thích Ngược & An Toàn Dữ Liệu Cũ
- **Bối cảnh:** Cơ sở dữ liệu hiện có chứa các bug và file ảnh đã tạo từ trước.
- **Quyết định:**
  - Các bug chưa từng đánh dấu sẽ tự động trả về `annotations: []` mà không phát sinh lỗi.
  - Nếu file ảnh bị thiếu hoặc đường dẫn hỏng, UI hiển thị fallback an toàn kèm thông báo "Không tìm thấy file ảnh gốc" thay vì crash ứng dụng.
  - Mọi thao tác đều có khối `try/catch` bọc cẩn thận và kiểm tra tính hợp lệ của JSON trước khi parse.

## 6. Điểm Tích Hợp Vào Giao Diện Màn Hình Bug Hiện Tại
- **Bối cảnh:** Yêu cầu nghiêm ngặt không được làm thay đổi hoặc phá vỡ các tính năng hiện có của màn hình Bug Tracker.
- **Quyết định:**
  - Giữ nguyên 100% logic Kanban, bảng danh sách, các bộ lọc cũ (Trạng thái, Loại FE/BE, Mức độ nghiêm trọng).
  - Bổ sung bộ lọc mới "Lọc theo đánh dấu": `Tất cả`, `Có đánh dấu`, `Chưa đánh dấu`.
  - Bổ sung huy hiệu trực quan trên Bug Card khi bug có ảnh được đánh dấu.
  - Trong Modal chi tiết bug: Thêm nút "Đánh dấu ảnh" trên từng ảnh đính kèm.
  - Bổ sung phím tắt và xử lý kéo thả ảnh / dán ảnh (`Ctrl + V`) để đưa ảnh vào màn hình bug nhanh chóng.

## 7. Rà Soát Sâu & Hoàn Thiện (Peer Review & Hardening Fixes)
- **Khắc phục lỗi lệch tọa độ SVG do khung Flexbox:** Bọc thẻ `img` và `svg` trong container `inline-block leading-[0]`, đảm bảo khung SVG khớp 100% từng pixel với kích thước hiển thị thực tế của ảnh ở mọi tỉ lệ và độ phân giải màn hình.
- **Bổ sung Mouse Wheel Zoom:** Bắt sự kiện `onWheel` trên viewport canvas để phóng to / thu nhỏ mượt mà từ 0.25x đến 4.0x.
- **Bổ sung Bảng chỉnh nhanh nổi (Floating Quick-Edit Panel):** Khi chọn một hình vẽ hoặc huy hiệu, một thanh công cụ nổi xuất hiện ngay sát đối tượng cho phép đổi trạng thái (`Chưa fix`, `Đang fix`, `Đã fix`), chọn nhanh màu sắc, gõ ghi chú trực tiếp và nút xóa.
- **Kích hoạt hiển thị đánh dấu thực tế (`AnnotationOverlayView`):** Tích hợp hiển thị lớp vẽ kèm nút chuyển đổi (Bật/Tắt) trên thumbnail thẻ BugCard, danh sách đính kèm trong Bug Detail Modal và hộp thoại xem ảnh phóng to (Lightbox).
- **Sửa lỗi biến dạng Mũi tên / Đường thẳng:** Áp dụng thuật toán tịnh tiến vật thể rắn (`clampSegmentDelta`) để khi di chuyển mũi tên, góc nghiêng và độ dài được bảo toàn nguyên vẹn.
- **Chống tràn ngăn xếp Hoàn tác (Undo Stack):** Không ghi lại snapshot lịch sử trên từng phím gõ trong ô ghi chú; chỉ lưu snapshot khi kết thúc nhập liệu (`onBlur`).
- **Giao diện xử lý xung đột phiên bản (409):** Hiển thị banner cảnh báo với hai lựa chọn chủ động: "Nạp bản mới" hoặc "Ghi đè (Lưu đè)".
- **Dán và kéo thả ảnh trực tiếp:** Hỗ trợ phím tắt `Ctrl + V` và kéo thả file ảnh ngay trong không gian làm việc của `AnnotationModal`.
- **Xuất báo cáo tổng hợp Markdown:** Nút "Xuất Markdown" trong chi tiết bug tạo bảng tổng hợp tất cả điểm đánh dấu của từng hình ảnh đính kèm.
- **Bảo vệ Canvas khỏi Tainted Canvas / CORS:** Đặt header `Cross-Origin-Resource-Policy: cross-origin` và `Access-Control-Allow-Origin: *` trên backend endpoint phục vụ file tĩnh, đồng thời frontend tải ảnh qua fetch Blob trước khi đưa vào Offscreen Canvas để xuất PNG.

