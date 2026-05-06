import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { BaseExternalService } from '../base-external.service';
import {
  CurrencyConversionRequest,
  CurrencyConversionResult,
  CurrencyApiResponse,
} from '../dto/currency-conversion.dto';

@Injectable()
export class CurrencyConversionService extends BaseExternalService {
  constructor(httpService: HttpService) {
    super('CurrencyConversionService', httpService);
  }

  protected getApiKey(): string {
    return process.env.CURRENCY_API_KEY || '';
  }

  protected getBaseUrl(): string {
    return process.env.CURRENCY_API_URL || 'https://api.exchangerate.host/v1/';
  }

  protected getServiceName(): string {
    return 'CurrencyConversion';
  }

  async convertCurrency(
    request: CurrencyConversionRequest,
  ): Promise<CurrencyConversionResult> {
    this.logger.log(
      `Converting ${request.amount} ${request.from} to ${request.to}`,
    );

    const result = await this.retryWithBackoff(async () => {
      const response = await this.makeRequest<CurrencyApiResponse>({
        method: 'GET',
        url: `latest?base=${request.from}&symbols=${request.to}`,
      });

      return this.validateResponse(response, this.isCurrencyApiResponse);
    });

    const conversionRate = result.rates[request.to];
    if (!conversionRate) {
      throw new Error(`Conversion rate for ${request.to} not available`);
    }

    const convertedAmount = request.amount * conversionRate;

    const conversionResult: CurrencyConversionResult = {
      originalAmount: request.amount,
      originalCurrency: request.from,
      targetCurrency: request.to,
      conversionRate,
      convertedAmount,
      timestamp: new Date().toISOString(),
    };

    this.logger.log(
      `Conversion successful: ${request.amount} ${request.from} = ${convertedAmount} ${request.to}`,
    );

    return conversionResult;
  }

  /**
   * Validator for currency API response
   */
  private isCurrencyApiResponse(data: unknown): data is CurrencyApiResponse {
    const maybeData = data as any;
    return (
      typeof maybeData === 'object' &&
      maybeData !== null &&
      typeof maybeData.rates === 'object' &&
      typeof maybeData.base === 'string' &&
      typeof maybeData.date === 'string'
    );
  }

  /**
   * Get supported currencies
   */
  async getSupportedCurrencies(): Promise<string[]> {
    const response = await this.makeRequest<{
      symbols: Record<string, string>;
    }>({
      method: 'GET',
      url: 'symbols',
    });

    return Object.keys(response.symbols);
  }

  /**
   * Get historical rates for a date
   */
  async getHistoricalRates(
    date: string,
    base: string,
  ): Promise<CurrencyApiResponse> {
    this.logger.log(`Fetching historical rates for ${date} with base ${base}`);

    const response = await this.makeRequest<CurrencyApiResponse>({
      method: 'GET',
      url: `${date}?base=${base}`,
    });

    return this.validateResponse(response, this.isCurrencyApiResponse);
  }
}
