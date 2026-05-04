import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ExchangeRateService } from './exchange-rate.service';
import { MetricsService } from '../../../../observability/metrics.service';

type ExchangeRateApiResponse = {
  data: {
    conversion_result: number;
  };
};

describe('ExchangeRateService', () => {
  let service: ExchangeRateService;
  let httpGet: jest.MockedFunction<
    (url: string) => Promise<ExchangeRateApiResponse>
  >;
  let httpService: {
    axiosRef: {
      get: typeof httpGet;
    };
  };
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let endTimer: jest.Mock;
  let metricsService: jest.Mocked<
    Pick<MetricsService, 'startExternalApiTimer'>
  >;

  beforeEach(() => {
    httpGet = jest.fn<(url: string) => Promise<ExchangeRateApiResponse>>();

    httpService = {
      axiosRef: {
        get: httpGet,
      },
    };

    configService = {
      get: jest.fn().mockReturnValue('api-key'),
    } as unknown as jest.Mocked<Pick<ConfigService, 'get'>>;

    endTimer = jest.fn();

    metricsService = {
      startExternalApiTimer: jest.fn().mockReturnValue(endTimer),
    } as unknown as jest.Mocked<Pick<MetricsService, 'startExternalApiTimer'>>;

    service = new ExchangeRateService(
      httpService as unknown as HttpService,
      configService as unknown as ConfigService,
      metricsService as unknown as MetricsService,
    );
  });

  it('records a successful external API call and returns the converted amount', async () => {
    httpService.axiosRef.get.mockResolvedValue({
      data: {
        conversion_result: 123.45,
      },
    });

    await expect(service.convert('USD', 'BRL', 100)).resolves.toBe(123.45);

    expect(httpService.axiosRef.get).toHaveBeenCalledWith(
      'https://v6.exchangerate-api.com/v6/api-key/pair/USD/BRL/100',
    );
    expect(endTimer).toHaveBeenCalledWith({
      service: 'exchange_rate_api',
      outcome: 'success',
    });
  });

  it('records a failed external API call and rethrows the error', async () => {
    const error = new Error('upstream unavailable');
    httpService.axiosRef.get.mockRejectedValue(error);

    await expect(service.convert('USD', 'BRL', 100)).rejects.toThrow(
      'upstream unavailable',
    );

    expect(endTimer).toHaveBeenCalledWith({
      service: 'exchange_rate_api',
      outcome: 'error',
    });
  });
});
