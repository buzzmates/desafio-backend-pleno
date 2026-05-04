import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../../../../observability/metrics.service';

@Injectable()
export class ExchangeRateService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {}

  async convert(from: string, to: string, amount: number): Promise<number> {
    const apiKey = this.configService.get<string>('EXCHANGE_RATE_API_KEY');
    const end = this.metricsService.startExternalApiTimer();
    let outcome: 'success' | 'error' = 'success';

    try {
      const response = await this.httpService.axiosRef.get(
        `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${from}/${to}/${amount}`,
      );

      return response.data.conversion_result as number;
    } catch (error) {
      outcome = 'error';
      throw error;
    } finally {
      end({ service: 'exchange_rate_api', outcome });
    }
  }
}
