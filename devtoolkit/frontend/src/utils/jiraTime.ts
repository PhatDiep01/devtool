/**
 * Jira Time Parsing, Formatting & Estimation Helpers
 */

export interface ParsedTimePreview {
  valid: boolean;
  text: string;
  seconds: number;
}

/**
 * Client-side parser for time spent input strings.
 * Supports:
 * - Jira units: 1w, 2d, 4h, 30m, 45s
 * - Decimals: 4.5, 1.5h, 0.25d
 * - Vietnamese shorthand: 4h 30p, 2 tiếng, 1 ngày, 45 phút
 * - Colon format: 04:30
 */
export function parseTimePreview(input: string): ParsedTimePreview {
  if (!input || !input.trim()) {
    return { valid: false, text: 'Ví dụ: 4h 30m, 1h 30m, 45m, 2h, 4.5h', seconds: 0 };
  }

  // Normalize comma decimals and common Vietnamese abbreviations
  let trimmed = input.trim().toLowerCase().replace(/(\d+),(\d+)/g, '$1.$2');

  // Support Vietnamese 'p' or 'phút' as 'm' (e.g. 4h 30p -> 4h 30m)
  trimmed = trimmed.replace(/(\d+(?:\.\d+)?)\s*(?:p|phut|phút)\b/g, '$1m');
  // Support Vietnamese 'tiếng' or 'giờ' as 'h'
  trimmed = trimmed.replace(/(\d+(?:\.\d+)?)\s*(?:tieng|tiếng|gio|giờ)\b/g, '$1h');
  // Support Vietnamese 'ngày' as 'd'
  trimmed = trimmed.replace(/(\d+(?:\.\d+)?)\s*(?:ngay|ngày)\b/g, '$1d');

  // Pure decimal or number treated as hours (e.g. 4.5 -> 4h 30m)
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const hours = parseFloat(trimmed);
    const secs = Math.round(hours * 3600);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || parts.length === 0) parts.push(`${m}m`);
    return {
      valid: true,
      text: `${parts.join(' ')} (${secs.toLocaleString()} giây = ${(secs / 3600).toFixed(1)}h)`,
      seconds: secs
    };
  }

  // Colon HH:MM format (e.g. 04:30)
  const colon = /^(\d+):(\d{1,2})$/.exec(trimmed);
  if (colon) {
    const h = parseInt(colon[1], 10);
    const m = parseInt(colon[2], 10);
    const secs = h * 3600 + m * 60;
    return {
      valid: true,
      text: `${h}h ${m}m (${secs.toLocaleString()} giây = ${(secs / 3600).toFixed(1)}h)`,
      seconds: secs
    };
  }

  let totalSeconds = 0;
  const regex = /(\d+(?:\.\d+)?)\s*(w|d|h|m|s)/g;
  let match;
  let count = 0;

  while ((match = regex.exec(trimmed)) !== null) {
    count++;
    const val = parseFloat(match[1]);
    const unit = match[2];
    if (unit === 'w') totalSeconds += val * 5 * 8 * 3600;
    else if (unit === 'd') totalSeconds += val * 8 * 3600;
    else if (unit === 'h') totalSeconds += val * 3600;
    else if (unit === 'm') totalSeconds += val * 60;
    else if (unit === 's') totalSeconds += val;
  }

  if (count > 0 && totalSeconds > 0) {
    const secs = Math.round(totalSeconds);
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
    return {
      valid: true,
      text: `${parts.join(' ')} (${secs.toLocaleString()} giây = ${(secs / 3600).toFixed(1)}h)`,
      seconds: secs
    };
  }

  return { valid: false, text: 'Định dạng chưa đúng. Ví dụ: "4h 30m", "1h 30m", "45m", "4.5h"', seconds: 0 };
}

/**
 * Formats numeric seconds into user-friendly duration string (e.g. 7200 -> '2h', 5400 -> '1h 30m', 28800 -> '8h')
 */
export function formatSecondsToDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(' ');
}

/**
 * Extracts and normalizes the estimated duration (e.g. '2h', '4h', '1h 30m') from subtask timetracking.
 * Normalizes Jira Server fractions (e.g. '0.25d' -> '2h', '0.5d' -> '4h') for intuitive display.
 */
export function extractSubtaskEstimates(timetracking?: {
  originalEstimate?: string;
  remainingEstimate?: string;
  originalEstimateSeconds?: number;
  remainingEstimateSeconds?: number;
  timeSpent?: string;
  timeSpentSeconds?: number;
} | null): { estimate: string | null; remaining: string | null } {
  if (!timetracking) return { estimate: null, remaining: null };

  let estimate: string | null = null;
  let remaining: string | null = null;

  // 1. Original estimate from seconds
  if (typeof timetracking.originalEstimateSeconds === 'number' && timetracking.originalEstimateSeconds > 0) {
    estimate = formatSecondsToDuration(timetracking.originalEstimateSeconds);
  } else if (timetracking.originalEstimate && !['None', '0m', '0h', '0d', 'Not set', ''].includes(timetracking.originalEstimate.trim())) {
    const parsed = parseTimePreview(timetracking.originalEstimate);
    if (parsed.valid && parsed.seconds > 0) {
      estimate = formatSecondsToDuration(parsed.seconds);
    } else {
      estimate = timetracking.originalEstimate.trim();
    }
  }

  // 2. Remaining estimate from seconds
  if (typeof timetracking.remainingEstimateSeconds === 'number' && timetracking.remainingEstimateSeconds > 0) {
    remaining = formatSecondsToDuration(timetracking.remainingEstimateSeconds);
  } else if (timetracking.remainingEstimate && !['None', '0m', '0h', '0d', 'Not set', ''].includes(timetracking.remainingEstimate.trim())) {
    const parsed = parseTimePreview(timetracking.remainingEstimate);
    if (parsed.valid && parsed.seconds > 0) {
      remaining = formatSecondsToDuration(parsed.seconds);
    } else {
      remaining = timetracking.remainingEstimate.trim();
    }
  }

  // If no original estimate was found, but remaining estimate exists (> 0), use remaining as estimate
  if (!estimate && remaining) {
    estimate = remaining;
  }

  return { estimate, remaining };
}
