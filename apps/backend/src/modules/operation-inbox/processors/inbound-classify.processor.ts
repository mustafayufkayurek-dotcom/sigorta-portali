import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CLASSIFY_JOB_MESSAGE,
  INBOUND_CLASSIFY_QUEUE,
} from '../operation-inbox.constants';
import {
  INBOUND_CLASSIFY_SYSTEM,
  buildInboundClassifyUserContent,
  parseInboundClassifyResponse,
} from '../prompts/inbound-classification.prompt';
import { OperationInboxService } from '../operation-inbox.service';
import { InboundRoutingService } from '../inbound-routing.service';

@Processor(INBOUND_CLASSIFY_QUEUE)
export class InboundClassifyProcessor {
  private readonly logger = new Logger(InboundClassifyProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly inboxService: OperationInboxService,
    private readonly routingService: InboundRoutingService,
  ) {}

  @Process(CLASSIFY_JOB_MESSAGE)
  async handleClassify(job: Job<{ messageId: string }>) {
    const { messageId } = job.data;
    const apiKey = this.config.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      this.logger.warn(`OPENAI_API_KEY eksik — sınıflandırma atlandı: ${messageId}`);
      return { skipped: true, reason: 'no_api_key' };
    }

    const message = await this.prisma.inboundMessage.findUnique({
      where: { id: messageId },
    });
    if (!message) {
      this.logger.warn(`Mesaj bulunamadı: ${messageId}`);
      return { skipped: true, reason: 'not_found' };
    }

    if (message.status === 'CLASSIFIED' || message.status === 'ACTIONED') {
      return { skipped: true, reason: 'already_done' };
    }

    await this.prisma.inboundMessage.update({
      where: { id: messageId },
      data: { status: 'CLASSIFYING', errorMsg: null },
    });

    try {
      const userContent = buildInboundClassifyUserContent(message);
      const result = await this.callOpenAI(apiKey, userContent);

      await this.prisma.inboundMessage.update({
        where: { id: messageId },
        data: {
          status: 'CLASSIFIED',
          classification: result.classification,
          confidence: result.confidence,
          aiSummary: result.summary,
          aiExtractedJson: result.extracted as Prisma.InputJsonValue,
          suggestedAction: result.suggestedAction,
          errorMsg: null,
        },
      });

      this.logger.log(
        `${messageId}: ${result.classification} (${Math.round(result.confidence * 100)}%)`,
      );

      await this.inboxService.attemptAutoLink(messageId, result.suggestedAction);

      await this.routingService.computeAndStoreRouting(messageId);

      return { ok: true, classification: result.classification };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message.slice(0, 500) : 'Sınıflandırma hatası';
      this.logger.error(`Sınıflandırma hatası: ${messageId}`, err);
      await this.prisma.inboundMessage.update({
        where: { id: messageId },
        data: { status: 'ERROR', errorMsg },
      });
      throw err;
    }
  }

  private async callOpenAI(apiKey: string, userContent: string) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey, timeout: 45_000 });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 500,
      temperature: 0,
      messages: [
        { role: 'system', content: INBOUND_CLASSIFY_SYSTEM },
        { role: 'user', content: userContent },
      ],
    });

    const content = response.choices?.[0]?.message?.content ?? '';
    return parseInboundClassifyResponse(content);
  }
}
