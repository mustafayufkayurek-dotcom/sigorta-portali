import { ClaimOperationCenterService } from './claim-operation-center.service';

describe('ClaimOperationCenterService', () => {
  const actor = { id: 'user-1', roleCode: 'operation' };

  function createService() {
    const appointmentUpdate = jest.fn().mockResolvedValue({
      id: 'appointment-1',
      scheduledAt: new Date('2026-07-20T09:00:00.000Z'),
      location: 'Yeni Adres',
      locationUrl: 'https://example.com/location',
      estimatedDurationMinutes: 90,
      notes: 'Yeni Not',
    });
    const prisma: any = {
      claimFile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'claim-1',
          fileNo: 'HD-2026-0042',
          insuredName: 'Ahmet Yılmaz',
          insuredPhone: '05320000000',
          customer: null,
          propertyAddress: null,
          claimSubject: null,
          assignedInspectorVendorId: null,
          assignedInspectorVendor: null,
          supplierAssignments: [],
        }),
      },
      appointment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'appointment-1',
          scheduledAt: new Date('2026-07-19T07:30:00.000Z'),
          location: 'Eski Adres',
          locationUrl: null,
          estimatedDurationMinutes: 60,
          notes: 'Eski Not',
        }),
      },
      fileActivityLog: {
        create: jest.fn().mockResolvedValue({ id: 'activity-1' }),
      },
      $transaction: jest.fn(async (callback: any) =>
        callback({ appointment: { update: appointmentUpdate } }),
      ),
    };
    const templates: any = {
      getByType: jest.fn(),
      interpolate: jest.fn(),
    };
    const claimEventEmail: any = { onManualDecision: jest.fn(), onInspectionPlanned: jest.fn() };
    const repairReports: any = {
      approveReport: jest.fn(),
      rejectReport: jest.fn(),
      reviseReport: jest.fn(),
    };
    return {
      service: new ClaimOperationCenterService(prisma, templates, claimEventEmail, repairReports),
      prisma,
      appointmentUpdate,
    };
  }

  it('ana randevuyu günceller ve eski/yeni değerleri geçmişe yazar', async () => {
    const { service, prisma, appointmentUpdate } = createService();

    await service.upsertMainAppointment(
      'claim-1',
      {
        scheduledAt: '2026-07-20T09:00:00.000Z',
        location: 'Yeni Adres',
        locationUrl: 'https://example.com/location',
        estimatedDurationMinutes: 90,
        notes: 'Yeni Not',
      },
      actor,
    );

    expect(appointmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'appointment-1' },
        data: expect.objectContaining({
          location: 'Yeni Adres',
          estimatedDurationMinutes: 90,
        }),
      }),
    );
    expect(prisma.fileActivityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'APPOINTMENT_UPDATED',
        metadata: expect.objectContaining({
          oldValue: expect.objectContaining({ location: 'Eski Adres' }),
          newValue: expect.objectContaining({ location: 'Yeni Adres' }),
        }),
      }),
    });
  });

  it('telefon aramasını kullanıcı ve sonuç bilgisiyle kaydeder', async () => {
    const { service, prisma } = createService();

    await service.recordContactEvent(
      'claim-1',
      {
        channel: 'phone',
        recipientType: 'insured',
        phone: '05320000000',
        status: 'called',
        result: 'Arama Gerçekleştirildi',
      },
      actor,
    );

    expect(prisma.fileActivityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'user-1',
        action: 'PHONE_CALL_RECORDED',
        description: expect.stringContaining('05320000000'),
        metadata: expect.objectContaining({
          status: 'called',
          result: 'Arama Gerçekleştirildi',
          phone: '05320000000',
        }),
      }),
    });
  });

  it('dijital onayı NOTE_ADDED + metadata.kind ile kalıcı kaydeder', async () => {
    const { service, prisma } = createService();

    await service.recordDigitalApproval(
      'claim-1',
      {
        formType: 'Mutabakat',
        status: 'approved',
        insuredName: 'Pelin İki',
        link: 'https://onay.meridyen.local/15598774220001',
      },
      actor,
    );

    expect(prisma.fileActivityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'NOTE_ADDED',
        description: 'Dijital onay tamamlandı (Mutabakat).',
        metadata: expect.objectContaining({
          kind: 'digital_approval',
          status: 'approved',
          formType: 'Mutabakat',
          insuredName: 'Pelin İki',
        }),
      }),
    });
  });

  it('dijital onayda form türü boşsa hata verir', async () => {
    const { service } = createService();
    await expect(
      service.recordDigitalApproval('claim-1', { formType: '  ', status: 'sent' }, actor),
    ).rejects.toThrow(/Form türü zorunludur/);
  });
});
