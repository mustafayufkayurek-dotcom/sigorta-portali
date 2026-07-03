import {
  extractInsuranceLeadingNumber,
  extractRcsClaimNo,
  extractSubjectHints,
  stripReplyPrefixes,
} from './inbound-subject-parser';

describe('inbound-subject-parser', () => {
  describe('stripReplyPrefixes', () => {
    it('strips Ynt: prefix', () => {
      expect(stripReplyPrefixes('Ynt: 446922469/BELGIN KIZILIRMAK/RCS-20261795219/KONUT CAM')).toBe(
        '446922469/BELGIN KIZILIRMAK/RCS-20261795219/KONUT CAM',
      );
    });

    it('strips nested Re: and Fwd: prefixes', () => {
      expect(stripReplyPrefixes('Re: Fwd: Hasar dosyası')).toBe('Hasar dosyası');
    });
  });

  describe('extractRcsClaimNo', () => {
    it('extracts digits from RCS pattern', () => {
      expect(extractRcsClaimNo('446922469/BELGIN/RCS-20261795219/KONUT CAM')).toBe('20261795219');
    });

    it('returns undefined when no RCS token', () => {
      expect(extractRcsClaimNo('Genel bilgilendirme')).toBeUndefined();
    });
  });

  describe('extractInsuranceLeadingNumber', () => {
    it('extracts leading 9-digit claim number', () => {
      expect(extractInsuranceLeadingNumber('446922469/BELGIN KIZILIRMAK')).toEqual({
        claimNo: '446922469',
        policyNo: '446922469',
      });
    });

    it('extracts from first slash segment', () => {
      expect(extractInsuranceLeadingNumber('Ynt: 1234567890/AD SOYAD')).toEqual({
        claimNo: '1234567890',
        policyNo: '1234567890',
      });
    });
  });

  describe('extractSubjectHints', () => {
    it('parses full insurance reply subject', () => {
      const hints = extractSubjectHints(
        'Ynt: 446922469/BELGIN KIZILIRMAK/RCS-20261795219/KONUT CAM',
      );
      expect(hints.isReply).toBe(true);
      expect(hints.claimNo).toBe('20261795219');
    });

    it('marks non-reply subjects', () => {
      const hints = extractSubjectHints('446922469/Yeni ihbar');
      expect(hints.isReply).toBe(false);
      expect(hints.claimNo).toBe('446922469');
    });
  });
});
