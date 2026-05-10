import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { isFieldStaff } from '@/common/helpers/field-staff.helper';

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

function stripCostFields(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(stripCostFields);
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      if (CLAIM_FILE_COST_FIELDS.includes(key)) {
        continue; // gizle
      }
      // Onarım kalemleri (repairItems / items) için birim fiyat ve toplam maskeleme
      if (key === 'repairItems' || key === 'items') {
        result[key] = (Array.isArray(obj[key]) ? obj[key] : []).map(
          (item: any) => {
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
  return obj;
}

@Injectable()
export class CostMaskingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      map((response) => {
        if (!user || !isFieldStaff(user?.roleCode)) {
          return response;
        }
        // Sadece data alanını filtrele; meta ve success'e dokunma
        if (response && typeof response === 'object' && 'data' in response) {
          return { ...response, data: stripCostFields(response.data) };
        }
        return stripCostFields(response);
      }),
    );
  }
}
