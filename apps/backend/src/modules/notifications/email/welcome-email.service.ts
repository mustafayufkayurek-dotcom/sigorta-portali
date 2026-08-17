import { Injectable } from '@nestjs/common';
import {
  generateWelcomeEmail,
  WelcomeEmailData,
  WelcomeEmailRenderResult,
  WelcomeEmailRole,
} from './welcome-email.template';

@Injectable()
export class WelcomeEmailService {
  generateWelcomeEmail(
    role: WelcomeEmailRole,
    data: WelcomeEmailData = {},
  ): WelcomeEmailRenderResult {
    return generateWelcomeEmail(role, data);
  }
}
