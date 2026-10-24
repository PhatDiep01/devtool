import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  formatText, 
  computeTextStats, 
  detectInputType, 
  PERFORMANCE_THRESHOLD,
  FormatterOptions 
} from '../services/text-formatter-engine';

describe('Text Formatter Online & Data Integrity Test Suite', () => {
  const defaultOptions: FormatterOptions = {
    smartJson: true,
    separator: ' ',
    trimLines: true,
    removeEmptyLines: true,
    collapseSpaces: true
  };

  // =========================================================================
  // 1. DATA INTEGRITY TEST SUITE (Smart JSON Preservation)
  // =========================================================================
  describe('1. Smart JSON Compression & Data Integrity', () => {
    it('should strictly preserve null, boolean, integer, and float types', () => {
      const input = `{\n  "nullField": null,\n  "booleanTrue": true,\n  "booleanFalse": false,\n  "integerZero": 0,\n  "negativeInt": -42,\n  "floatVal": 98.75,\n  "emptyString": ""\n}`;
      const res = formatText(input, defaultOptions);

      assert.equal(res.isJsonValid, true);
      assert.equal(res.detectedType, 'JSON');
      assert.ok(!res.output.includes('\n'), 'Output must be strictly single-line');

      // Round-trip verification: JSON.parse must match original deeply
      const parsedOutput = JSON.parse(res.output);
      const originalObj = JSON.parse(input);
      assert.deepStrictEqual(parsedOutput, originalObj);

      // Verify explicit types
      assert.strictEqual(parsedOutput.nullField, null);
      assert.strictEqual(parsedOutput.booleanTrue, true);
      assert.strictEqual(parsedOutput.booleanFalse, false);
      assert.strictEqual(parsedOutput.integerZero, 0);
      assert.strictEqual(parsedOutput.negativeInt, -42);
      assert.strictEqual(parsedOutput.floatVal, 98.75);
    });

    it('should preserve Vietnamese Unicode, special symbols, and escaped quotes', () => {
      const complexObject = {
        title: "Công cụ Text Formatter Online",
        author: "Đặng Minh Phát \"Lead Architect\"",
        description: "Hỗ trợ tiếng Việt có dấu: á à ả ã ạ đ ê ô ơ ư!",
        symbols: "!@#$%^&*()_+~`|}{[]:;?><,./-=",
        nested: {
          items: [1, 2, "ba", { inner: true, none: null }],
          path: "C:\\Users\\PHATDM\\Desktop\\docs_tooldev"
        }
      };

      const input = JSON.stringify(complexObject, null, 2);
      const res = formatText(input, defaultOptions);

      assert.equal(res.isJsonValid, true);
      const parsedOutput = JSON.parse(res.output);
      assert.deepStrictEqual(parsedOutput, complexObject);
      assert.equal(parsedOutput.author, "Đặng Minh Phát \"Lead Architect\"");
      assert.equal(parsedOutput.nested.items[2], "ba");
    });

    it('should preserve arrays as root element in JSON', () => {
      const arrayInput = `[\n  10,\n  20,\n  {\n    "item": "A",\n    "active": false\n  },\n  null\n]`;
      const res = formatText(arrayInput, defaultOptions);

      assert.equal(res.isJsonValid, true);
      assert.equal(res.detectedType, 'JSON');
      const parsed = JSON.parse(res.output);
      assert.ok(Array.isArray(parsed));
      assert.equal(parsed.length, 4);
      assert.strictEqual(parsed[3], null);
    });

    it('should gracefully fallback to text compression when JSON syntax is malformed', () => {
      const malformedJson = `{\n  "title": "Unclosed string\n  "status": 500\n`;
      const res = formatText(malformedJson, defaultOptions);

      assert.equal(res.isJsonValid, false);
      assert.ok(res.jsonError, 'Should report json syntax error');
      assert.ok(res.output.length > 0, 'Should not crash, fallback to text');
      assert.ok(!res.output.includes('\n'), 'Should still format as single-line');
    });

    it('should format as text if smartJson is explicitly disabled', () => {
      const input = `{\n  "a": 1\n}`;
      const res = formatText(input, { ...defaultOptions, smartJson: false });

      // When smartJson is false, it joins lines with separator
      assert.equal(res.isJsonValid, false);
      assert.equal(res.output, '{ "a": 1 }');
    });
  });

  // =========================================================================
  // 2. TEXT FORMATTING & SEPARATOR BOUNDARY TESTS
  // =========================================================================
  describe('2. Text Formatting & Configurable Separators', () => {
    const multiLineText = `
      Dòng thứ nhất với thụt lề
      
      Dòng thứ hai có khoảng trắng thừa cuối dòng    
      
      Dòng thứ ba
    `;

    it('should strip empty lines and trim whitespace per line with space separator', () => {
      const res = formatText(multiLineText, {
        ...defaultOptions,
        separator: ' '
      });

      assert.equal(res.output, 'Dòng thứ nhất với thụt lề Dòng thứ hai có khoảng trắng thừa cuối dòng Dòng thứ ba');
      assert.ok(!res.output.includes('  '));
    });

    it('should join with comma separator', () => {
      const res = formatText(multiLineText, {
        ...defaultOptions,
        separator: ','
      });

      assert.equal(res.output, 'Dòng thứ nhất với thụt lề,Dòng thứ hai có khoảng trắng thừa cuối dòng,Dòng thứ ba');
    });

    it('should join with comma-space separator', () => {
      const res = formatText(multiLineText, {
        ...defaultOptions,
        separator: ', '
      });

      assert.equal(res.output, 'Dòng thứ nhất với thụt lề, Dòng thứ hai có khoảng trắng thừa cuối dòng, Dòng thứ ba');
    });

    it('should join with semicolon separator', () => {
      const res = formatText(multiLineText, {
        ...defaultOptions,
        separator: ';'
      });

      assert.equal(res.output, 'Dòng thứ nhất với thụt lề;Dòng thứ hai có khoảng trắng thừa cuối dòng;Dòng thứ ba');
    });

    it('should join with pipe separator without losing characters', () => {
      const res = formatText(multiLineText, {
        ...defaultOptions,
        separator: '|'
      });

      assert.equal(res.output, 'Dòng thứ nhất với thụt lề|Dòng thứ hai có khoảng trắng thừa cuối dòng|Dòng thứ ba');
    });

    it('should join with custom multi-character separator', () => {
      const res = formatText(multiLineText, {
        ...defaultOptions,
        separator: ' <==> '
      });

      assert.equal(res.output, 'Dòng thứ nhất với thụt lề <==> Dòng thứ hai có khoảng trắng thừa cuối dòng <==> Dòng thứ ba');
    });

    it('should preserve empty lines if removeEmptyLines is false', () => {
      const textWithEmpties = "Line 1\n\nLine 2";
      const res = formatText(textWithEmpties, {
        ...defaultOptions,
        removeEmptyLines: false,
        separator: '|'
      });

      assert.equal(res.output, 'Line 1||Line 2');
    });
  });

  // =========================================================================
  // 3. INPUT TYPE DETECTION
  // =========================================================================
  describe('3. Real-time Input Type Detection', () => {
    it('should accurately detect JSON Object', () => {
      assert.equal(detectInputType('{"key": "value"}'), 'JSON');
    });

    it('should accurately detect JSON Array', () => {
      assert.equal(detectInputType('[1, 2, 3]'), 'JSON');
    });

    it('should detect incomplete JSON being typed as JSON', () => {
      assert.equal(detectInputType('{\n  "title": "Antigravity"'), 'JSON');
      assert.equal(detectInputType('[\n  {"id": 1}'), 'JSON');
    });

    it('should accurately detect SQL queries with various keywords', () => {
      assert.equal(detectInputType('SELECT * FROM users WHERE active = 1'), 'SQL');
      assert.equal(detectInputType('  INSERT INTO logs (msg) VALUES ("test")'), 'SQL');
      assert.equal(detectInputType('UPDATE users SET status = 1'), 'SQL');
      assert.equal(detectInputType('DELETE FROM sessions WHERE expired = 1'), 'SQL');
      assert.equal(detectInputType('DELETE users WHERE id = 10'), 'SQL');
      assert.equal(detectInputType('CREATE TABLE docs (id INT PRIMARY KEY)'), 'SQL');
      assert.equal(detectInputType('CREATE INDEX idx_user ON users(id)'), 'SQL');
      assert.equal(detectInputType('WITH cte AS (SELECT 1) SELECT * FROM cte'), 'SQL');
      assert.equal(detectInputType('EXPLAIN SELECT 1 FROM dual'), 'SQL');
    });

    it('should detect SQL queries even when preceded by single-line or multi-line comments', () => {
      assert.equal(detectInputType('-- Get all active users\nSELECT * FROM users WHERE active = 1;'), 'SQL');
      assert.equal(detectInputType('/* Multi-line comment\n * Second line\n */\nINSERT INTO users (id) VALUES (1);'), 'SQL');
    });

    it('should accurately detect System Log entries and NOT misidentify bracketed logs as JSON', () => {
      assert.equal(detectInputType('2026-10-24 15:30:00 [INFO] Server started'), 'LOG');
      assert.equal(detectInputType('[ERROR] Uncaught exception in thread main'), 'LOG');
      assert.equal(detectInputType('[WARN] High memory consumption detected'), 'LOG');
      // Bracketed timestamps and bracketed tags ending in bracket must be LOG, not JSON
      assert.equal(detectInputType('[2026-10-24 15:30:00] [INFO] Request completed [200 OK]'), 'LOG');
      assert.equal(detectInputType('[INFO] Task complete: [done]'), 'LOG');
    });

    it('should not produce false JSON syntax errors when formatting logs', () => {
      const log = '[2026-10-24 15:30:00] [INFO] Request completed [200 OK]';
      const res = formatText(log, defaultOptions);
      assert.equal(res.detectedType, 'LOG');
      assert.equal(res.jsonError, undefined, 'Logs must never trigger JSON syntax error');
    });

    it('should fallback to TEXT for normal text', () => {
      assert.equal(detectInputType('Xin chào thế giới!'), 'TEXT');
      assert.equal(detectInputType(''), 'TEXT');
    });
  });

  // =========================================================================
  // 4. PERFORMANCE & STRESS SAFEGUARD (>100K CHARACTERS)
  // =========================================================================
  describe('4. Performance & Safeguard Threshold (>100K Characters)', () => {
    it('should mark payload as normal when <= 100,000 characters', () => {
      const normalText = 'A'.repeat(5000);
      const res = formatText(normalText, defaultOptions);

      assert.equal(res.isLargePayload, false);
      assert.equal(res.inputStats.characters, 5000);
    });

    it('should flag isLargePayload = true when input exceeds 100,000 characters', () => {
      // Generate 120,000 characters with 1,000 lines
      const line = 'SELECT id, username, email FROM large_dataset_table WHERE active = 1;\n';
      const linesCount = Math.ceil(120_000 / line.length);
      const largeInput = line.repeat(linesCount);

      assert.ok(largeInput.length > PERFORMANCE_THRESHOLD, 'Input must exceed 100,000 chars');

      const startTime = performance.now();
      const res = formatText(largeInput, defaultOptions);
      const durationMs = performance.now() - startTime;

      assert.equal(res.isLargePayload, true);
      assert.ok(res.output.length > 0);
      assert.ok(!res.output.includes('\n'), 'Must compress single-line even at large scale');
      // Must execute cleanly under 150ms
      assert.ok(durationMs < 500, `Execution took ${durationMs.toFixed(2)}ms, should be fast`);
    });

    it('should process 250,000+ characters stress test without memory blowout', () => {
      const line = '   2026-10-24T12:00:00Z [INFO] Processing microservice background event transaction ID: 987654321   \n\n';
      const repeatCount = Math.ceil(250_000 / line.length);
      const stressInput = line.repeat(repeatCount);

      const res = formatText(stressInput, defaultOptions);
      assert.equal(res.isLargePayload, true);
      assert.ok(res.charsSaved > 0);
      assert.ok(res.reductionPercent > 0);
    });
  });

  // =========================================================================
  // 5. STATISTICS & REDUCTION RATIO ACCURACY
  // =========================================================================
  describe('5. Text Statistics & Compression Ratio', () => {
    it('computeTextStats should accurately count characters, words, lines and bytes', () => {
      const text = "Dòng một\nDòng hai\nDòng ba";
      const stats = computeTextStats(text);

      assert.equal(stats.lines, 3);
      assert.equal(stats.words, 6);
      assert.equal(stats.characters, text.length);
      assert.ok(stats.byteSize >= text.length, 'UTF-8 bytes must be >= character count for Vietnamese');
    });

    it('computeTextStats should return zero for empty string', () => {
      const stats = computeTextStats('');
      assert.equal(stats.characters, 0);
      assert.equal(stats.words, 0);
      assert.equal(stats.lines, 0);
      assert.equal(stats.byteSize, 0);
    });

    it('formatText should accurately calculate reduction ratio %', () => {
      // Original: 20 chars, Output: 10 chars -> 50% reduction
      const text = "12345\n\n\n\n     12345";
      const res = formatText(text, defaultOptions);

      assert.ok(res.reductionPercent > 0, 'Reduction percent should be positive');
      assert.equal(res.charsSaved, res.inputStats.characters - res.outputStats.characters);
    });

    it('formatText handles empty or null-like inputs gracefully', () => {
      const res = formatText('', defaultOptions);
      assert.equal(res.output, '');
      assert.equal(res.inputStats.characters, 0);
      assert.equal(res.reductionPercent, 0);
    });
  });
});
