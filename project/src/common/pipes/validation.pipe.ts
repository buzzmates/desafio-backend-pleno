import { ValidationPipe as NestValidationPipe } from '@nestjs/common';

export const validationPipe = new NestValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
});
