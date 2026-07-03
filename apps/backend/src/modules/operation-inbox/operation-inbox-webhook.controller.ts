import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { GraphSubscriptionService } from './graph/graph-subscription.service';

@Controller('operation-inbox/webhooks')
export class OperationInboxWebhookController {
  constructor(private readonly graphSubscriptions: GraphSubscriptionService) {}

  /**
   * Microsoft Graph validation handshake + change notifications.
   * validationToken query param → düz metin olarak geri döndürülür.
   */
  @Public()
  @Get('graph')
  @HttpCode(200)
  validateGraphWebhookGet(
    @Query('validationToken') validationToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (validationToken) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return validationToken;
    }
    return { ok: true };
  }

  @Public()
  @Post('graph')
  @HttpCode(202)
  async handleGraphWebhook(
    @Query('validationToken') validationToken: string | undefined,
    @Body() body: { value?: unknown[] },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (validationToken) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.status(200);
      return validationToken;
    }

    await this.graphSubscriptions.handleNotification(
      body as { value?: Array<{ subscriptionId?: string; clientState?: string; resource?: string }> },
    );
    return { ok: true };
  }
}
