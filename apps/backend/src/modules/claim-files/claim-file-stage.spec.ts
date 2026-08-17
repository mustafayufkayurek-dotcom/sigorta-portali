import {
  CLAIM_FILE_STAGE_SLOTS,
  claimFileStageTone,
  deriveClaimFileStageIndex,
  hasClaimFileSuppliersAssigned,
} from '@sigorta/shared';

describe('claim-file-stage', () => {
  it('5 aşama Title Case etiketleriyle tanımlıdır', () => {
    expect(CLAIM_FILE_STAGE_SLOTS.map((s) => s.label)).toEqual([
      'Onay Bekliyor',
      'Onaylandı',
      'Tedarikçiler Görevlendirildi',
      'Onarım Aşamasında',
      'Onarım Tamamlandı',
    ]);
  });

  it('onaya gönderilmeden null döner (tüm adımlar future)', () => {
    expect(deriveClaimFileStageIndex({ reportStatus: 'draft' })).toBeNull();
    expect(deriveClaimFileStageIndex({ reportStatus: 'rejected' })).toBeNull();
    expect(deriveClaimFileStageIndex({})).toBeNull();
  });

  it('pending_approval → Onay Bekliyor (0)', () => {
    expect(deriveClaimFileStageIndex({ reportStatus: 'pending_approval' })).toBe(0);
    expect(deriveClaimFileStageIndex({ reportStatus: 'submitted' })).toBe(0);
  });

  it('approved / dış onay akışı → Onaylandı (1)', () => {
    expect(deriveClaimFileStageIndex({ reportStatus: 'approved' })).toBe(1);
    expect(deriveClaimFileStageIndex({ reportStatus: 'sent_for_external_approval' })).toBe(1);
    expect(deriveClaimFileStageIndex({ reportStatus: 'externally_approved' })).toBe(1);
  });

  it('tedarikçi ataması → Tedarikçiler Görevlendirildi (2)', () => {
    expect(
      deriveClaimFileStageIndex({
        reportStatus: 'approved',
        hasSuppliersAssigned: true,
      }),
    ).toBe(2);
  });

  it('repair_in_progress / repair_planning → Onarım Aşamasında (3)', () => {
    expect(
      deriveClaimFileStageIndex({
        reportStatus: 'approved',
        hasSuppliersAssigned: true,
        claimStatusCode: 'repair_in_progress',
      }),
    ).toBe(3);
    expect(deriveClaimFileStageIndex({ claimStatusCode: 'repair_planning' })).toBe(3);
  });

  it('repair_completed ve sonrası → Onarım Tamamlandı (4)', () => {
    expect(deriveClaimFileStageIndex({ claimStatusCode: 'repair_completed' })).toBe(4);
    expect(deriveClaimFileStageIndex({ claimStatusCode: 'invoice_pending' })).toBe(4);
    expect(deriveClaimFileStageIndex({ claimStatusCode: 'closed' })).toBe(4);
  });

  it('tone: tamamlanan pasif, aktif belirgin, gelecek soluk', () => {
    expect(claimFileStageTone(0, 2)).toBe('completed');
    expect(claimFileStageTone(2, 2)).toBe('active');
    expect(claimFileStageTone(3, 2)).toBe('future');
    expect(claimFileStageTone(0, null)).toBe('future');
  });

  it('hasClaimFileSuppliersAssigned çeşitli kaynakları tanır', () => {
    expect(hasClaimFileSuppliersAssigned({ assignedSupplierId: 'v1' })).toBe(true);
    expect(hasClaimFileSuppliersAssigned({ assignedSuppliers: [{ id: 'v1' }] })).toBe(true);
    expect(
      hasClaimFileSuppliersAssigned({
        supplierAssignments: [{ vendorId: 'v1' }],
      }),
    ).toBe(true);
    expect(hasClaimFileSuppliersAssigned({ assignedSuppliers: [] })).toBe(false);
  });
});
