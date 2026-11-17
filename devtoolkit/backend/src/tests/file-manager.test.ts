import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  getDataDir,
  getProjectRoot,
  sanitizeSlug,
  assertPathInside,
  saveMarkdownFile,
  readMarkdownFile,
  deleteMarkdownFile,
  resetCachedDataDir,
  ensureDataStructure
} from '../services/file-manager';

describe('File Manager & Local Persistent Data Storage Test Suite', () => {
  const originalEnvDataDir = process.env.DATA_DIR;
  let tempTestDir: string;

  before(() => {
    tempTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dtk-file-manager-test-'));
  });

  after(() => {
    // Restore env and cache
    if (originalEnvDataDir !== undefined) {
      process.env.DATA_DIR = originalEnvDataDir;
    } else {
      delete process.env.DATA_DIR;
    }
    resetCachedDataDir();

    // Clean up temp dir
    try {
      if (fs.existsSync(tempTestDir)) {
        fs.rmSync(tempTestDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('should sanitize slugs properly and prevent directory traversal sequences', () => {
    assert.equal(sanitizeSlug('hello world'), 'hello-world');
    assert.equal(sanitizeSlug('feature/../../dangerous'), 'feature-dangerous');
    assert.equal(sanitizeSlug('Quản Lý Khảo Sát'), 'qu-n-l-kh-o-s-t');
    assert.equal(sanitizeSlug('---test---'), 'test');
    assert.equal(sanitizeSlug(''), 'general');
    assert.equal(sanitizeSlug(null as any), 'general');
  });

  it('should locate project root containing devtoolkit or git repository', () => {
    const root = getProjectRoot();
    assert.ok(root, 'Project root should not be empty');
    assert.ok(
      fs.existsSync(path.join(root, 'devtoolkit')) || fs.existsSync(path.join(root, '.git')),
      'Project root must contain devtoolkit or .git'
    );
  });

  it('should respect custom absolute DATA_DIR environment variable', () => {
    resetCachedDataDir();
    const customLocalDir = path.join(tempTestDir, 'custom_local_data');
    process.env.DATA_DIR = customLocalDir;

    const dataDir = getDataDir();
    assert.equal(path.resolve(dataDir), path.resolve(customLocalDir));
    assert.ok(fs.existsSync(dataDir), 'DATA_DIR must be created automatically');

    // Subdirectories must exist
    assert.ok(fs.existsSync(path.join(dataDir, 'docs', 'modules')));
    assert.ok(fs.existsSync(path.join(dataDir, 'images')));
    assert.ok(fs.existsSync(path.join(dataDir, 'bug_files')));
    assert.ok(fs.existsSync(path.join(dataDir, 'sticky_notes')));
    assert.ok(fs.existsSync(path.join(dataDir, 'templates')));
    assert.ok(fs.existsSync(path.join(dataDir, 'schemas')));
    assert.ok(fs.existsSync(path.join(dataDir, 'backups')));
  });

  it('should respect relative DATA_DIR environment variable resolved against root/cwd', () => {
    resetCachedDataDir();
    const relativeFolder = './test_relative_data_' + Date.now();
    process.env.DATA_DIR = relativeFolder;

    const dataDir = getDataDir();
    assert.ok(fs.existsSync(dataDir), 'Target data directory must exist');
    assert.ok(path.isAbsolute(dataDir), 'Returned path must be absolute');

    // Clean up created relative folder
    try {
      if (fs.existsSync(dataDir)) {
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('should prevent path traversal attacks in assertPathInside', () => {
    const safeBase = tempTestDir;
    const insidePath = path.join(safeBase, 'docs', 'file.md');
    assert.doesNotThrow(() => assertPathInside(safeBase, insidePath));
    assert.doesNotThrow(() => assertPathInside(safeBase, safeBase));

    const outsidePath = path.resolve(safeBase, '..', 'sneaky.txt');
    assert.throws(
      () => assertPathInside(safeBase, outsidePath),
      /Security Error: Path traversal attempt detected/
    );
  });

  it('should save, read, and delete markdown files safely inside DATA_DIR', () => {
    resetCachedDataDir();
    const isolatedDir = path.join(tempTestDir, 'crud_test');
    process.env.DATA_DIR = isolatedDir;

    const moduleSlug = 'test-module';
    const filename = 'my-screen-doc.md';
    const content = '# Title\n\nTest content for local file storage.';

    // Save
    const relativePath = saveMarkdownFile(moduleSlug, filename, content);
    assert.ok(relativePath.includes('docs'), 'Relative path must include docs directory');

    // Read
    const loadedContent = readMarkdownFile(relativePath);
    assert.equal(loadedContent, content);

    // Delete
    deleteMarkdownFile(relativePath);
    assert.throws(() => readMarkdownFile(relativePath), /File not found/);
  });
});
