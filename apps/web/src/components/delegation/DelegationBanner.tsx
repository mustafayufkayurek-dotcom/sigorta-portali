'use client';

export type DelegationBannerData = {
  actingUser: { id: string; firstName: string; lastName: string };
  principalUser: { id: string; firstName: string; lastName: string } | null;
  grantType?: 'person_delegation' | 'function_delegation';
  reason: string | null;
  validUntil: string | null;
};

function formatUserName(user?: { firstName?: string; lastName?: string } | null) {
  if (!user) return '—';
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || '—';
}

function formatValidUntil(validUntil: string | null) {
  if (!validUntil) return 'Süresiz';
  return new Date(validUntil).toLocaleDateString('tr-TR');
}

export function DelegationBanner({ delegation }: { delegation: DelegationBannerData }) {
  const isFunction = delegation.grantType === 'function_delegation' || !delegation.principalUser;
  const principalName = formatUserName(delegation.principalUser);
  const actorName = formatUserName(delegation.actingUser);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
      <p className="text-xs font-semibold text-amber-800">
        {isFunction ? 'Vekaleten İşlem' : 'Vekalet İle Görüntüleniyor'}
      </p>
      <p className="mt-1">
        {isFunction
          ? `Acil Yardım dosya sorumlusu vekaleti ile işlem yapıyorsunuz. Kayıtta işlem yapan: ${actorName}.`
          : (
            <>
              Bu dosyayı <span className="font-medium">{principalName}</span> adına görüntülüyorsunuz.
            </>
          )}
      </p>
      {delegation.reason && (
        <p className="mt-1 text-xs text-amber-800">
          Gerekçe: <span className="font-medium">{delegation.reason}</span>
        </p>
      )}
      <p className="mt-1 text-xs text-amber-700">
        Geçerlilik: {formatValidUntil(delegation.validUntil)}
      </p>
    </div>
  );
}
