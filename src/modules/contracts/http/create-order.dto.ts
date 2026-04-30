import {
  IsArray,
  IsEmail,
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CustomerDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;
}

class OrderItemDto {
  @IsString()
  sku!: string;

  @IsInt()
  @Min(1)
  qty!: number;

  @IsNumber()
  @IsPositive()
  unit_price!: number;
}

export class CreateOrderWebhookDto {
  @IsString()
  order_id!: string;

  @ValidateNested()
  @Type(() => CustomerDto)
  customer!: CustomerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsString()
  currency!: string;

  @IsString()
  idempotency_key!: string;
}
