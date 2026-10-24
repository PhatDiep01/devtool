import { myersDiff, DiffEdit } from './myers-diff';
import {
  computeIntraLineDiff,
  computeLineSimilarity,
  tokenizeWords,
  tokenizeChars
} from './intra-line-diff';
import { generateUnifiedDiffText } from './patch-generator';
import {
  ComparePayload,
  CompareResult,
  DiffHunk,
  DiffOptions,
  DiffStats,
  SideBySideRow,
  UnifiedRow,
  DiffChangeType,
  DiffToken
} from './types';

interface NormalizedLine {
  raw: string;
  compareKey: string;
  originalLineNumber: number;
}

/**
 * Normalizes input text according to options and splits into line objects with 1-based original line tracking.
 */
function normalizeAndSplitLines(
  text: string,
  options: DiffOptions
): { lines: NormalizedLine[]; normalizedFullText: string } {
  let processed = text;
  if (options.normalizeLineEndings) {
    processed = processed.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  const rawSplit = processed.split('\n');
  const result: NormalizedLine[] = [];
  const normalizedLinesForExport: string[] = [];

  for (let i = 0; i < rawSplit.length; i++) {
    const raw = rawSplit[i];
    let key = raw;

    if (options.trimWhitespace) {
      key = key.trim();
    }
    if (options.collapseWhitespace) {
      key = key.replace(/[ \t]+/g, ' ');
    }
    if (options.ignoreCase) {
      key = key.toLowerCase();
    }

    if (options.ignoreEmptyLines && key.length === 0) {
      continue;
    }

    result.push({
      raw,
      compareKey: key,
      originalLineNumber: i + 1
    });

    let exportLine = raw;
    if (options.trimWhitespace) exportLine = exportLine.trim();
    if (options.collapseWhitespace) exportLine = exportLine.replace(/[ \t]+/g, ' ');
    normalizedLinesForExport.push(exportLine);
  }

  return {
    lines: result,
    normalizedFullText: normalizedLinesForExport.join('\n')
  };
}

/**
 * Main Diff Computation Engine.
 * Supports Line, Word and Character diff modes with intra-line token highlights,
 * side-by-side alignment, unified diffs, hunk discovery and context collapsing.
 */
export function executeDiff(payload: ComparePayload): CompareResult {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const { originalText, modifiedText, diffMode, options, collapseUnchanged, contextLines } = payload;

  const isBothEmpty = originalText.length === 0 && modifiedText.length === 0;
  const isOriginalEmpty = originalText.length === 0 && modifiedText.length > 0;
  const isModifiedEmpty = originalText.length > 0 && modifiedText.length === 0;

  // 1. Line-level normalization
  const origNorm = normalizeAndSplitLines(originalText, options);
  const modNorm = normalizeAndSplitLines(modifiedText, options);

  const origLines = origNorm.lines;
  const modLines = modNorm.lines;

  // 2. Compute diff based on selected diffMode
  let sideBySideRows: SideBySideRow[] = [];
  let unifiedRows: UnifiedRow[] = [];
  let hunks: DiffHunk[] = [];

  let addedCount = 0;
  let removedCount = 0;
  let modifiedCount = 0;
  let unchangedCount = 0;
  let unchangedChars = 0;

  if (diffMode === 'line') {
    // Standard Line Diff with Intra-Line Highlights
    const { edits } = myersDiff(
      origLines,
      modLines,
      (a, b) => a.compareKey === b.compareKey
    );

    // Group contiguous changes for intra-line pairing
    let idx = 0;
    while (idx < edits.length) {
      const edit = edits[idx];

      if (edit.type === 'keep') {
        // Unchanged line
        const leftLine = edit.value;
        const rightLine = modLines[edit.newIndex!];

        sideBySideRows.push({
          rowNumber: sideBySideRows.length,
          type: 'unchanged',
          diffHunkIndex: null,
          left: {
            lineNumber: leftLine.originalLineNumber,
            content: leftLine.raw,
            type: 'unchanged'
          },
          right: {
            lineNumber: rightLine ? rightLine.originalLineNumber : leftLine.originalLineNumber,
            content: rightLine ? rightLine.raw : leftLine.raw,
            type: 'unchanged'
          }
        });

        unifiedRows.push({
          rowNumber: unifiedRows.length,
          oldLineNumber: leftLine.originalLineNumber,
          newLineNumber: rightLine ? rightLine.originalLineNumber : leftLine.originalLineNumber,
          type: 'unchanged',
          content: leftLine.raw,
          diffHunkIndex: null
        });

        unchangedCount++;
        unchangedChars += leftLine.raw.length;
        idx++;
      } else {
        // Collect batch of contiguous deletes and inserts
        const deletedBatch: DiffEdit<NormalizedLine>[] = [];
        const insertedBatch: DiffEdit<NormalizedLine>[] = [];

        while (idx < edits.length && edits[idx].type !== 'keep') {
          if (edits[idx].type === 'delete') {
            deletedBatch.push(edits[idx]);
          } else {
            insertedBatch.push(edits[idx]);
          }
          idx++;
        }

        // Pair deleted and inserted lines using similarity matrix
        const pairedModified: { del: NormalizedLine; ins: NormalizedLine }[] = [];
        const unpairedDeletes: NormalizedLine[] = [];
        const unpairedInserts: NormalizedLine[] = [];

        const usedInserts = new Set<number>();

        for (const delEdit of deletedBatch) {
          const del = delEdit.value;
          let bestMatchIdx = -1;
          let highestSim = 0;

          for (let j = 0; j < insertedBatch.length; j++) {
            if (usedInserts.has(j)) continue;
            const ins = insertedBatch[j].value;
            const sim = computeLineSimilarity(del.raw, ins.raw, options.ignoreCase);
            // Threshold for considering two lines as a "modified" pair
            if (sim > highestSim && sim >= 0.35) {
              highestSim = sim;
              bestMatchIdx = j;
            }
          }

          if (bestMatchIdx !== -1) {
            usedInserts.add(bestMatchIdx);
            pairedModified.push({ del, ins: insertedBatch[bestMatchIdx].value });
          } else {
            unpairedDeletes.push(del);
          }
        }

        for (let j = 0; j < insertedBatch.length; j++) {
          if (!usedInserts.has(j)) {
            unpairedInserts.push(insertedBatch[j].value);
          }
        }

        // Emit paired modified rows
        for (const pair of pairedModified) {
          const intra = computeIntraLineDiff(pair.del.raw, pair.ins.raw, 'word', options.ignoreCase);

          sideBySideRows.push({
            rowNumber: sideBySideRows.length,
            type: 'modified',
            diffHunkIndex: null, // Will be set in hunk discovery pass
            left: {
              lineNumber: pair.del.originalLineNumber,
              content: pair.del.raw,
              type: 'modified',
              tokens: intra.leftTokens
            },
            right: {
              lineNumber: pair.ins.originalLineNumber,
              content: pair.ins.raw,
              type: 'modified',
              tokens: intra.rightTokens
            }
          });

          // In unified view, modified appears as removed followed by added
          unifiedRows.push({
            rowNumber: unifiedRows.length,
            oldLineNumber: pair.del.originalLineNumber,
            newLineNumber: null,
            type: 'removed',
            content: pair.del.raw,
            tokens: intra.leftTokens,
            diffHunkIndex: null
          });

          unifiedRows.push({
            rowNumber: unifiedRows.length,
            oldLineNumber: null,
            newLineNumber: pair.ins.originalLineNumber,
            type: 'added',
            content: pair.ins.raw,
            tokens: intra.rightTokens,
            diffHunkIndex: null
          });

          modifiedCount++;
          // Approximate unchanged characters from intra tokens
          const sharedChars = intra.leftTokens
            .filter(t => t.type === 'unchanged')
            .reduce((acc, t) => acc + t.value.length, 0);
          unchangedChars += sharedChars;
        }

        // Emit unpaired deletes
        for (const del of unpairedDeletes) {
          sideBySideRows.push({
            rowNumber: sideBySideRows.length,
            type: 'removed',
            diffHunkIndex: null,
            left: {
              lineNumber: del.originalLineNumber,
              content: del.raw,
              type: 'removed'
            },
            right: {
              lineNumber: null,
              content: '',
              type: 'empty'
            }
          });

          unifiedRows.push({
            rowNumber: unifiedRows.length,
            oldLineNumber: del.originalLineNumber,
            newLineNumber: null,
            type: 'removed',
            content: del.raw,
            diffHunkIndex: null
          });

          removedCount++;
        }

        // Emit unpaired inserts
        for (const ins of unpairedInserts) {
          sideBySideRows.push({
            rowNumber: sideBySideRows.length,
            type: 'added',
            diffHunkIndex: null,
            left: {
              lineNumber: null,
              content: '',
              type: 'empty'
            },
            right: {
              lineNumber: ins.originalLineNumber,
              content: ins.raw,
              type: 'added'
            }
          });

          unifiedRows.push({
            rowNumber: unifiedRows.length,
            oldLineNumber: null,
            newLineNumber: ins.originalLineNumber,
            type: 'added',
            content: ins.raw,
            diffHunkIndex: null
          });

          addedCount++;
        }
      }
    }
  } else {
    // Word or Char Diff Mode across the whole document
    const origTokens = diffMode === 'char' ? tokenizeChars(originalText) : tokenizeWords(originalText);
    const modTokens = diffMode === 'char' ? tokenizeChars(modifiedText) : tokenizeWords(modifiedText);

    const comparator = (a: string, b: string) => {
      let ka = a;
      let kb = b;
      if (options.ignoreCase) {
        ka = ka.toLowerCase();
        kb = kb.toLowerCase();
      }
      return ka === kb;
    };

    const { edits } = myersDiff(origTokens, modTokens, comparator);

    const leftTokens: DiffToken[] = [];
    const rightTokens: DiffToken[] = [];

    for (const edit of edits) {
      if (edit.type === 'keep') {
        leftTokens.push({ type: 'unchanged', value: edit.value });
        rightTokens.push({ type: 'unchanged', value: edit.value });
        unchangedChars += edit.value.length;
      } else if (edit.type === 'delete') {
        leftTokens.push({ type: 'removed', value: edit.value });
        removedCount++;
      } else if (edit.type === 'insert') {
        rightTokens.push({ type: 'added', value: edit.value });
        addedCount++;
      }
    }

    const hasDiff = edits.some(e => e.type !== 'keep');
    const changeType: DiffChangeType = hasDiff ? 'modified' : 'unchanged';

    sideBySideRows.push({
      rowNumber: 0,
      type: changeType,
      diffHunkIndex: hasDiff ? 0 : null,
      left: {
        lineNumber: 1,
        content: originalText,
        type: changeType,
        tokens: leftTokens
      },
      right: {
        lineNumber: 1,
        content: modifiedText,
        type: changeType,
        tokens: rightTokens
      }
    });

    if (hasDiff) {
      unifiedRows.push({
        rowNumber: 0,
        oldLineNumber: 1,
        newLineNumber: null,
        type: 'removed',
        content: originalText,
        tokens: leftTokens,
        diffHunkIndex: 0
      });
      unifiedRows.push({
        rowNumber: 1,
        oldLineNumber: null,
        newLineNumber: 1,
        type: 'added',
        content: modifiedText,
        tokens: rightTokens,
        diffHunkIndex: 0
      });
      modifiedCount = 1;
    } else {
      unifiedRows.push({
        rowNumber: 0,
        oldLineNumber: 1,
        newLineNumber: 1,
        type: 'unchanged',
        content: originalText,
        tokens: leftTokens,
        diffHunkIndex: null
      });
      unchangedCount = 1;
    }
  }

  // 3. Discover Diff Hunks and attach diffHunkIndex
  hunks = discoverHunks(sideBySideRows, unifiedRows);

  // 4. Handle collapse unchanged lines if requested
  if (collapseUnchanged && hunks.length > 0) {
    applyContextCollapse(sideBySideRows, unifiedRows, hunks, contextLines);
  }

  // 5. Discover Identical status & Compute Similarity Percentage
  const isIdentical =
    !isBothEmpty &&
    addedCount === 0 &&
    removedCount === 0 &&
    modifiedCount === 0;

  const totalOrigChars = originalText.length;
  const totalModChars = modifiedText.length;
  let similarityPercentage = 0;

  if (isBothEmpty || isIdentical) {
    similarityPercentage = 100;
  } else if (isOriginalEmpty || isModifiedEmpty) {
    similarityPercentage = 0;
  } else {
    const denom = totalOrigChars + totalModChars;
    if (denom > 0) {
      similarityPercentage = Math.min(100, Math.max(0, (2 * unchangedChars / denom) * 100));
      similarityPercentage = Math.round(similarityPercentage * 10) / 10;
    }
  }

  const stats: DiffStats = {
    addedLines: addedCount,
    removedLines: removedCount,
    modifiedLines: modifiedCount,
    unchangedLines: unchangedCount,
    totalDiffHunks: hunks.length,
    similarityPercentage
  };

  // 6. Generate Git Unified Diff
  const unifiedDiffText = generateUnifiedDiffText(
    'original',
    'modified',
    unifiedRows,
    hunks
  );

  const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    isIdentical,
    isBothEmpty,
    isOriginalEmpty,
    isModifiedEmpty,
    stats,
    sideBySideRows,
    unifiedRows,
    hunks,
    unifiedDiffText,
    normalizedOriginal: origNorm.normalizedFullText,
    normalizedModified: modNorm.normalizedFullText,
    executionTimeMs: Math.round((endTime - startTime) * 10) / 10
  };
}

/**
 * Groups contiguous changed rows into distinct navigation hunks.
 */
function discoverHunks(
  sideBySideRows: SideBySideRow[],
  unifiedRows: UnifiedRow[]
): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let sStart = -1;

  for (let i = 0; i < sideBySideRows.length; i++) {
    const row = sideBySideRows[i];
    const isChange = row.type !== 'unchanged';

    if (isChange && sStart === -1) {
      sStart = i;
    } else if (!isChange && sStart !== -1) {
      const sEnd = i - 1;
      createHunk(hunks, sideBySideRows, unifiedRows, sStart, sEnd);
      sStart = -1;
    }
  }

  if (sStart !== -1) {
    createHunk(hunks, sideBySideRows, unifiedRows, sStart, sideBySideRows.length - 1);
  }

  // Tag rows with their hunk index
  for (const hunk of hunks) {
    for (let s = hunk.sideBySideStartRow; s <= hunk.sideBySideEndRow; s++) {
      sideBySideRows[s].diffHunkIndex = hunk.index;
    }
    for (let u = hunk.unifiedStartRow; u <= hunk.unifiedEndRow; u++) {
      unifiedRows[u].diffHunkIndex = hunk.index;
    }
  }

  return hunks;
}

function createHunk(
  hunks: DiffHunk[],
  sideBySideRows: SideBySideRow[],
  unifiedRows: UnifiedRow[],
  sStart: number,
  sEnd: number
) {
  const hunkIndex = hunks.length;

  let oldStartLine = 1;
  let newStartLine = 1;
  let oldLineCount = 0;
  let newLineCount = 0;

  for (let s = sStart; s <= sEnd; s++) {
    const r = sideBySideRows[s];
    if (r.left.lineNumber !== null) {
      if (oldLineCount === 0) oldStartLine = r.left.lineNumber;
      oldLineCount++;
    }
    if (r.right.lineNumber !== null) {
      if (newLineCount === 0) newStartLine = r.right.lineNumber;
      newLineCount++;
    }
  }

  // Find corresponding unified start & end rows
  let uStart = -1;
  let uEnd = -1;

  for (let u = 0; u < unifiedRows.length; u++) {
    const uRow = unifiedRows[u];
    if (uRow.type !== 'unchanged') {
      const matchOld = uRow.oldLineNumber !== null && uRow.oldLineNumber >= oldStartLine && uRow.oldLineNumber < oldStartLine + oldLineCount;
      const matchNew = uRow.newLineNumber !== null && uRow.newLineNumber >= newStartLine && uRow.newLineNumber < newStartLine + newLineCount;
      if (matchOld || matchNew) {
        if (uStart === -1) uStart = u;
        uEnd = u;
      }
    }
  }

  if (uStart === -1) uStart = 0;
  if (uEnd === -1) uEnd = unifiedRows.length - 1;

  hunks.push({
    index: hunkIndex,
    sideBySideStartRow: sStart,
    sideBySideEndRow: sEnd,
    unifiedStartRow: uStart,
    unifiedEndRow: uEnd,
    oldStartLine,
    oldLineCount: Math.max(1, oldLineCount),
    newStartLine,
    newLineCount: Math.max(1, newLineCount),
    description: `Khác biệt #${hunkIndex + 1} (dòng ${oldStartLine} -> ${newStartLine})`
  });
}

/**
 * Marks unchanged rows outside of contextLines range as collapsed.
 */
function applyContextCollapse(
  sideBySideRows: SideBySideRow[],
  unifiedRows: UnifiedRow[],
  hunks: DiffHunk[],
  contextLines: number
) {
  const sKept = new Set<number>();
  const uKept = new Set<number>();

  for (const hunk of hunks) {
    const sMin = Math.max(0, hunk.sideBySideStartRow - contextLines);
    const sMax = Math.min(sideBySideRows.length - 1, hunk.sideBySideEndRow + contextLines);
    for (let s = sMin; s <= sMax; s++) {
      sKept.add(s);
    }

    const uMin = Math.max(0, hunk.unifiedStartRow - contextLines);
    const uMax = Math.min(unifiedRows.length - 1, hunk.unifiedEndRow + contextLines);
    for (let u = uMin; u <= uMax; u++) {
      uKept.add(u);
    }
  }

  for (let s = 0; s < sideBySideRows.length; s++) {
    if (sideBySideRows[s].type === 'unchanged' && !sKept.has(s)) {
      sideBySideRows[s].isContextCollapsed = true;
    }
  }

  for (let u = 0; u < unifiedRows.length; u++) {
    if (unifiedRows[u].type === 'unchanged' && !uKept.has(u)) {
      unifiedRows[u].isContextCollapsed = true;
    }
  }
}
