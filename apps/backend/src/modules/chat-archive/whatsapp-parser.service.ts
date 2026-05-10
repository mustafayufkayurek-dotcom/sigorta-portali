import { Injectable } from '@nestjs/common';

export interface ParsedMessage {
  timestamp: string; // ISO string
  sender: string;
  message: string;
  mediaRef?: boolean;
}

@Injectable()
export class WhatsappParserService {
  /**
   * Patterns supported:
   *   30.04.2026 14:35 - Sender: Message
   *   [30.04.2026, 14:35:22] Sender: Message
   *   30/04/2026, 14:35 - Sender: Message
   */
  private readonly LINE_PATTERNS = [
    // [DD.MM.YYYY, HH:MM:SS] Sender: Message
    /^\[(\d{2}[./]\d{2}[./]\d{4}),\s*(\d{2}:\d{2}(?::\d{2})?)\]\s+(.+?):\s(.+)$/,
    // DD.MM.YYYY HH:MM - Sender: Message
    /^(\d{2}[./]\d{2}[./]\d{4})[, ]\s*(\d{2}:\d{2}(?::\d{2})?)\s*[-–]\s*(.+?):\s(.+)$/,
    // DD/MM/YYYY, HH:MM - Sender: Message
    /^(\d{2}\/\d{2}\/\d{4}),\s*(\d{2}:\d{2}(?::\d{2})?)\s*[-–]\s*(.+?):\s(.+)$/,
  ];

  private readonly MEDIA_PATTERNS = [
    '<medya dahil edilmedi>',
    '<media omitted>',
    'image omitted',
    'video omitted',
    'audio omitted',
    'sticker omitted',
    'document omitted',
    'gif omitted',
  ];

  parse(rawContent: string): ParsedMessage[] {
    const lines = rawContent.split(/\r?\n/);
    const messages: ParsedMessage[] = [];
    let currentMessage: ParsedMessage | null = null;

    for (const line of lines) {
      const parsed = this.tryParseLine(line);
      if (parsed) {
        if (currentMessage) {
          messages.push(currentMessage);
        }
        currentMessage = parsed;
      } else {
        // Continuation line — append to previous message
        if (currentMessage && line.trim()) {
          currentMessage.message += '\n' + line;
        }
      }
    }

    if (currentMessage) {
      messages.push(currentMessage);
    }

    return messages;
  }

  private tryParseLine(line: string): ParsedMessage | null {
    for (const pattern of this.LINE_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const [, datePart, timePart, sender, message] = match;
        const timestamp = this.parseTimestamp(datePart, timePart);
        if (!timestamp) continue;

        const isMedia = this.MEDIA_PATTERNS.some((p) =>
          message.toLowerCase().includes(p),
        );

        return {
          timestamp,
          sender: sender.trim(),
          message: message.trim(),
          ...(isMedia ? { mediaRef: true } : {}),
        };
      }
    }
    return null;
  }

  private parseTimestamp(datePart: string, timePart: string): string | null {
    try {
      // Normalize separators: both . and / are treated as DD/MM/YYYY
      const normalized = datePart.replace(/\./g, '/');
      const parts = normalized.split('/');
      if (parts.length !== 3) return null;

      const [day, month, year] = parts;
      const [hour, minute, second = '00'] = timePart.split(':');

      const d = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second),
      );

      if (isNaN(d.getTime())) return null;
      return d.toISOString();
    } catch {
      return null;
    }
  }
}
