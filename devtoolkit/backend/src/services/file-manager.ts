import fs from 'fs';
import path from 'path';

/**
 * Sanitize a slug to only allow safe alphanumeric characters and hyphens.
 * Prevents directory traversal attacks via crafted slugs.
 */
export function sanitizeSlug(input: string): string {
  if (!input || typeof input !== 'string') return 'general';
  const clean = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return clean || 'general';
}

/**
 * Get the resolved absolute path to the persistent DATA_DIR.
 * Auto-detects data_docs_tooldev if running in the standard repository structure.
 */
export function getDataDir(): string {
  if (process.env.DATA_DIR) {
    const customPath = path.resolve(process.env.DATA_DIR);
    fs.mkdirSync(customPath, { recursive: true });
    return customPath;
  }

  // Look for data_docs_tooldev sibling to devtoolkit
  const candidatePaths = [
    path.resolve(process.cwd(), '../data_docs_tooldev'),
    path.resolve(__dirname, '../../../../data_docs_tooldev'),
    path.resolve(__dirname, '../../../data_docs_tooldev'),
    path.resolve(process.cwd(), 'data_docs_tooldev'),
    path.resolve(process.cwd(), 'data')
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Default fallback: create sibling data_docs_tooldev or local data
  const defaultDir = path.resolve(process.cwd(), '../data_docs_tooldev');
  fs.mkdirSync(defaultDir, { recursive: true });
  return defaultDir;
}

/**
 * Verify that a path is strictly inside the allowed base directory.
 * Throws an error if a path traversal attempt is detected.
 */
export function assertPathInside(baseDir: string, targetPath: string): void {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);

  if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
    throw new Error('Security Error: Path traversal attempt detected');
  }
}

/**
 * Ensure the module directory exists under data/docs/modules/{moduleSlug}.
 */
export function ensureModuleDir(moduleSlug: string): string {
  const safeSlug = sanitizeSlug(moduleSlug);
  const dir = path.join(getDataDir(), 'docs', 'modules', safeSlug);
  assertPathInside(getDataDir(), dir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Save a markdown file to data/docs/modules/{moduleSlug}/{filename}.md safely.
 * @returns The relative path from DATA_DIR (e.g., "docs/modules/general/my-doc.md").
 */
export function saveMarkdownFile(moduleSlug: string, filename: string, content: string): string {
  const safeSlug = sanitizeSlug(moduleSlug);
  ensureModuleDir(safeSlug);

  // Strip extension, sanitize name, then re-append .md
  const baseName = filename.replace(/\.md$/i, '');
  const safeFilename = `${sanitizeSlug(baseName)}.md`;

  const relativePath = path.join('docs', 'modules', safeSlug, safeFilename);
  const absolutePath = path.join(getDataDir(), relativePath);

  assertPathInside(getDataDir(), absolutePath);
  fs.writeFileSync(absolutePath, content, 'utf-8');

  return relativePath;
}

/**
 * Read a markdown file's content by its relative path (from DATA_DIR).
 */
export function readMarkdownFile(filePath: string): string {
  const absolutePath = path.join(getDataDir(), filePath);
  assertPathInside(getDataDir(), absolutePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  return fs.readFileSync(absolutePath, 'utf-8');
}

/**
 * Delete a markdown file by its relative path (from DATA_DIR).
 */
export function deleteMarkdownFile(filePath: string): void {
  const absolutePath = path.join(getDataDir(), filePath);
  assertPathInside(getDataDir(), absolutePath);

  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}
