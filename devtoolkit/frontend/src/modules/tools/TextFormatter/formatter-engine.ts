export type DetectedType = 'JSON' | 'SQL' | 'LOG' | 'TEXT';

export interface FormatterOptions {
  smartJson: boolean;
  separator: string; // ' ' | ',' | ', ' | ';' | '; ' | '|' | custom
  trimLines: boolean;
  removeEmptyLines: boolean;
  collapseSpaces: boolean;
}

export interface TextStats {
  characters: number;
  words: number;
  lines: number;
  byteSize: number;
}

export interface FormatterResult {
  output: string;
  detectedType: DetectedType;
  isJsonValid: boolean;
  jsonError?: string;
  inputStats: TextStats;
  outputStats: TextStats;
  charsSaved: number;
  reductionPercent: number; // e.g. 35.5 (meaning 35.5% reduction)
  isLargePayload: boolean;
}

export const PERFORMANCE_THRESHOLD = 100_000;

/**
 * Computes characters, words, lines and byte size for a given text.
 */
export function computeTextStats(text: string): TextStats {
  if (!text) {
    return { characters: 0, words: 0, lines: 0, byteSize: 0 };
  }

  const characters = text.length;
  // Unicode-aware word matching
  const wordsMatch = text.trim().match(/\S+/g);
  const words = wordsMatch ? wordsMatch.length : 0;
  const lines = text.split(/\r?\n/).length;
  
  // Approximate UTF-8 byte length safely in all environments
  let byteSize = 0;
  if (typeof TextEncoder !== 'undefined') {
    byteSize = new TextEncoder().encode(text).length;
  } else if (typeof Buffer !== 'undefined') {
    byteSize = Buffer.byteLength(text, 'utf8');
  } else {
    byteSize = characters;
  }

  return { characters, words, lines, byteSize };
}

/**
 * Detects whether the input text is JSON, SQL, System Log or Plain Text.
 */
export function detectInputType(text: string): DetectedType {
  const trimmed = text.trim();
  if (!trimmed) return 'TEXT';

  // 1. Log detection FIRST: timestamp pattern or bracketed log level tag
  // Common log formats: [2026-10-24 15:30:00], [INFO], [ERROR], etc.
  const logRegex = /^(\[?\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}:\d{2}|\[\s*(INFO|WARN|WARNING|ERROR|DEBUG|TRACE|FATAL|NOTICE|CRITICAL)\s*\]|\b(INFO|WARN|WARNING|ERROR|DEBUG|TRACE|FATAL):\s+)/i;
  if (logRegex.test(trimmed)) {
    return 'LOG';
  }

  // 2. SQL query detection: strip leading SQL comments (-- or /* */) first
  const sqlStripped = trimmed.replace(/^(\s*(--[^\r\n]*(\r?\n|$)|(\/\*[\s\S]*?\*\/)))+/i, '').trim();
  const sqlRegex = /^(SELECT|INSERT\s+INTO|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|MERGE\s+INTO|WITH|EXPLAIN|GRANT|REVOKE|EXEC|EXECUTE|UPSERT|REPLACE\s+INTO)\b/i;
  if (sqlRegex.test(sqlStripped)) {
    return 'SQL';
  }

  // 3. JSON check: starts with { or [
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'JSON';
  }

  return 'TEXT';
}

/**
 * Core text and JSON formatting engine with absolute data integrity.
 */
export function formatText(text: string, options: FormatterOptions): FormatterResult {
  const isLargePayload = text.length > PERFORMANCE_THRESHOLD;
  const inputStats = computeTextStats(text);
  const detectedType = detectInputType(text);

  if (!text) {
    return {
      output: '',
      detectedType: 'TEXT',
      isJsonValid: false,
      inputStats,
      outputStats: computeTextStats(''),
      charsSaved: 0,
      reductionPercent: 0,
      isLargePayload: false
    };
  }

  let output = '';
  let isJsonValid = false;
  let jsonError: string | undefined;

  // Smart JSON formatting mode: only attempt when smartJson is enabled AND detectedType is JSON
  if (options.smartJson && detectedType === 'JSON') {
    try {
      const parsed = JSON.parse(text);
      isJsonValid = true;
      // Compresses to a strictly valid single-line JSON string without corrupting any keys, values, or types
      output = JSON.stringify(parsed);
    } catch (err: any) {
      isJsonValid = false;
      jsonError = err?.message || 'Cú pháp JSON không hợp lệ';
    }
  }

  // If not JSON or Smart JSON fallback
  if (!output) {
    let lines = text.split(/\r?\n/);

    if (options.trimLines) {
      lines = lines.map(line => line.trim());
    }

    if (options.removeEmptyLines) {
      lines = lines.filter(line => line.length > 0);
    }

    if (options.collapseSpaces) {
      lines = lines.map(line => line.replace(/\s+/g, ' '));
    }

    output = lines.join(options.separator);
  }

  const outputStats = computeTextStats(output);
  const charsSaved = inputStats.characters - outputStats.characters;
  const reductionPercent = inputStats.characters > 0
    ? Math.max(0, Number(((charsSaved / inputStats.characters) * 100).toFixed(1)))
    : 0;

  return {
    output,
    detectedType,
    isJsonValid,
    jsonError,
    inputStats,
    outputStats,
    charsSaved,
    reductionPercent,
    isLargePayload
  };
}

/**
 * Formats byte size into human-readable unit (B, KB, MB)
 */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Robust cross-browser clipboard copy with execCommand fallback for iframes/restricted permissions.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // Method 1: Modern navigator.clipboard API
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Graceful fallback to document.execCommand
  }

  // Method 2: Fallback textarea execCommand('copy') with iOS selection range support
  try {
    if (typeof document !== 'undefined') {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      if (typeof textArea.setSelectionRange === 'function') {
        textArea.setSelectionRange(0, text.length);
      }
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Trigger text file download (.txt) in browser.
 */
export function downloadTextFile(content: string, filename: string = 'formatted-oneline.txt'): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Built-in Quick Presets for instant testing & demonstration
 */
export const PRESETS = [
  {
    id: 'simple-json',
    label: 'JSON Đơn Giản',
    desc: 'Bảo toàn null, boolean, số nguyên & float',
    type: 'JSON',
    content: `{
  "id": 1024,
  "service": "DevToolkit Online",
  "is_active": true,
  "role": "Lead Architect",
  "metadata": null,
  "score": 98.75,
  "retry_count": 0
}`
  },
  {
    id: 'complex-json',
    label: 'JSON Lồng Nhau',
    desc: 'Unicode tiếng Việt, mảng nested, nháy kép thoát chuỗi',
    type: 'JSON',
    content: `{
  "platform": "DevToolkit & Handover Portal",
  "version": "1.2.0",
  "author": "Đặng Minh Phát \\"Tech Lead\\"",
  "features": [
    {
      "code": "TEXT_FORMATTER",
      "title": "Text Formatter Online",
      "description": "Công cụ nén 1 dòng bảo toàn kiểu dữ liệu và cấu trúc JSON chuẩn.",
      "enabled": true,
      "tags": ["frontend", "json", "regex", "compression"]
    },
    {
      "code": "JIRA_KANBAN",
      "title": "Agile Kanban Board",
      "description": "Quản lý Sprint và task theo thời gian thực.",
      "enabled": true
    }
  ],
  "settings": {
    "theme": "dark",
    "realtime_format": true,
    "max_threshold_bytes": 102400
  }
}`
  },
  {
    id: 'sql-query',
    label: 'Câu Lệnh SQL',
    desc: 'Query phức tạp nhiều dòng với JOIN & GROUP BY',
    type: 'SQL',
    content: `SELECT 
  u.id AS user_id,
  u.full_name,
  u.email,
  r.role_name,
  COUNT(t.id) AS total_tasks,
  SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END) AS completed_tasks,
  ROUND(AVG(t.story_points), 2) AS avg_velocity
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
LEFT JOIN tasks t ON t.assignee_id = u.id
WHERE u.is_active = 1 
  AND u.deleted_at IS NULL
  AND t.created_at >= '2026-01-01'
GROUP BY u.id, u.full_name, u.email, r.role_name
HAVING COUNT(t.id) > 5
ORDER BY total_tasks DESC, u.full_name ASC;`
  },
  {
    id: 'plain-text',
    label: 'Văn Bản Đoạn Văn',
    desc: 'Nhiều dòng thụt lề tab, khoảng trắng thừa, dòng trống',
    type: 'TEXT',
    content: `    # DevToolkit - Nền Tảng Tài Liệu Bàn Giao Kỹ Thuật

        DevToolkit là trung tâm tài liệu chuẩn mực cho BA, Software Engineer và QA.

        Các chức năng cốt lõi:
            - Quản lý đặc tả màn hình kỹ thuật (Screen Handover).
            - Tích hợp Kanban Board và Sprint Tracker.
            - Bộ công cụ tiện ích Text Formatter Online nén 1 dòng tốc độ cao.

    Dữ liệu được xử lý trực tiếp tại trình duyệt người dùng với độ bảo mật tuyệt đối!    `
  }
];

/**
 * Standardized AI Agent Prompts for Design, Coder, QA, and Review (/boost agents)
 */
export const AGENT_ROLES = [
  {
    id: 'designer',
    title: 'Agent Thiết Kế (UI/UX Designer)',
    badge: 'Design Agent',
    icon: 'Palette',
    summary: 'Chuyên gia thiết kế giao diện Two-Panel đối xứng, tối ưu hóa công thái học, responsive đa màn hình và hệ thống token Dark/Light.',
    systemPrompt: `Bạn là UI/UX Design Lead hàng đầu thế giới chuyên về Developer Tools và Productivity Web Applications.
Nhiệm vụ của bạn là thiết kế trải nghiệm người dùng và giao diện cho công cụ "Text Formatter Online" theo các tiêu chuẩn khắt khe sau:

1. Hệ thống layout đối xứng 2 cột (Two-Panel Symmetric Grid):
   - Cột trái (Input Area) và Cột phải (Output Area) có tỉ lệ 50:50 trên Desktop (>= 1024px) và xếp chồng 100% trên Mobile (< 768px).
   - Thanh trạng thái cố định ở đáy mỗi ô (Status Footer) hiển thị Ký tự, Số từ, Số dòng và Tỷ lệ phần trăm giảm dung lượng.
   - Huy hiệu nhận diện (Badge) tự động đổi màu theo định dạng: JSON (Xanh ngọc/Emerald), SQL (Xanh biển/Sky), Plain Text (Xám trung tính/Slate).

2. Công thái học tương tác (Micro-interactions & UX Delight):
   - Ô kết quả Output: Chế độ readonly, tự động chọn tất cả (Auto-select all) khi nhấp chuột để user nhấn Ctrl+C tức thì.
   - Nút Copy: Đổi icon thành Checkmark xanh lá kèm hiệu ứng rung nhẹ (spring animation) trong 2 giây sau khi bấm.
   - Cảnh báo hiệu năng trực quan khi dữ liệu vượt 100.000 ký tự: Banner viền vàng cam nhẹ nhàng, nút "Nén Ngay" có hiệu ứng phát sáng nhẹ (pulse) nhắc nhở.

3. Khả năng tương thích Theme (Linear/Vercel Aesthetic):
   - Light Mode: Tông nền trắng sạch #FFFFFF kết hợp border xám nhạt #E2E8F0, chữ #0F172A.
   - Dark Mode: Tông nền đen sâu #0B0F19 kết hợp viền mờ #1E293B, chữ #F8FAFC, mã code hiển thị font Monospace (JetBrains Mono / Fira Code).`
  },
  {
    id: 'coder',
    title: 'Agent Lập Trình (Senior Core Engineer)',
    badge: 'Coder Agent',
    icon: 'Code2',
    summary: 'Kỹ sư lập trình Frontend & Algorithm chuyên nghiệp. Hiện thực hóa thuật toán nén Smart JSON, bảo toàn dữ liệu 100% và bảo vệ hiệu năng.',
    systemPrompt: `Bạn là Senior Frontend & Algorithm Engineer (Top 0.1% Expert) chịu trách nhiệm xây dựng mã nguồn hoàn chỉnh cho công cụ "Text Formatter Online" trong hệ sinh thái React 18 + TypeScript + Tailwind CSS.

Yêu cầu kỹ thuật cốt lõi:
1. Thuật toán Smart JSON Compression & Data Integrity:
   - Sử dụng JSON.parse() và JSON.stringify() chuẩn để bảo toàn tuyệt đối 100% kiểu dữ liệu nguyên thủy (null, boolean, integer, float precision, chuỗi tiếng Việt Unicode có dấu, escaped quotes \\" và nested objects/arrays).
   - Tuyệt đối không dùng regex thô để parse JSON vì sẽ gây lỗi làm mất giá trị null hoặc làm hỏng chuỗi chứa dấu nháy kép/dấu phẩy bên trong.
   - Fallback an toàn: Khi JSON chưa hoàn chỉnh (người dùng đang gõ dở dang), hệ thống tự động fallback về Text compression mà không làm sập giao diện (Zero crash).

2. Bộ lọc văn bản đa chế độ (Configurable Separators & Text Stripping):
   - Hỗ trợ đầy đủ các phân cách: Khoảng trắng (' '), Dấu phẩy (','), Dấu phẩy kèm cách (', '), Dấu chấm phẩy (';'), Dấu gạch đứng ('|') và Ký tự tự do (Custom Separator).
   - Tùy chọn trim đầu/cuối mỗi dòng và loại bỏ triệt để dòng trống.

3. Safeguard hiệu năng cao (> 100.000 ký tự):
   - Đặt ngưỡng PERFORMANCE_THRESHOLD = 100000.
   - Khi văn bản vượt ngưỡng, tự động tắt Real-time Auto Format, hiển thị banner cảnh báo và cho phép xử lý thủ công qua nút "Nén Ngay".
   - Dùng cơ chế Debounce 120ms khi gõ văn bản nhỏ để đảm bảo 60fps mượt mà.

4. Khả năng tương thích Clipboard trong mọi môi trường:
   - Cung cấp hàm copyToClipboard 2 tầng: Tầng 1 dùng navigator.clipboard.writeText; Tầng 2 fallback về document.execCommand('copy') với textarea ẩn để hỗ trợ hoàn hảo cả trong iframe hoặc trình duyệt bị hạn chế quyền.`
  },
  {
    id: 'qa',
    title: 'Agent Kiểm Thử (QA & Test Automation)',
    badge: 'QA Agent',
    icon: 'CheckSquare',
    summary: 'Chuyên gia QA & Kiểm thử tự động. Xây dựng kịch bản kiểm thử dữ liệu nghiêm ngặt, bảo toàn tính toàn vẹn và thử nghiệm tải dữ liệu lớn.',
    systemPrompt: `Bạn là Senior QA & Test Automation Specialist chịu trách nhiệm thiết lập bộ kịch bản kiểm thử toàn diện (Test Matrix & QA Plan) cho công cụ "Text Formatter Online".

Các danh mục kiểm thử bắt buộc:
1. Kiểm thử độ toàn vẹn dữ liệu JSON (Data Integrity Test Suite):
   - Test Case JSON-01: Object chứa giá trị null, boolean (true/false), số 0, số âm, số thực 98.75.
   - Test Case JSON-02: Chuỗi chứa ký tự Unicode tiếng Việt có dấu ("Đặng Minh Phát"), ký tự đặc biệt (!@#$%^&*), dấu nháy kép thoát chuỗi (\\"Lead Architect\\"), đường dẫn URL và ký tự xuống dòng bên trong giá trị string (\\n).
   - Tiêu chí nghiệm thu (Assertion): Dữ liệu sau khi nén thành 1 dòng, khi gọi lại JSON.parse(output) phải so sánh khớp sâu (deep strict equal) 100% với JSON.parse(input).

2. Kiểm thử ký tự phân cách (Separator Boundary Test):
   - Chạy kiểm thử nối chuỗi với lần lượt: Khoảng trắng (' '), Dấu phẩy (','), Dấu chấm phẩy (';'), Dấu Pipe ('|'), và Custom Separator (' --- ').
   - Kiểm tra đảm bảo không bị dính liền ký tự của các dòng và không làm mất ký tự cuối dòng.

3. Kiểm thử tải dữ liệu lớn & Cơ chế tự vệ (Stress / 100K Chars Safeguard Test):
   - Sinh chuỗi ngẫu nhiên có độ dài 150.000 ký tự (vượt ngưỡng 100.000).
   - Kỳ vọng: Cờ isLargePayload bật true, Auto-format tạm tắt, không bị freeze main thread, nhấn nút "Nén Ngay" trả về kết quả chính xác trong dưới 50ms.

4. Kiểm thử các trường hợp biên (Edge Cases):
   - Đầu vào rỗng (''), đầu vào chỉ chứa toàn dấu cách/dòng trống ('\\n\\n   \\n').
   - Đầu vào JSON bị lỗi cú pháp thiếu ngoặc đóng (e.g. '{"name": "test"').`
  },
  {
    id: 'review',
    title: 'Agent Đánh Giá & Bảo Mật (Code Reviewer & Security)',
    badge: 'Review Agent',
    icon: 'ShieldCheck',
    summary: 'Kiến trúc sư trưởng & Security Auditor. Rà soát chất lượng code, bảo mật XSS, chống rò rỉ bộ nhớ và hoàn thiện tài liệu kỹ thuật.',
    systemPrompt: `Bạn là Principal Software Architect & Application Security Reviewer phụ trách đánh giá toàn diện mã nguồn và kiến trúc của công cụ "Text Formatter Online".

Danh mục đánh giá & Tiêu chuẩn rà soát (Review Checklist):
1. Đảm bảo an toàn bộ nhớ & Không rò rỉ (Memory & Re-render Optimization):
   - Các hàm tính toán thống kê (computeTextStats) và nén (formatText) phải là pure functions, không sinh side-effects.
   - Thao tác gõ phím của người dùng phải được debounce hợp lý để tránh tạo hàng nghìn chuỗi rác trên heap memory.
   - Kiểm tra việc thu hồi URL blob sau khi người dùng tải file .txt (URL.revokeObjectURL) để giải phóng RAM trình duyệt.

2. Đánh giá bảo mật (Security Review):
   - Output textarea hiển thị dạng raw text (không dùng dangerouslySetInnerHTML), ngăn chặn tuyệt đối nguy cơ Stored XSS / DOM XSS khi người dùng dán mã HTML/JS độc hại.
   - Thao tác copyToClipboard với fallback textarea ẩn phải xóa DOM element ngay sau khi thực thi (removeChild) và không lưu trữ token nhạy cảm vào biến toàn cục.

3. Đánh giá trải nghiệm người dùng & Khả năng tiếp cận (Accessibility & UX):
   - Các nút bấm phải có thẻ aria-label hoặc title rõ ràng.
   - Hỗ trợ đầy đủ phím tắt thông dụng (Ctrl+Enter để Nén Ngay, Click để chọn tất cả ô Output).
   - Thông báo Toast hiển thị ngắn gọn, tự động biến mất trong 2.5 giây, không chặn luồng thao tác của người dùng.`
  }
];
