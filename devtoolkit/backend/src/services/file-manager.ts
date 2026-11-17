import fs from 'fs';
import path from 'path';

let cachedDataDir: string | null = null;

/**
 * Find the repository / workspace root by searching up from __dirname or cwd.
 */
export function getProjectRoot(): string {
  // Check if cwd has .git or devtoolkit
  if (fs.existsSync(path.join(process.cwd(), '.git')) || 
      (fs.existsSync(path.join(process.cwd(), 'devtoolkit')) && fs.existsSync(path.join(process.cwd(), 'package.json')))) {
    return process.cwd();
  }

  let current = __dirname;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(current, '.git')) || 
        (fs.existsSync(path.join(current, 'devtoolkit')) && !fs.existsSync(path.join(current, 'backend')))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return process.cwd();
}

/**
 * Ensure required directory sub-structures exist under DATA_DIR.
 */
export function ensureDataStructure(targetDir: string): void {
  fs.mkdirSync(targetDir, { recursive: true });

  const requiredSubDirs = [
    path.join(targetDir, 'docs', 'modules'),
    path.join(targetDir, 'images'),
    path.join(targetDir, 'bug_files'),
    path.join(targetDir, 'sticky_notes'),
    path.join(targetDir, 'templates'),
    path.join(targetDir, 'schemas'),
    path.join(targetDir, 'backups')
  ];

  for (const subDir of requiredSubDirs) {
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }
  }
}

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
 * Reset cached data dir (useful for unit tests changing environment variables).
 */
export function resetCachedDataDir(): void {
  cachedDataDir = null;
}

/**
 * Get the resolved absolute path to the persistent DATA_DIR.
 * Auto-detects data_docs_tooldev or custom local folder configured via DATA_DIR.
 */
export function getDataDir(): string {
  if (cachedDataDir && fs.existsSync(cachedDataDir)) {
    return cachedDataDir;
  }

  const projectRoot = getProjectRoot();

  // 1. Explicit environment variable DATA_DIR
  if (process.env.DATA_DIR && process.env.DATA_DIR.trim()) {
    const rawPath = process.env.DATA_DIR.trim();
    let targetDir: string;

    if (path.isAbsolute(rawPath)) {
      targetDir = path.resolve(rawPath);
    } else {
      // Relative path: resolve relative to projectRoot first if it exists there,
      // or check process.cwd(), fallback to projectRoot
      const rootCandidate = path.resolve(projectRoot, rawPath);
      const cwdCandidate = path.resolve(process.cwd(), rawPath);

      if (fs.existsSync(rootCandidate)) {
        targetDir = rootCandidate;
      } else if (fs.existsSync(cwdCandidate)) {
        targetDir = cwdCandidate;
      } else {
        targetDir = rootCandidate;
      }
    }

    ensureDataStructure(targetDir);
    cachedDataDir = targetDir;
    return targetDir;
  }

  // 2. Candidate paths in standard directory structure
  const candidatePaths = [
    path.join(projectRoot, 'data_docs_tooldev'),
    path.resolve(process.cwd(), 'data_docs_tooldev'),
    path.resolve(process.cwd(), '../data_docs_tooldev'),
    path.resolve(process.cwd(), '../../data_docs_tooldev'),
    path.join(projectRoot, 'data'),
    path.resolve(process.cwd(), 'data')
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      ensureDataStructure(candidate);
      cachedDataDir = candidate;
      return candidate;
    }
  }

  // 3. Default fallback: create data_docs_tooldev at projectRoot
  const defaultDir = path.join(projectRoot, 'data_docs_tooldev');
  ensureDataStructure(defaultDir);
  cachedDataDir = defaultDir;
  return defaultDir;
}

/**
 * Verify that a path is strictly inside the allowed base directory.
 * Throws an error if a path traversal attempt is detected.
 */
export function assertPathInside(baseDir: string, targetPath: string): void {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);

  const normBase = process.platform === 'win32' ? resolvedBase.toLowerCase() : resolvedBase;
  const normTarget = process.platform === 'win32' ? resolvedTarget.toLowerCase() : resolvedTarget;
  const sep = process.platform === 'win32' ? path.sep.toLowerCase() : path.sep;

  if (!normTarget.startsWith(normBase + sep) && normTarget !== normBase) {
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
