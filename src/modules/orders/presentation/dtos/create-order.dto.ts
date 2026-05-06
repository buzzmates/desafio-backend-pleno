import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CustomerDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}

class OrderItemDto {
  @IsString()
  @IsNotEmpty()
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
  @IsNotEmpty()
  order_id!: string;

  @ValidateNested()
  @Type(() => CustomerDto)
  customer!: CustomerDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsString()
  @IsNotEmpty()
  idempotency_key!: string;
}
