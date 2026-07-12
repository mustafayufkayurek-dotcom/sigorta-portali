import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { isFieldStaff } from '@/common/helpers/field-staff.helper';
import { applyFinancialVisibility } from '@/common/helpers/financial-visibility.helper';

/** Maliyet alanları - FIELD_STAFF kullanıcılarından gizlenir */
const CLAIM_FILE_COST_FIELDS = [
  'initialReserveAmount',
  'estimatedCostAmount',
  'approvedBudgetAmount',
  'actualCostAmount',
  'invoicedAmount',
  'collectedAmount',
  'profitMargin',
  'totalCost',
  'price',
  'priceAmount',
];

/** Onarım kalemi maliyet alanları - miktar ve açıklama görünür kalır */
const REPAIR_ITEM_COST_FIELDS = [
  'unitPrice',
  'totalAmount',
  'laborCost',
  'materialCost',
];

function isPlainObject(obj: unknown): obj is Record<string, any> {
  if (obj === null || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return false;
  if (obj instanceof Date) return false;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(obj)) return false;
  const proto = Object.getPrototypeOf(obj);
  return proto === Object.prototype || proto === null;
}

function stripCostFields(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(stripCostFields);
  }
  if (!isPlainObject(obj)) {
    return obj;
  }
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (CLAIM_FILE_COST_FIELDS.includes(key)) {
      continue; // gizle
    }
    // Onarım kalemleri (repairItems / items) için birim fiyat ve toplam maskeleme
    if (key === 'repairItems' || key === 'items') {
      result[key] = (Array.isArray(obj[key]) ? obj[key] : []).map(
        (item: any) => {
          if (!isPlainObject(item)) return item;
          const cleaned: Record<string, any> = {};
          for (const k of Object.keys(item)) {
            if (!REPAIR_ITEM_COST_FIELDS.includes(k)) {
              cleaned[k] = item[k];
            }
          }
          return cleaned;
        },
      );
    } else {
      result[key] = stripCostFields(obj[key]);
    }
  }
  return result;
}

@Injectable()
export class CostMaskingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      map((response) => {
        if (!user) return response;

        let payload = response;
        if (payload && typeof payload === 'object' && 'data' in payload) {
          let data = payload.data;
          if (isFieldStaff(user?.roleCode)) {
            data = stripCostFields(data);
          }
          data = applyFinancialVisibility(data, user);
          return { ...payload, data };
        }

        if (isFieldStaff(user?.roleCode)) {
          payload = stripCostFields(payload);
        }
        return applyFinancialVisibility(payload, user);
      }),
    );
  }
}
