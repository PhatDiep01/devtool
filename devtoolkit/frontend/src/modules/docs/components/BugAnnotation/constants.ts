import { AnnotationType, AnnotationStatus } from '../../../../types';

export interface ColorOption {
  name: string;
  value: string;
  twBorder: string;
  twBg: string;
}

export const ANNOTATION_COLORS: ColorOption[] = [
  { name: 'Đỏ (Lỗi)', value: '#EF4444', twBorder: 'border-red-500', twBg: 'bg-red-500' },
  { name: 'Cam (Cảnh báo)', value: '#F97316', twBorder: 'border-orange-500', twBg: 'bg-orange-500' },
  { name: 'Vàng (Chú ý)', value: '#EAB308', twBorder: 'border-yellow-500', twBg: 'bg-yellow-500' },
  { name: 'Xanh lục (Đúng)', value: '#22C55E', twBorder: 'border-emerald-500', twBg: 'bg-emerald-500' },
  { name: 'Xanh lam (Thông tin)', value: '#3B82F6', twBorder: 'border-blue-500', twBg: 'bg-blue-500' },
  { name: 'Tím (Góp ý)', value: '#A855F7', twBorder: 'border-purple-500', twBg: 'bg-purple-500' },
  { name: 'Hồng (Nhấn mạnh)', value: '#EC4899', twBorder: 'border-pink-500', twBg: 'bg-pink-500' },
  { name: 'Trắng', value: '#FFFFFF', twBorder: 'border-slate-300', twBg: 'bg-white' },
  { name: 'Đen', value: '#0F172A', twBorder: 'border-slate-900', twBg: 'bg-slate-900' },
];

export const STROKE_WIDTH_OPTIONS = [
  { value: 2, label: '2px (Mảnh)' },
  { value: 3, label: '3px (Vừa)' },
  { value: 4, label: '4px (Dày)' },
  { value: 6, label: '6px (Rất dày)' },
];

export const STATUS_OPTIONS: { value: AnnotationStatus; label: string; badgeColor: string }[] = [
  { value: 'open', label: 'Chưa fix', badgeColor: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30' },
  { value: 'fixing', label: 'Đang fix', badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  { value: 'resolved', label: 'Đã fix', badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
];

export interface ToolDef {
  type: AnnotationType | 'select';
  name: string;
  iconName: string;
  shortcut: string;
  description: string;
}

export const ANNOTATION_TOOLS: ToolDef[] = [
  { type: 'select', name: 'Chọn / Di chuyển', iconName: 'MousePointer', shortcut: 'V', description: 'Chọn đối tượng, di chuyển hoặc co giãn kích thước' },
  { type: 'rect', name: 'Hình chữ nhật', iconName: 'Square', shortcut: 'R', description: 'Vẽ khung chữ nhật khoanh vùng điểm lỗi' },
  { type: 'circle', name: 'Hình tròn / Elip', iconName: 'Circle', shortcut: 'C', description: 'Vẽ khung elip hoặc tròn quanh chi tiết cần sửa' },
  { type: 'arrow', name: 'Mũi tên', iconName: 'ArrowUpRight', shortcut: 'A', description: 'Vẽ mũi tên chỉ thẳng vào điểm cần chú ý' },
  { type: 'line', name: 'Đường thẳng', iconName: 'Minus', shortcut: 'L', description: 'Vẽ đường gạch chân hoặc đường nối' },
  { type: 'badge', name: 'Số thứ tự (Pin)', iconName: 'Tag', shortcut: 'N', description: 'Nhấp để đặt huy hiệu số thứ tự 1, 2, 3... đánh dấu các bước' },
  { type: 'text', name: 'Văn bản', iconName: 'Type', shortcut: 'T', description: 'Nhấp và kéo để tạo hộp chữ ghi chú trực tiếp' },
  { type: 'highlight', name: 'Làm nổi bật', iconName: 'Highlighter', shortcut: 'H', description: 'Tô sáng vùng chữ hoặc hình bằng màu bán trong suốt' },
];

export const SHORTCUTS_LIST = [
  { key: 'V hoặc Esc', label: 'Chế độ Chọn / Di chuyển (Select)' },
  { key: 'R', label: 'Vẽ Hình chữ nhật (Rectangle)' },
  { key: 'C', label: 'Vẽ Hình tròn (Circle)' },
  { key: 'A', label: 'Vẽ Mũi tên (Arrow)' },
  { key: 'L', label: 'Vẽ Đường thẳng (Line)' },
  { key: 'N hoặc B', label: 'Đặt Huy hiệu số (Number Badge)' },
  { key: 'T', label: 'Hộp văn bản (Text)' },
  { key: 'H', label: 'Bôi sáng nổi bật (Highlight)' },
  { key: 'Delete / Backspace', label: 'Xóa đánh dấu đang chọn' },
  { key: 'Ctrl + Z / Cmd + Z', label: 'Hoàn tác (Undo)' },
  { key: 'Ctrl + Y / Ctrl + Shift + Z', label: 'Làm lại (Redo)' },
  { key: 'Ctrl + S / Cmd + S', label: 'Lưu ngay lập tức' },
  { key: '+ / =', label: 'Phóng to' },
  { key: '-', label: 'Thu nhỏ' },
  { key: '0', label: 'Khôi phục tỷ lệ 100%' },
  { key: 'F', label: 'Vừa vặn khung hình (Fit)' },
  { key: 'Space + Drag', label: 'Kéo không gian làm việc (Pan)' },
];

export function getAnnotationTypeName(type: string): string {
  switch (type) {
    case 'rect': return 'Khoanh vùng lỗi';
    case 'circle': return 'Vùng tròn / Elip';
    case 'arrow': return 'Mũi tên chỉ lỗi';
    case 'line': return 'Đường gạch / Nối';
    case 'badge': return 'Số thứ tự (Pin)';
    case 'text': return 'Hộp văn bản';
    case 'highlight': return 'Làm nổi bật';
    case 'pen': return 'Vẽ tự do';
    default: return 'Điểm đánh dấu';
  }
}
