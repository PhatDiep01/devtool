export const SAMPLE_MARKDOWN = `# Hướng dẫn & Giới thiệu Cú pháp Markdown Chuẩn

Chào mừng bạn đến với công cụ **Xem trước Markdown (Markdown Preview)**! Đây là tài liệu mẫu trực quan giúp bạn kiểm tra đầy đủ các thành phần định dạng Markdown nâng cao.

---

## 1. Phân cấp Tiêu đề (Headings)

# Tiêu đề Cấp 1 (H1 - Heading 1)
## Tiêu đề Cấp 2 (H2 - Heading 2)
### Tiêu đề Cấp 3 (H3 - Heading 3)
#### Tiêu đề Cấp 4 (H4 - Heading 4)
##### Tiêu đề Cấp 5 (H5 - Heading 5)
###### Tiêu đề Cấp 6 (H6 - Heading 6)

---

## 2. Định dạng Văn bản & Kiểu chữ

Bạn có thể dễ dàng nhấn mạnh nội dung trong văn bản bằng các cú pháp cơ bản:
- **Chữ in đậm** dùng cú pháp \`**chữ đậm**\` hoặc \`__chữ đậm__\`
- *Chữ in nghiêng* dùng cú pháp \`*chữ nghiêng*\` hoặc \`_chữ nghiêng_\`
- ***Chữ vừa đậm vừa nghiêng*** dùng cú pháp \`***đậm và nghiêng***\`
- ~~Chữ gạch ngang~~ dùng cú pháp \`~~gạch ngang~~\`
- Đánh dấu nổi bật bằng thẻ <mark>Highlight Text</mark> hoặc thẻ HTML tương ứng

---

## 3. Danh sách (Lists) & Danh sách Công việc (Checklist)

### 3.1. Danh sách không thứ tự & lồng nhau
- Khởi động dự án Web Application
  - Thiết kế kiến trúc Front-end (React, Vite, Tailwind CSS)
  - Xây dựng RESTful API Backend (Express, Node.js)
  - Quản lý trạng thái và lưu trữ cục bộ an toàn
- Kiểm thử và Tối ưu hiệu năng
  - Kiểm thử đơn vị (Unit Test)
  - Tối ưu kích thước bundle và tốc độ tải trang
- Bàn giao và triển khai hạ tầng

### 3.2. Danh sách có thứ tự
1. Thu thập và phân tích yêu cầu nghiệp vụ
2. Lập bản vẽ UI/UX và thiết kế database schema
3. Lập trình tính năng theo từng Sprint
4. Triển khai CI/CD và bàn giao người dùng cuối

### 3.3. Danh sách kiểm tra (Task List / Checklist)
- [x] Thiết kế giao diện thanh công cụ Toolbar
- [x] Hỗ trợ kéo thả và tải file .md, .markdown, .txt
- [x] Tính năng xem trước tức thì và cuộn đồng bộ
- [x] Hỗ trợ phím tắt tiện lợi (Ctrl+B, Ctrl+I, Ctrl+K, Ctrl+S)
- [ ] Mở rộng tính năng xuất PDF và HTML
- [ ] Tích hợp tính năng cộng tác thời gian thực

---

## 4. Hộp Trích dẫn & Ghi chú Đặc biệt (Callouts)

> "Mã nguồn sạch, dễ đọc và kiến trúc rõ ràng luôn là chìa khóa xây dựng phần mềm bền vững qua thời gian."  
> — *Clean Architecture Principles*

Hỗ trợ các khối chú thích chuyên nghiệp theo tiêu chuẩn GitHub Flavored Markdown:

> [!NOTE]
> Đây là ghi chú thông tin (Note/Information) giúp người đọc nắm bắt thêm bối cảnh kỹ thuật hoặc tài liệu tham khảo.

> [!TIP]
> Mẹo nhỏ: Bạn có thể nhấn phím tắt **Ctrl + S** bất kỳ lúc nào để mở hộp thoại lưu file Markdown nhanh chóng.

> [!IMPORTANT]
> Toàn bộ nội dung lưu trữ được mã hóa an toàn trong trình duyệt hoặc hệ thống tệp tin cục bộ của bạn, không bị gửi ra ngoài.

> [!WARNING]
> Lưu ý cảnh báo: Hãy đảm bảo bạn đã lưu tài liệu trước khi đóng tab hoặc tải lại trình duyệt để không làm gián đoạn công việc.

---

## 5. Khối Lệnh & Mã Nguồn (Code Blocks)

Đoạn mã nội dòng như lệnh \`npm run build\` hoặc hàm \`useState(false)\` hiển thị gọn gàng, rõ ràng.

### Mã nguồn TypeScript:
\`\`\`typescript
import React, { useState, useEffect } from 'react';

interface MarkdownPreviewProps {
  initialContent?: string;
  onSave?: (content: string) => Promise<boolean>;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ 
  initialContent = '', 
  onSave 
}) => {
  const [content, setContent] = useState<string>(initialContent);
  const [isSaved, setIsSaved] = useState<boolean>(true);

  const handleTextChange = (newText: string) => {
    setContent(newText);
    setIsSaved(false);
  };

  return (
    <div className="markdown-container">
      <p>Trạng thái: {isSaved ? 'Đã lưu' : 'Có thay đổi chưa lưu'}</p>
    </div>
  );
};
\`\`\`

### Truy vấn SQL:
\`\`\`sql
-- Truy vấn danh sách tài liệu được chỉnh sửa gần nhất
SELECT 
    f.id,
    f.file_name,
    f.size_bytes,
    f.updated_at
FROM saved_markdown_files f
WHERE f.is_archived = 0
ORDER BY f.updated_at DESC
LIMIT 10;
\`\`\`

---

## 6. Bảng Dữ liệu (Tables)

| Thao tác | Phím tắt | Mô tả chi tiết | Trạng thái |
| :--- | :---: | :--- | :---: |
| **Lưu tài liệu** | \`Ctrl + S\` | Mở popup xác nhận lưu file | Có sẵn |
| **Chữ đậm** | \`Ctrl + B\` | Đóng mở cặp ký tự \`**\` quanh từ | Có sẵn |
| **Chữ nghiêng** | \`Ctrl + I\` | Đóng mở ký tự \`*\` quanh từ | Có sẵn |
| **Chèn liên kết** | \`Ctrl + K\` | Chèn cú pháp liên kết \`[Tiêu đề](url)\` | Có sẵn |
| **Thụt đầu dòng** | \`Tab\` | Thụt lề 2 khoảng trắng trong editor | Có sẵn |
| **Toàn màn hình** | \`F11\` / Nút bấm | Phóng to toàn màn hình vùng xem trước | Có sẵn |

---

## 7. Liên kết & Hình ảnh (Links & Media)

- Truy cập trang chủ dự án: [DevToolkit Portal](https://github.com)
- Tài liệu quy chuẩn kỹ thuật: [Markdown Guide GFM](https://docs.github.com/en/get-started/writing-on-github)

### Hình ảnh minh họa:
![Kiến trúc Markdown Preview](https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&w=1200&q=80)

---
*Chúc bạn có trải nghiệm soạn thảo và xem trước Markdown tuyệt vời!*
`;
