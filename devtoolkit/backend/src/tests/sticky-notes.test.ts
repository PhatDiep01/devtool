import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  createNote,
  getNoteById,
  updateNote,
  duplicateNote,
  moveToTrash,
  restoreFromTrash,
  permanentlyDelete,
  listNotes,
  importNote,
  parseNoteContent,
  serializeNote,
  ConcurrencyConflictError,
  getStickyNotesDir,
  getStickyNotesTrashDir
} from '../services/sticky-notes-manager';

describe('Sticky Notes Backend Logic & Storage Test Suite', () => {
  const createdIds: string[] = [];

  after(() => {
    // Clean up created test files
    for (const id of createdIds) {
      try { moveToTrash(id); } catch {}
      try { permanentlyDelete(id); } catch {}
    }
  });

  describe('1. CRUD & Vietnamese UTF-8 Support', () => {
    it('should create a sticky note with UTF-8 Vietnamese and default values', () => {
      const note = createNote({
        title: 'Ghi chú kiểm thử tiếng Việt: Có dấu & Ký tự đặc biệt !@#',
        content: '# Tiêu đề 1\n- [x] Việc 1: Hoàn thành kiểm thử\n- [ ] Việc 2: Giao hàng',
        color: 'pink',
        pinned: true
      });

      assert.ok(note.id);
      createdIds.push(note.id);
      assert.equal(note.color, 'pink');
      assert.equal(note.pinned, true);
      assert.equal(note.version, 1);
      assert.ok(note.title.includes('tiếng Việt'));
      assert.ok(note.filename.endsWith('.txt'));

      // Check file exists on filesystem
      const noteDir = getStickyNotesDir();
      const filePath = path.join(noteDir, note.filename);
      assert.ok(fs.existsSync(filePath), 'File must exist on disk');

      // Verify file content is valid UTF-8 and contains frontmatter
      const raw = fs.readFileSync(filePath, 'utf-8');
      assert.ok(raw.includes('title:'));
      assert.ok(raw.includes('Ghi chú kiểm thử tiếng Việt'));
      assert.ok(raw.includes('color: pink'));
    });

    it('should retrieve the created note accurately', () => {
      const id = createdIds[0];
      const fetched = getNoteById(id);

      assert.equal(fetched.id, id);
      assert.equal(fetched.color, 'pink');
      assert.equal(fetched.pinned, true);
      assert.ok(fetched.content.includes('Việc 1: Hoàn thành kiểm thử'));
    });

    it('should update note title, content and bump version', () => {
      const id = createdIds[0];
      const updated = updateNote(id, {
        title: 'Tên ghi chú đã cập nhật',
        content: 'Nội dung mới cập nhật',
        color: 'blue',
        pinned: false,
        expectedVersion: 1
      });

      assert.equal(updated.version, 2);
      assert.equal(updated.title, 'Tên ghi chú đã cập nhật');
      assert.equal(updated.color, 'blue');
      assert.equal(updated.pinned, false);
      assert.equal(updated.content, 'Nội dung mới cập nhật');
    });

    it('should detect concurrency conflicts and reject outdated versions', () => {
      const id = createdIds[0];
      // Note is currently version 2. Attempting to update with expectedVersion 1 must throw ConcurrencyConflictError
      assert.throws(
        () => {
          updateNote(id, {
            content: 'Tab 2 cố tình ghi đè dữ liệu cũ',
            expectedVersion: 1
          });
        },
        (err: any) => {
          assert.ok(err instanceof ConcurrencyConflictError);
          assert.equal(err.conflictData.currentVersion, 2);
          return true;
        }
      );
    });
  });

  describe('2. Duplication & Trash Workflow', () => {
    let duplicatedId = '';

    it('should duplicate a note with (Copy) appended to title and unpinned', () => {
      const sourceId = createdIds[0];
      const duplicated = duplicateNote(sourceId);

      assert.ok(duplicated.id);
      assert.notEqual(duplicated.id, sourceId);
      createdIds.push(duplicated.id);
      duplicatedId = duplicated.id;

      assert.ok(duplicated.title.includes('(Copy)'));
      assert.equal(duplicated.pinned, false);
      assert.equal(duplicated.version, 1);
    });

    it('should move note to trash safely', () => {
      const result = moveToTrash(duplicatedId);
      assert.equal(result.success, true);

      // Verify it cannot be retrieved from active
      assert.throws(() => getNoteById(duplicatedId, false));

      // But can be retrieved from trash
      const inTrash = getNoteById(duplicatedId, true);
      assert.equal(inTrash.id, duplicatedId);
    });

    it('should restore note from trash back to active', () => {
      const restored = restoreFromTrash(duplicatedId);
      assert.equal(restored.id, duplicatedId);

      // Now retrievable from active
      const active = getNoteById(duplicatedId, false);
      assert.equal(active.id, duplicatedId);
    });

    it('should permanently delete note from trash', () => {
      moveToTrash(duplicatedId);
      const res = permanentlyDelete(duplicatedId);
      assert.equal(res.success, true);

      // Must no longer exist in trash
      assert.throws(() => getNoteById(duplicatedId, true));
    });
  });

  describe('3. Import & Plain Text Fallback', () => {
    it('should import plain .txt file without frontmatter and fallback gracefully', () => {
      const plainText = `Danh sách việc cần làm buổi sáng\n- Đi chợ\n- Nấu cơm\n- Làm bài tập`;
      const imported = importNote('viec-buoi-sang.txt', plainText);

      assert.ok(imported.id);
      createdIds.push(imported.id);

      assert.equal(imported.title, 'viec-buoi-sang');
      assert.equal(imported.color, 'yellow');
      assert.ok(imported.content.includes('Danh sách việc cần làm buổi sáng'));
    });

    it('should list notes with sorting and search filter', () => {
      const list = listNotes({ search: 'cập nhật' });
      assert.ok(list.notes.length >= 1);
      assert.ok(list.notes.some(n => n.title.includes('cập nhật') || n.content.includes('cập nhật')));
    });
  });
});
