import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    let rawData = '';

    req.on('data', (chunk) => {
      rawData += chunk;
    });

    req.on('end', () => {
      (req as any).rawBody = rawData;
      next();
    });
  }
}
