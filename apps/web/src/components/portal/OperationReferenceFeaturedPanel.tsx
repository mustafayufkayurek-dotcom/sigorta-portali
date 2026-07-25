'use client';

import { ChevronRight } from 'lucide-react';
import type { OperationReferenceRecord } from '@/data/operation-reference-operations';
import { REFERENCE_CATEGORY_META } from '@/components/portal/operation-reference.types';
import { resolveInstitutionDisplay } from '@/utils/operation-reference-utils';
import {
  Factory,
  Flame,
  Home,
  Landmark,
  Ship,
  Users,
} from 'lucide-react';
import type { ReferenceOperationCategory } from '@/components/portal/operation-reference.types';

function CategoryIcon({ category }: { category: ReferenceOperationCategory }) {
  const cls = 'h-3.5 w-3.5';
  const color = REFERENCE_CATEGORY_META[category].color;
  const style = { color };
  switch (category) {
    case 'residential':
      return <Home className={cls} style={style} aria-hidden="true" />;
    case 'industrial':
      return <Factory className={cls} style={style} aria-hidden="true" />;
    case 'public_critical':
      return <Landmark className={cls} style={style} aria-hidden="true" />;
    case 'maritime':
      return <Ship className={cls} style={style} aria-hidden="true" />;
    case 'disaster':
      return <Flame className={cls} style={style} aria-hidden="true" />;
    default:
      return <Users className={cls} style={style} aria-hidden="true" />;
  }
}

type OperationReferenceFeaturedPanelProps = {
  operations: OperationReferenceRecord[];
  canViewInstitution: boolean;
  onSelect: (id: string) => void;
};

export default function OperationReferenceFeaturedPanel({
  operations,
  canViewInstitution,
  onSelect,
}: OperationReferenceFeaturedPanelProps) {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Son Öne Çıkan Operasyonlar</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {operations.map((op) => {
            const displayName = resolveInstitutionDisplay(op, canViewInstitution);
            const location = op.district && op.district !== op.city ? `${op.city} / ${op.district}` : op.city;
            return (
              <button
                key={op.id}
                type="button"
                onClick={() => onSelect(op.id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
              >
                <div
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50"
                  style={{ color: REFERENCE_CATEGORY_META[op.category].color }}
                >
                  <CategoryIcon category={op.category} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{op.operationType}</p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                    <span>{location}</span>
                    <span>·</span>
                    <span>{op.dateLabel}</span>
                  </div>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <div className="border-t border-slate-100 px-4 py-2.5">
          <button
            type="button"
            onClick={() => operations[0] && onSelect(operations[0].id)}
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            Tüm Operasyonları Görüntüle →
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">
          Neden Operasyon Fotoğrafları Bulunmuyor?
        </h3>
        <ul className="mt-3 space-y-2.5">
          {PRIVACY_BULLETS.map((item) => (
            <li key={item.text} className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-600">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                <item.icon className="h-3 w-3" aria-hidden="true" />
              </span>
              {item.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const PRIVACY_BULLETS = [
  { icon: Landmark, text: 'KVKK ve yasal mevzuat gereklilikleri' },
  { icon: Factory, text: 'Sigorta şirketleri ile yapılan gizlilik sözleşmeleri (NDA)' },
  { icon: Home, text: 'Ticari sırların ve müşteri mahremiyetinin korunması' },
  { icon: Ship, text: 'Kamu kurumları bilgi güvenliği yükümlülükleri' },
  { icon: Users, text: 'Sigortalı ve üçüncü taraf haklarının korunması' },
];
