import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { isFieldStaff, deepMaskPhones } from '../helpers/field-staff.helper';

@Injectable()
export class PhoneMaskingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      map((response) => {
        if (!isFieldStaff(user?.roleCode)) return response;
        return deepMaskPhones(response) as typeof response;
      }),
    );
  }
}
