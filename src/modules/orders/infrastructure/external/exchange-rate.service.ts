import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ExchangeRateService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async convert(from: string, to: string, amount: number): Promise<number> {
    const apiKey = this.configService.get<string>('EXCHANGE_RATE_API_KEY');

    const response = await this.httpService.axiosRef.get(
      `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${from}/${to}/${amount}`,
    );

    return response.data.conversion_result as number;
  }
}
