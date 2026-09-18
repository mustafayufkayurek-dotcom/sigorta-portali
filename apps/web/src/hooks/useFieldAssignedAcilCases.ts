'use client';

import { useQuery } from '@tanstack/react-query';
import { getCases } from '@/utils/emergencyApi';
import { fieldStaffAcilIsOpen } from '@/utils/field-staff-claim-view';

export function useFieldAssignedAcilCases(enabled: boolean) {
  return useQuery({
    queryKey: ['field-assigned-acil'],
    enabled,
    retry: 1,
    throwOnError: false,
    queryFn: async () => {
      const res = await getCases();
      return (res.data ?? []).filter((row) => fieldStaffAcilIsOpen(row.status));
    },
  });
}
