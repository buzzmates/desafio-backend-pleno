import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class WebhookSignatureMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const signature = req.headers['x-webhook-signature'] as string;
    const webhookSecret = this.configService.get<string>('WEBHOOK_SECRET');

    if (!webhookSecret) {
      throw new ForbiddenException('Webhook secret not configured');
    }

    if (!signature) {
      throw new ForbiddenException('Missing webhook signature');
    }

    // Get raw body for signature verification
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      throw new ForbiddenException('Unable to verify request body');
    }

    // Verify HMAC-SHA256 signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const receivedSignature = signature.replace('sha256=', '');

    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(receivedSignature))) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    next();
  }
}
