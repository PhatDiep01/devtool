import { ApiModelField } from '@/types';

/**
 * Infer schema structure from a sample JSON string or object
 */
export function inferSchemaFromJson(jsonInput: string | object): ApiModelField[] {
  let parsed: any;
  if (typeof jsonInput === 'string') {
    try {
      parsed = JSON.parse(jsonInput);
    } catch {
      return [];
    }
  } else {
    parsed = jsonInput;
  }

  if (Array.isArray(parsed)) {
    if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
      return inferSchemaFromJson(parsed[0]);
    }
    return [];
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return [];
  }

  const fields: ApiModelField[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    const field: ApiModelField = {
      name: key,
      type: detectType(value),
      required: true,
      example: value !== null && typeof value !== 'object' ? value : undefined,
      description: ''
    };

    if (value !== null && typeof value === 'object') {
      if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
          field.type = 'array';
          field.children = inferSchemaFromJson(value[0]);
        } else {
          field.type = 'array';
        }
      } else {
        field.type = 'object';
        field.children = inferSchemaFromJson(value);
      }
    }

    fields.push(field);
  }

  return fields;
}

function detectType(value: any): string {
  if (value === null) return 'string';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') {
    // Check if ISO date
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return 'string (datetime)';
    }
    // Check UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return 'string (uuid)';
    }
    return 'string';
  }
  return 'string';
}

/**
 * Validates and formats a JSON string. Returns formatted JSON or null if invalid.
 */
export function formatJsonSafe(str: string): { isValid: boolean; formatted: string; error?: string } {
  if (!str || !str.trim()) {
    return { isValid: true, formatted: '' };
  }
  try {
    const obj = JSON.parse(str);
    return { isValid: true, formatted: JSON.stringify(obj, null, 2) };
  } catch (err: any) {
    return { isValid: false, formatted: str, error: err.message };
  }
}
