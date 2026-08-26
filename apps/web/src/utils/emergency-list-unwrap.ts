export function asList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items as T[];
    if (Array.isArray(record.data)) return record.data as T[];
    if (record.data && typeof record.data === 'object') {
      const data = record.data as Record<string, unknown>;
      if (Array.isArray(data.items)) return data.items as T[];
      if (Array.isArray(data.data)) return data.data as T[];
    }
  }
  return [];
}
