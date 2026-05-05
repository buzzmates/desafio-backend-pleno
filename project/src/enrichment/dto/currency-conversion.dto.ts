import { IsNumber, IsString, IsNotEmpty, Length, Min } from 'class-validator';

export class CurrencyConversionRequest {
  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  from: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  to: string;
}

export class CurrencyConversionResult {
  originalAmount: number;
  originalCurrency: string;
  targetCurrency: string;
  conversionRate: number;
  convertedAmount: number;
  timestamp: string;
}

export interface CurrencyApiResponse {
  rates: Record<string, number>;
  base: string;
  date: string;
}
