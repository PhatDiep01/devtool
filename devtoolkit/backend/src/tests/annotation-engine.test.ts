import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Core math and coordinate transformation logic
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function clamp01(val: number): number {
  return clamp(val, 0, 1);
}

function toNormalized(pixelX: number, pixelY: number, containerWidth: number, containerHeight: number) {
  if (containerWidth <= 0 || containerHeight <= 0) return { x: 0, y: 0 };
  return {
    x: clamp01(pixelX / containerWidth),
    y: clamp01(pixelY / containerHeight),
  };
}

function toScreen(normX: number, normY: number, containerWidth: number, containerHeight: number) {
  return {
    x: normX * containerWidth,
    y: normY * containerHeight,
  };
}

function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function generateMarkdownSummary(
  bugTitle: string,
  usKey: string | null | undefined,
  imageName: string,
  annotations: any[]
): string {
  const sorted = [...annotations].sort((a, b) => a.sequence - b.sequence);
  const typeMap: Record<string, string> = {
    rect: 'Hình chữ nhật',
    circle: 'Hình elip / tròn',
    arrow: 'Mũi tên',
    line: 'Đường thẳng',
    badge: 'Huy hiệu số',
    text: 'Văn bản',
    highlight: 'Làm nổi bật',
  };

  const statusMap: Record<string, string> = {
    open: '🔴 Chưa fix',
    fixing: '🔵 Đang fix',
    resolved: '🟢 Đã fix',
  };

  const header = `### Danh sách điểm đánh dấu lỗi trên ảnh: ${imageName}\n**Bug:** ${bugTitle}${usKey ? ` (${usKey})` : ''}\n**Tổng số điểm đánh dấu:** ${annotations.length}\n`;

  if (sorted.length === 0) {
    return header + '\n_Chưa có điểm đánh dấu nào trên ảnh này._\n';
  }

  let table = '| # | Loại | Ghi chú / Chi tiết lỗi | Trạng thái | Vị trí (X, Y) |\n';
  table += '|:---:|:---|:---|:---:|:---:|\n';

  for (const item of sorted) {
    const typeLabel = typeMap[item.type] || item.type;
    const statusLabel = statusMap[item.status] || item.status;
    const noteClean = (item.note || item.title || '(Không có ghi chú)').replace(/\n/g, '<br/>').replace(/\|/g, '\\|');
    const posX = `${Math.round(item.x * 100)}%`;
    const posY = `${Math.round(item.y * 100)}%`;
    table += `| **${item.sequence}** | ${typeLabel} | ${noteClean} | ${statusLabel} | ${posX}, ${posY} |\n`;
  }

  return header + '\n' + table;
}

describe('Annotation Engine Geometry & Data Serialization Test Suite', () => {
  describe('1. Coordinate Normalization & Boundary Clamping', () => {
    it('should normalize coordinates accurately within 0.0 to 1.0', () => {
      const norm = toNormalized(500, 250, 1000, 500);
      assert.equal(norm.x, 0.5);
      assert.equal(norm.y, 0.5);
    });

    it('should clamp negative coordinates to 0.0', () => {
      const norm = toNormalized(-150, -50, 1000, 500);
      assert.equal(norm.x, 0);
      assert.equal(norm.y, 0);
    });

    it('should clamp overflow coordinates beyond container to 1.0', () => {
      const norm = toNormalized(1200, 800, 1000, 500);
      assert.equal(norm.x, 1);
      assert.equal(norm.y, 1);
    });

    it('should handle zero or negative container dimensions gracefully', () => {
      const norm = toNormalized(100, 100, 0, 0);
      assert.equal(norm.x, 0);
      assert.equal(norm.y, 0);
    });

    it('should convert normalized coordinates back to screen pixels reversibly', () => {
      const origX = 0.25;
      const origY = 0.75;
      const screen = toScreen(origX, origY, 1920, 1080);
      assert.equal(screen.x, 480);
      assert.equal(screen.y, 810);

      const backToNorm = toNormalized(screen.x, screen.y, 1920, 1080);
      assert.equal(backToNorm.x, origX);
      assert.equal(backToNorm.y, origY);
    });
  });

  describe('2. Distance & Geometry Calculations', () => {
    it('should calculate distance 0 for point on line segment', () => {
      const dist = distanceToSegment(50, 50, 0, 0, 100, 100);
      assert.ok(dist < 1e-6);
    });

    it('should calculate accurate perpendicular distance for point off line segment', () => {
      const dist = distanceToSegment(50, 60, 0, 50, 100, 50);
      assert.equal(Math.round(dist), 10);
    });

    it('should measure distance to closest endpoint when point is beyond segment bounds', () => {
      const dist = distanceToSegment(120, 50, 0, 50, 100, 50);
      assert.equal(Math.round(dist), 20);
    });
  });

  describe('3. Undo / Redo & Sequence Invariants', () => {
    it('should keep sequence numbers contiguous when an intermediate item is deleted', () => {
      const items = [
        { id: '1', sequence: 1, note: 'Step 1' },
        { id: '2', sequence: 2, note: 'Step 2' },
        { id: '3', sequence: 3, note: 'Step 3' },
        { id: '4', sequence: 4, note: 'Step 4' },
      ];

      // Delete item 2
      const filtered = items.filter(i => i.id !== '2');
      const renumbered = filtered.map((item, idx) => ({ ...item, sequence: idx + 1 }));

      assert.equal(renumbered.length, 3);
      assert.deepEqual(renumbered.map(r => r.sequence), [1, 2, 3]);
      assert.equal(renumbered[1].id, '3');
      assert.equal(renumbered[1].sequence, 2);
    });
  });

  describe('4. Markdown Export Formatting', () => {
    it('should produce structured markdown table with proper headers and status', () => {
      const annotations = [
        {
          id: 'a1',
          type: 'rect',
          sequence: 1,
          x: 0.25,
          y: 0.1,
          note: 'Sai font chữ tiêu đề',
          status: 'open'
        },
        {
          id: 'a2',
          type: 'arrow',
          sequence: 2,
          x: 0.5,
          y: 0.5,
          note: 'Icon bị lệch 5px | cần căn giữa',
          status: 'resolved'
        }
      ];

      const md = generateMarkdownSummary('Lỗi Đăng Nhập', 'SURV-102', 'login_error.png', annotations);

      assert.ok(md.includes('### Danh sách điểm đánh dấu lỗi trên ảnh: login_error.png'));
      assert.ok(md.includes('**Bug:** Lỗi Đăng Nhập (SURV-102)'));
      assert.ok(md.includes('| **1** | Hình chữ nhật | Sai font chữ tiêu đề | 🔴 Chưa fix | 25%, 10% |'));
      // Verifies pipe escaping
      assert.ok(md.includes('Icon bị lệch 5px \\| cần căn giữa'));
      assert.ok(md.includes('| **2** | Mũi tên |'));
      assert.ok(md.includes('🟢 Đã fix'));
    });

    it('should format clean empty message when annotations list is empty', () => {
      const md = generateMarkdownSummary('Bug sạch', undefined, 'clean.png', []);
      assert.ok(md.includes('_Chưa có điểm đánh dấu nào trên ảnh này._'));
    });
  });

  describe('5. Rigid Body Movement & Zoom Math', () => {
    it('should clamp rigid translation delta for multi-point segments without distortion', () => {
      const x1 = 0.2, y1 = 0.3, x2 = 0.8, y2 = 0.9;
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const clampedDx = clamp(0.5, -minX, 1 - maxX);
      assert.ok(Math.abs(clampedDx - 0.2) < 1e-6);
      assert.ok(Math.abs((x1 + clampedDx) - 0.4) < 1e-6);
      assert.ok(Math.abs((x2 + clampedDx) - 1.0) < 1e-6);
      // Length must be preserved
      assert.ok(Math.abs(Math.abs((x2 + clampedDx) - (x1 + clampedDx)) - Math.abs(x2 - x1)) < 1e-6);
    });

    it('should compute zoom correctly on mouse wheel delta', () => {
      const zoom = 1.0;
      const deltaY = -100; // Scroll up -> zoom in
      const newZoom = Number((zoom + (deltaY < 0 ? 0.25 : -0.25)).toFixed(2));
      assert.equal(newZoom, 1.25);
    });
  });
});
