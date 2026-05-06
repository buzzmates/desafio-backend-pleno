import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig, AxiosResponse } from 'axios';

@Injectable()
export abstract class BaseExternalService {
  protected readonly logger: Logger;
  protected readonly httpService: HttpService;

  constructor(serviceName: string, httpService: HttpService) {
    this.logger = new Logger(serviceName);
    this.httpService = httpService;
  }

  /**
   * Get the API key for the service from environment variables
   */
  protected abstract getApiKey(): string;

  /**
   * Get the base URL for the service from environment variables
   */
  protected abstract getBaseUrl(): string;

  /**
   * Get the service name for logging
   */
  protected abstract getServiceName(): string;

  /**
   * Make an HTTP request with common error handling and retries
   */
  protected async makeRequest<T>(config: AxiosRequestConfig): Promise<T> {
    const apiKey = this.getApiKey();
    const baseUrl = this.getBaseUrl();

    if (!apiKey) {
      throw new Error(`API key not configured for ${this.getServiceName()}`);
    }

    if (!baseUrl) {
      throw new Error(`Base URL not configured for ${this.getServiceName()}`);
    }

    const requestConfig: AxiosRequestConfig = {
      ...config,
      url: `${baseUrl}${config.url}`,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'OrderProcessingOrchestrator/1.0',
        apikey: apiKey,
        ...config.headers,
      },
      timeout: 10000,
    };

    try {
      this.logger.debug(`Making request to ${requestConfig.url}`);
      const response: AxiosResponse<T> =
        await this.httpService.axiosRef.request(requestConfig);

      if (response.status >= 200 && response.status < 300) {
        return response.data;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      this.logger.error(
        `Request failed to ${requestConfig.url}:`,
        error instanceof Error ? error.message : String(error),
      );

      if (error instanceof Error && 'response' in error) {
        const axiosError = error as any;
        if (axiosError.response?.status === 401) {
          throw new Error(
            `Unauthorized: Invalid API key for ${this.getServiceName()}`,
          );
        }
        if (axiosError.response?.status === 429) {
          throw new Error(`Rate limit exceeded for ${this.getServiceName()}`);
        }
        if (axiosError.response?.status >= 500) {
          throw new Error(`Service unavailable for ${this.getServiceName()}`);
        }
      }

      throw error;
    }
  }

  /**
   * Retry a function with exponential backoff
   */
  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        this.logger.warn(
          `${this.getServiceName()} attempt ${attempt} failed:`,
          lastError.message,
        );

        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          this.logger.debug(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error(
      `All ${maxRetries} attempts failed for ${this.getServiceName()}`,
      lastError.message,
    );
    throw lastError;
  }

  /**
   * Validate API response structure
   */
  protected validateResponse<T>(
    data: unknown,
    validator: (data: unknown) => data is T,
  ): T {
    if (!validator(data)) {
      throw new Error(`Invalid response format from ${this.getServiceName()}`);
    }
    return data;
  }
}
