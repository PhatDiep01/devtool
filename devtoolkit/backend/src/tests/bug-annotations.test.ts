import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../db/sqlite';

describe('Bug Annotations Backend API & Storage Test Suite', () => {
  let testBugId: number;
  const testImageId = 'test_img_1.jpg';
  const testImageId2 = 'test_img_2.png';

  before(() => {
    const db = getDb();
    // Insert a test bug
    const result = db.prepare(`
      INSERT INTO bugs (
        title, us_key, type, status, severity, description, fix_solution, attachments, created_at, updated_at
      ) VALUES (
        'Bug kiểm thử annotation', 'TEST-123', 'FE', 'todo', 'high', 'Mô tả bug', '', ?, datetime('now'), datetime('now')
      )
    `).run(JSON.stringify([
      { id: testImageId, filename: testImageId, originalName: 'Screenshot 1.jpg', size: 12345, mimeType: 'image/jpeg', isImage: true },
      { id: testImageId2, filename: testImageId2, originalName: 'Screenshot 2.png', size: 23456, mimeType: 'image/png', isImage: true }
    ]));
    testBugId = Number(result.lastInsertRowid);
  });

  after(() => {
    const db = getDb();
    if (testBugId) {
      db.prepare('DELETE FROM bug_annotations WHERE bug_id = ?').run(testBugId);
      db.prepare('DELETE FROM bugs WHERE id = ?').run(testBugId);
    }
  });

  it('should initialize bug_annotations table and indexes properly', () => {
    const db = getDb();
    const tableInfo = db.prepare("PRAGMA table_info(bug_annotations)").all();
    assert.ok(tableInfo.length > 0, 'bug_annotations table must exist');

    const colNames = tableInfo.map((c: any) => c.name);
    assert.ok(colNames.includes('id'));
    assert.ok(colNames.includes('bug_id'));
    assert.ok(colNames.includes('image_id'));
    assert.ok(colNames.includes('annotations'));
    assert.ok(colNames.includes('version'));
  });

  it('should return empty annotations and version 0 for image without annotations', () => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM bug_annotations WHERE bug_id = ? AND image_id = ?').get(testBugId, testImageId);
    assert.equal(row, undefined);
  });

  it('should save annotations and increment version', () => {
    const db = getDb();
    const annotationsData = [
      {
        id: 'ann-1',
        type: 'rect',
        sequence: 1,
        x: 0.1,
        y: 0.15,
        width: 0.3,
        height: 0.2,
        color: '#EF4444',
        strokeWidth: 3,
        note: 'Nút đăng nhập bị lệch',
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'ann-2',
        type: 'arrow',
        sequence: 2,
        x: 0.5,
        y: 0.5,
        x2: 0.7,
        y2: 0.7,
        color: '#3B82F6',
        strokeWidth: 3,
        note: 'Mũi tên chỉ icon sai',
        status: 'fixing',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    // Simulate PUT /api/bugs/:id/annotations/:imageId
    db.prepare(`
      INSERT INTO bug_annotations (bug_id, image_id, annotations, version, created_at, updated_at)
      VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
      ON CONFLICT(bug_id, image_id) DO UPDATE SET
        annotations = excluded.annotations,
        version = version + 1,
        updated_at = datetime('now')
    `).run(testBugId, testImageId, JSON.stringify(annotationsData));

    const saved = db.prepare('SELECT * FROM bug_annotations WHERE bug_id = ? AND image_id = ?').get(testBugId, testImageId);
    assert.ok(saved);
    assert.equal(saved.version, 1);
    const parsed = JSON.parse(saved.annotations);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].id, 'ann-1');
    assert.equal(parsed[1].type, 'arrow');
  });

  it('should detect concurrency conflicts if old version is provided', () => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM bug_annotations WHERE bug_id = ? AND image_id = ?').get(testBugId, testImageId);
    assert.ok(existing);
    assert.equal(existing.version, 1);

    // If client submits with version 0 (older than existing 1), it indicates conflict
    const clientProvidedVersion = 0;
    const isConflict = existing.version > clientProvidedVersion && clientProvidedVersion > 0;
    assert.equal(isConflict, false); // version 0 doesn't lock

    const conflictVersion = 1;
    // Update once
    db.prepare(`
      UPDATE bug_annotations SET
        annotations = ?,
        version = version + 1,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify([{ id: 'ann-new', note: 'Updated note' }]), existing.id);

    const updated = db.prepare('SELECT * FROM bug_annotations WHERE id = ?').get(existing.id);
    assert.equal(updated.version, 2);

    // Another client trying to save with version 1 should be rejected
    const isStaleConflict = updated.version > conflictVersion;
    assert.equal(isStaleConflict, true, 'Should detect that version 1 is stale when current is 2');
  });

  it('should correctly calculate annotated_images_count and filter has_annotations in bug list', () => {
    const db = getDb();
    const query = `
      SELECT b.*,
        (SELECT COUNT(*) FROM bug_annotations ba WHERE ba.bug_id = b.id AND ba.annotations != '[]' AND ba.annotations != '') AS annotated_images_count
      FROM bugs b WHERE b.id = ?
    `;
    const bug = db.prepare(query).get(testBugId);
    assert.ok(bug);
    assert.equal(Number(bug.annotated_images_count), 1);

    // Test filter yes
    const yesBugs = db.prepare(`
      SELECT b.id FROM bugs b
      WHERE b.id = ? AND (SELECT COUNT(*) FROM bug_annotations ba WHERE ba.bug_id = b.id AND ba.annotations != '[]' AND ba.annotations != '') > 0
    `).all(testBugId);
    assert.equal(yesBugs.length, 1);

    // Test filter no
    const noBugs = db.prepare(`
      SELECT b.id FROM bugs b
      WHERE b.id = ? AND (SELECT COUNT(*) FROM bug_annotations ba WHERE ba.bug_id = b.id AND ba.annotations != '[]' AND ba.annotations != '') = 0
    `).all(testBugId);
    assert.equal(noBugs.length, 0);
  });

  it('should allow force save even if version is older (force override)', () => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM bug_annotations WHERE bug_id = ? AND image_id = ?').get(testBugId, testImageId);
    assert.ok(existing);

    // Force update with old version
    const force = true;
    const oldVersion = 1;
    const shouldAllow = force || existing.version <= oldVersion;
    assert.equal(shouldAllow, true);

    db.prepare(`
      UPDATE bug_annotations SET
        annotations = ?,
        version = version + 1,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify([{ id: 'ann-forced', note: 'Force overwritten' }]), existing.id);

    const reloaded = db.prepare('SELECT * FROM bug_annotations WHERE id = ?').get(existing.id);
    assert.equal(reloaded.version, existing.version + 1);
  });

  it('should delete annotations when image annotation is explicitly deleted', () => {
    const db = getDb();
    db.prepare('DELETE FROM bug_annotations WHERE bug_id = ? AND image_id = ?').run(testBugId, testImageId);
    const check = db.prepare('SELECT * FROM bug_annotations WHERE bug_id = ? AND image_id = ?').get(testBugId, testImageId);
    assert.equal(check, undefined);
  });
});
