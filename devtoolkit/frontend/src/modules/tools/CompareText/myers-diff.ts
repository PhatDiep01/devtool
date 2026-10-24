/**
 * Myers Diff Algorithm Implementation
 * An O(ND) Difference Algorithm and Its Variations (Eugene W. Myers, 1986).
 * Highly optimized with fast prefix/suffix pruning and typed array memory traces.
 */

export interface DiffEdit<T> {
  type: 'keep' | 'insert' | 'delete';
  value: T;
  oldIndex?: number;
  newIndex?: number;
}

export interface MyersDiffResult<T> {
  edits: DiffEdit<T>[];
  hasChanges: boolean;
}

/**
 * Computes shortest edit script between array a and b using Myers greedy algorithm.
 * Prunes common prefix and suffix first to ensure sub-millisecond execution for large texts with localized edits.
 */
export function myersDiff<T>(
  a: T[],
  b: T[],
  equals: (itemA: T, itemB: T) => boolean = (x, y) => x === y
): MyersDiffResult<T> {
  const n = a.length;
  const m = b.length;

  // 1. Fast path: Both empty
  if (n === 0 && m === 0) {
    return { edits: [], hasChanges: false };
  }

  // 2. Fast path: 'a' is empty -> all insertions
  if (n === 0) {
    const edits: DiffEdit<T>[] = b.map((val, idx) => ({
      type: 'insert',
      value: val,
      newIndex: idx
    }));
    return { edits, hasChanges: true };
  }

  // 3. Fast path: 'b' is empty -> all deletions
  if (m === 0) {
    const edits: DiffEdit<T>[] = a.map((val, idx) => ({
      type: 'delete',
      value: val,
      oldIndex: idx
    }));
    return { edits, hasChanges: true };
  }

  // 4. Fast pruning: Common prefix
  let prefix = 0;
  while (prefix < n && prefix < m && equals(a[prefix], b[prefix])) {
    prefix++;
  }

  // 5. Fast pruning: Common suffix (ensuring it doesn't overlap prefix)
  let suffix = 0;
  while (
    suffix < n - prefix &&
    suffix < m - prefix &&
    equals(a[n - 1 - suffix], b[m - 1 - suffix])
  ) {
    suffix++;
  }

  const trimmedA = a.slice(prefix, n - suffix);
  const trimmedB = b.slice(prefix, m - suffix);
  const trimmedN = trimmedA.length;
  const trimmedM = trimmedB.length;

  const middleEdits: DiffEdit<T>[] = [];

  if (trimmedN === 0 && trimmedM === 0) {
    // Exactly identical in the middle
  } else if (trimmedN === 0) {
    // Only insertions in the middle
    for (let i = 0; i < trimmedM; i++) {
      middleEdits.push({
        type: 'insert',
        value: trimmedB[i],
        newIndex: prefix + i
      });
    }
  } else if (trimmedM === 0) {
    // Only deletions in the middle
    for (let i = 0; i < trimmedN; i++) {
      middleEdits.push({
        type: 'delete',
        value: trimmedA[i],
        oldIndex: prefix + i
      });
    }
  } else {
    // Myers on the trimmed middle
    const maxD = trimmedN + trimmedM;
    const vOffset = maxD;
    // v array stores maximum x reached on diagonal k = x - y
    const v = new Int32Array(2 * maxD + 1);
    v[1 + vOffset] = 0;
    const trace: Int32Array[] = [];

    let reachedEnd = false;
    let finalD = 0;

    for (let d = 0; d <= maxD; d++) {
      trace.push(new Int32Array(v));

      for (let k = -d; k <= d; k += 2) {
        let x: number;
        if (k === -d || (k !== d && v[k - 1 + vOffset] < v[k + 1 + vOffset])) {
          x = v[k + 1 + vOffset]; // Down (insertion from b)
        } else {
          x = v[k - 1 + vOffset] + 1; // Right (deletion from a)
        }

        let y = x - k;

        // Follow the snake (diagonal)
        while (
          x < trimmedN &&
          y < trimmedM &&
          equals(trimmedA[x], trimmedB[y])
        ) {
          x++;
          y++;
        }

        v[k + vOffset] = x;

        if (x >= trimmedN && y >= trimmedM) {
          reachedEnd = true;
          finalD = d;
          break;
        }
      }

      if (reachedEnd) break;
    }

    // Backtrack from (trimmedN, trimmedM) to (0, 0)
    let curX = trimmedN;
    let curY = trimmedM;
    const reversedMiddleEdits: DiffEdit<T>[] = [];

    for (let step = finalD; step > 0; step--) {
      const prevV = trace[step];
      const k = curX - curY;

      let prevK: number;
      if (k === -step || (k !== step && prevV[k - 1 + vOffset] < prevV[k + 1 + vOffset])) {
        prevK = k + 1;
      } else {
        prevK = k - 1;
      }

      const prevX = prevV[prevK + vOffset];
      const prevY = prevX - prevK;

      // Diagonal snake items (keep)
      while (curX > prevX && curY > prevY) {
        curX--;
        curY--;
        reversedMiddleEdits.push({
          type: 'keep',
          value: trimmedA[curX],
          oldIndex: prefix + curX,
          newIndex: prefix + curY
        });
      }

      // Single step (insertion or deletion)
      if (curX === prevX) {
        curY--;
        reversedMiddleEdits.push({
          type: 'insert',
          value: trimmedB[curY],
          newIndex: prefix + curY
        });
      } else {
        curX--;
        reversedMiddleEdits.push({
          type: 'delete',
          value: trimmedA[curX],
          oldIndex: prefix + curX
        });
      }
    }

    // Process snake at step = 0
    while (curX > 0 && curY > 0) {
      curX--;
      curY--;
      reversedMiddleEdits.push({
        type: 'keep',
        value: trimmedA[curX],
        oldIndex: prefix + curX,
        newIndex: prefix + curY
      });
    }

    reversedMiddleEdits.reverse();
    middleEdits.push(...reversedMiddleEdits);
  }

  // Construct final edits with prefix and suffix
  const allEdits: DiffEdit<T>[] = [];

  // 1. Common prefix keeps
  for (let i = 0; i < prefix; i++) {
    allEdits.push({
      type: 'keep',
      value: a[i],
      oldIndex: i,
      newIndex: i
    });
  }

  // 2. Middle edits
  allEdits.push(...middleEdits);

  // 3. Common suffix keeps
  for (let i = 0; i < suffix; i++) {
    const oldIdx = n - suffix + i;
    const newIdx = m - suffix + i;
    allEdits.push({
      type: 'keep',
      value: a[oldIdx],
      oldIndex: oldIdx,
      newIndex: newIdx
    });
  }

  const hasChanges = allEdits.some(e => e.type !== 'keep');

  return { edits: allEdits, hasChanges };
}
