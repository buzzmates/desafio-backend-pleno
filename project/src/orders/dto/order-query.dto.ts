import { Type } from 'class-transformer';
import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class OrderQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
