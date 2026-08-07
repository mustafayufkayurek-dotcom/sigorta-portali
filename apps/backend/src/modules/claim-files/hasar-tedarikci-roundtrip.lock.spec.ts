/**
 * Backend kaynak kilidi — liste select / operation-center note / assignSupplier update.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname);

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('hasar-tedarikci-roundtrip LOCK (backend)', () => {
  it('findAll select assignedSupplier + supplierAssignments içerir', () => {
    const src = read('claim-files.service.ts');
    const marker = 'Liste «Tedarikçi» sütunu';
    expect(src).toContain(marker);
    const idx = src.indexOf(marker);
    const window = src.slice(Math.max(0, idx - 400), idx + 800);
    expect(window).toContain('assignedSupplier:');
    expect(window).toContain('supplierAssignments:');
  });

  it('operation-center assignedSuppliers note döner', () => {
    const src = read('claim-operation-center.service.ts');
    expect(src).toMatch(/note:\s*link\.note/);
  });

  it('assignSupplier mevcut atamada note günceller', () => {
    const src = read('claim-files.service.ts');
    const fn = src.slice(src.indexOf('async assignSupplier'), src.indexOf('async assignSupplier') + 3500);
    expect(fn).toContain('updateMany');
    expect(fn).toContain('supplierNotes');
    expect(fn).toContain('toUpdateNotes');
  });
});
