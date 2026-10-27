import { AnnotationItem, NormalizedPoint } from '../../../../types';

/**
 * Clamp a number between min and max
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Clamp a number to [0, 1]
 */
export function clamp01(val: number): number {
  return clamp(val, 0, 1);
}

/**
 * Convert pixel coords relative to container into normalized 0..1 coordinates
 */
export function toNormalized(pixelX: number, pixelY: number, containerWidth: number, containerHeight: number): NormalizedPoint {
  if (containerWidth <= 0 || containerHeight <= 0) return { x: 0, y: 0 };
  return {
    x: clamp01(pixelX / containerWidth),
    y: clamp01(pixelY / containerHeight),
  };
}

/**
 * Convert normalized 0..1 coordinates to pixel coords relative to container
 */
export function toScreen(normX: number, normY: number, containerWidth: number, containerHeight: number): { x: number; y: number } {
  return {
    x: normX * containerWidth,
    y: normY * containerHeight,
  };
}

/**
 * Calculates distance from point (px, py) to segment (x1, y1)-(x2, y2)
 */
export function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Rigidly clamps translation delta (dx, dy) for multi-point objects (arrows, lines)
 * ensuring neither endpoint exceeds [0, 1] bounds without distorting shape length or angle.
 */
export function clampSegmentDelta(
  dx: number,
  dy: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { dx: number; dy: number } {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  return {
    dx: clamp(dx, -minX, 1 - maxX),
    dy: clamp(dy, -minY, 1 - maxY),
  };
}

/**
 * Generates formatted Markdown summary table of all annotations
 */
export function generateMarkdownSummary(
  bugTitle: string,
  usKey: string | null | undefined,
  imageName: string,
  annotations: AnnotationItem[]
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

/**
 * Composites the source image with vector annotations onto an offscreen canvas
 * at the image's original full resolution, returning a PNG Blob.
 */
export async function compositeImageWithAnnotations(
  imageSrc: string,
  annotations: AnnotationItem[]
): Promise<Blob> {
  let blobUrl = '';
  let img: HTMLImageElement;

  try {
    const res = await fetch(imageSrc, { mode: 'cors' });
    const imgBlob = await res.blob();
    blobUrl = URL.createObjectURL(imgBlob);

    img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image blob'));
      img.src = blobUrl;
    });
  } catch {
    img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load image from: ${imageSrc}`));
      img.src = imageSrc;
    });
  }

  try {
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas 2D context is not available');
    }

    // Draw original image
    ctx.drawImage(img, 0, 0, width, height);

    // Render annotations sorted by sequence
    const sorted = [...annotations].sort((a, b) => a.sequence - b.sequence);

      for (const ann of sorted) {
        ctx.save();
        ctx.strokeStyle = ann.color || '#EF4444';
        ctx.fillStyle = ann.color || '#EF4444';
        // Scale strokeWidth proportional to image resolution
        const scaleFactor = Math.max(width, height) / 1000;
        const scaledStroke = Math.max(2, (ann.strokeWidth || 3) * scaleFactor);
        ctx.lineWidth = scaledStroke;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const x = ann.x * width;
        const y = ann.y * height;
        const w = (ann.width || 0) * width;
        const h = (ann.height || 0) * height;

        if (ann.type === 'rect') {
          ctx.strokeRect(x, y, w, h);
          if (ann.fillOpacity && ann.fillOpacity > 0) {
            ctx.globalAlpha = ann.fillOpacity;
            ctx.fillRect(x, y, w, h);
            ctx.globalAlpha = 1.0;
          }
          drawSequenceTag(ctx, ann.sequence, x, y, ann.color, scaleFactor);
        } else if (ann.type === 'circle') {
          ctx.beginPath();
          const rx = Math.abs(w) / 2;
          const ry = Math.abs(h) / 2;
          const cx = x + rx;
          const cy = y + ry;
          ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
          ctx.stroke();
          if (ann.fillOpacity && ann.fillOpacity > 0) {
            ctx.globalAlpha = ann.fillOpacity;
            ctx.fill();
            ctx.globalAlpha = 1.0;
          }
          drawSequenceTag(ctx, ann.sequence, x, y, ann.color, scaleFactor);
        } else if (ann.type === 'highlight') {
          ctx.globalAlpha = 0.35;
          ctx.fillRect(x, y, w, h);
          ctx.globalAlpha = 1.0;
          ctx.strokeRect(x, y, w, h);
          drawSequenceTag(ctx, ann.sequence, x, y, ann.color, scaleFactor);
        } else if (ann.type === 'arrow' || ann.type === 'line') {
          const x2 = (ann.x2 !== undefined ? ann.x2 : ann.x) * width;
          const y2 = (ann.y2 !== undefined ? ann.y2 : ann.y) * height;

          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          if (ann.type === 'arrow') {
            // Draw arrowhead
            const angle = Math.atan2(y2 - y, x2 - x);
            const headLen = Math.max(12, 16 * scaleFactor);
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(
              x2 - headLen * Math.cos(angle - Math.PI / 6),
              y2 - headLen * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
              x2 - headLen * Math.cos(angle + Math.PI / 6),
              y2 - headLen * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();
          }
          drawSequenceTag(ctx, ann.sequence, x, y, ann.color, scaleFactor);
        } else if (ann.type === 'badge') {
          // Circular number badge
          const radius = Math.max(14, 18 * scaleFactor);
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, 2 * Math.PI);
          ctx.fillStyle = ann.color || '#EF4444';
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = Math.max(2, 3 * scaleFactor);
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = `bold ${Math.round(radius * 1.1)}px system-ui, -apple-system, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(ann.sequence), x, y + 1);
        } else if (ann.type === 'text') {
          // Text box with optional background
          const fontSize = Math.max(14, Math.round((ann.fontSize || 16) * scaleFactor));
          ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
          
          const text = ann.note || ann.title || '';
          const padding = 6 * scaleFactor;
          const textMetrics = ctx.measureText(text);
          const boxWidth = Math.max(w, textMetrics.width + padding * 2);
          const boxHeight = Math.max(h, fontSize + padding * 2);

          // Background pill
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          roundRect(ctx, x, y, boxWidth, boxHeight, 4 * scaleFactor);
          ctx.fill();
          ctx.strokeStyle = ann.color || '#EF4444';
          ctx.lineWidth = Math.max(1.5, 2 * scaleFactor);
          ctx.stroke();

          // Text content
          ctx.fillStyle = '#FFFFFF';
          ctx.textBaseline = 'top';
          ctx.textAlign = 'left';
          ctx.fillText(text, x + padding, y + padding);

          drawSequenceTag(ctx, ann.sequence, x, y, ann.color, scaleFactor);
        }

        ctx.restore();
      }

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas blob generation failed'));
        }
      }, 'image/png');
    });
  } finally {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
  }
}

function drawSequenceTag(ctx: CanvasRenderingContext2D, seq: number, x: number, y: number, color: string, scaleFactor: number) {
  ctx.save();
  const radius = Math.max(10, 12 * scaleFactor);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fillStyle = color || '#EF4444';
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = Math.max(1.5, 2 * scaleFactor);
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${Math.round(radius * 1.1)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(seq), x, y);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
