import {
  CurrencyConversionRequest,
  CurrencyConversionResult,
} from '../../src/enrichment/dto/currency-conversion.dto';
import { ViaCepApiResponse } from '../../src/enrichment/dto/address-validation.dto';
import {
  ProductVerificationRequest,
  ProductVerificationResult,
  ProductData,
} from '../../src/enrichment/dto/product-verification.dto';

/**
 * Comprehensive mocks for external services used in enrichment testing
 */

export class CurrencyApiMock {
  private static exchangeRates: Record<
    string,
    Record<string, Record<string, number>>
  > = {
    '2024-01-01': {
      USD: { EUR: 0.92, BRL: 4.95, GBP: 0.79, JPY: 110.45 },
      EUR: { USD: 1.09, BRL: 5.38, GBP: 0.86, JPY: 120.05 },
      BRL: { USD: 0.2, EUR: 0.19, GBP: 0.16, JPY: 22.31 },
      GBP: { USD: 1.27, EUR: 1.16, BRL: 6.27, JPY: 139.81 },
      JPY: { USD: 0.0091, EUR: 0.0083, BRL: 0.045, GBP: 0.0071 },
    },
  };

  static async convertCurrency(
    request: CurrencyConversionRequest,
  ): Promise<CurrencyConversionResult> {
    // Simulate network delay
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 100 + 50),
    );

    const rates = this.exchangeRates['2024-01-01'];
    const fromRates = rates[request.from] || {};
    const conversionRate = fromRates[request.to];

    if (!conversionRate) {
      throw new Error(
        `Exchange rate not available for ${request.from} to ${request.to}`,
      );
    }

    return {
      originalAmount: request.amount,
      originalCurrency: request.from,
      targetCurrency: request.to,
      conversionRate,
      convertedAmount: request.amount * conversionRate,
      timestamp: new Date().toISOString(),
    };
  }

  static async convertCurrencyWithFailure(
    request: CurrencyConversionRequest,
  ): Promise<CurrencyConversionResult> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    throw new Error('Currency conversion service unavailable');
  }

  static async convertCurrencyWithTimeout(
    request: CurrencyConversionRequest,
  ): Promise<CurrencyConversionResult> {
    // Simulate timeout
    await new Promise((resolve) => setTimeout(resolve, 30000));
    return this.convertCurrency(request);
  }

  static async convertCurrencyWithRateLimit(
    request: CurrencyConversionRequest,
  ): Promise<CurrencyConversionResult> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  static setCustomExchangeRates(
    date: string,
    rates: Record<string, Record<string, number>>,
  ): void {
    this.exchangeRates[date] = rates;
  }
}

export class ViaCepApiMock {
  private static validCeps: Record<string, ViaCepApiResponse> = {
    '01310-100': {
      cep: '01310-100',
      logradouro: 'Praça da Sé',
      complemento: 'lado ímpar',
      bairro: 'Sé',
      localidade: 'São Paulo',
      uf: 'SP',
      ibge: '3550308',
      gia: '1004',
      ddd: '11',
      siafi: '7107',
    },
    '20040-020': {
      cep: '20040-020',
      logradouro: 'Rua do Catete',
      complemento: '',
      bairro: 'Catete',
      localidade: 'Rio de Janeiro',
      uf: 'RJ',
      ibge: '3304557',
      gia: '',
      ddd: '21',
      siafi: '6391',
    },
    '70040-020': {
      cep: '70040-020',
      logradouro: 'Setor de Autarquias Sul',
      complemento: '',
      bairro: 'Asa Sul',
      localidade: 'Brasília',
      uf: 'DF',
      ibge: '5300108',
      gia: '',
      ddd: '61',
      siafi: '7107',
    },
  };

  static async validateAddress(postalCode: string): Promise<ViaCepApiResponse> {
    // Simulate network delay
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 150 + 100),
    );

    const cleanCep = postalCode.replace(/\D/g, '');
    const formattedCep =
      cleanCep.length === 8
        ? `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`
        : cleanCep;

    const result = this.validCeps[formattedCep];

    if (!result) {
      return {
        cep: formattedCep,
        logradouro: '',
        complemento: '',
        bairro: '',
        localidade: '',
        uf: '',
        ibge: '',
        gia: '',
        ddd: '',
        siafi: '',
        erro: true,
      };
    }

    return result;
  }

  static async validateAddressWithFailure(
    postalCode: string,
  ): Promise<ViaCepApiResponse> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    throw new Error('ViaCEP service temporarily unavailable');
  }

  static async validateAddressWithTimeout(
    postalCode: string,
  ): Promise<ViaCepApiResponse> {
    // Simulate timeout
    await new Promise((resolve) => setTimeout(resolve, 30000));
    return this.validateAddress(postalCode);
  }

  static async validateAddressWithRateLimit(
    postalCode: string,
  ): Promise<ViaCepApiResponse> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    throw new Error('Too many requests. Please try again later.');
  }

  static addValidCep(cep: string, data: ViaCepApiResponse): void {
    this.validCeps[cep] = data;
  }
}

export class ProductApiMock {
  private static products: Record<string, ProductData> = {
    'SKU-001': {
      name: 'Wireless Mouse',
      price: 29.99,
      stock: 150,
      isActive: true,
    },
    'SKU-002': {
      name: 'Mechanical Keyboard',
      price: 89.99,
      stock: 75,
      isActive: true,
    },
    'SKU-003': {
      name: 'USB-C Hub',
      price: 19.99,
      stock: 0,
      isActive: true,
    },
    'SKU-004': {
      name: 'Discontinued Product',
      price: 199.99,
      stock: 0,
      isActive: false,
    },
  };

  static async verifyProduct(
    request: ProductVerificationRequest,
  ): Promise<ProductVerificationResult> {
    // Simulate network delay
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 200 + 100),
    );

    const product = this.products[request.sku];

    if (!product) {
      return {
        sku: request.sku,
        isValid: false,
        error: 'Product not found',
      };
    }

    return {
      sku: request.sku,
      isValid: true,
      name: product.name,
      price: product.price,
      stock: product.stock,
      isActive: product.isActive,
    };
  }

  static async verifyProductWithFailure(
    request: ProductVerificationRequest,
  ): Promise<ProductVerificationResult> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    throw new Error('Product verification service unavailable');
  }

  static async verifyProductWithTimeout(
    request: ProductVerificationRequest,
  ): Promise<ProductVerificationResult> {
    // Simulate timeout
    await new Promise((resolve) => setTimeout(resolve, 30000));
    return this.verifyProduct(request);
  }

  static async verifyProductWithRateLimit(
    request: ProductVerificationRequest,
  ): Promise<ProductVerificationResult> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  static addProduct(sku: string, product: ProductData): void {
    this.products[sku] = product;
  }

  static updateProductStock(sku: string, stock: number): void {
    if (this.products[sku]) {
      this.products[sku].stock = stock;
    }
  }
}

/**
 * Mock response factories for testing various scenarios
 */
export class MockResponseFactory {
  static createCurrencyConversionResult(
    overrides: Partial<CurrencyConversionResult> = {},
  ): CurrencyConversionResult {
    return {
      originalAmount: 100,
      originalCurrency: 'BRL',
      targetCurrency: 'USD',
      conversionRate: 0.2,
      convertedAmount: 20,
      timestamp: new Date().toISOString(),
      ...overrides,
    };
  }

  static createViaCepApiResponse(
    overrides: Partial<ViaCepApiResponse> = {},
  ): ViaCepApiResponse {
    return {
      cep: '01310-100',
      logradouro: 'Praça da Sé',
      complemento: 'lado ímpar',
      bairro: 'Sé',
      localidade: 'São Paulo',
      uf: 'SP',
      ibge: '3550308',
      gia: '1004',
      ddd: '11',
      siafi: '7107',
      ...overrides,
    };
  }

  static createProductVerificationResult(
    overrides: Partial<ProductVerificationResult> = {},
  ): ProductVerificationResult {
    return {
      sku: 'SKU-001',
      isValid: true,
      name: 'Test Product',
      price: 99.99,
      stock: 50,
      isActive: true,
      ...overrides,
    };
  }

  static createProductData(overrides: Partial<ProductData> = {}): ProductData {
    return {
      name: 'Test Product',
      price: 99.99,
      stock: 50,
      isActive: true,
      ...overrides,
    };
  }
}

/**
 * Error scenario factory for testing failure modes
 */
export class ErrorScenarioFactory {
  static createNetworkError(message: string = 'Network error'): Error {
    const error = new Error(message);
    error.name = 'NetworkError';
    return error;
  }

  static createTimeoutError(message: string = 'Request timeout'): Error {
    const error = new Error(message);
    error.name = 'TimeoutError';
    return error;
  }

  static createRateLimitError(message: string = 'Rate limit exceeded'): Error {
    const error = new Error(message);
    error.name = 'RateLimitError';
    return error;
  }

  static createServerError(message: string = 'Internal server error'): Error {
    const error = new Error(message);
    error.name = 'ServerError';
    return error;
  }

  static createNotFoundError(message: string = 'Resource not found'): Error {
    const error = new Error(message);
    error.name = 'NotFoundError';
    return error;
  }
}

/**
 * Mock HTTP client for external services
 */
export class MockHttpClient {
  private static responses: Map<string, any> = new Map();
  private static errors: Map<string, Error> = new Map();

  static setResponse(url: string, response: any): void {
    this.responses.set(url, response);
  }

  static setError(url: string, error: Error): void {
    this.errors.set(url, error);
  }

  static clear(): void {
    this.responses.clear();
    this.errors.clear();
  }

  static async get(url: string): Promise<any> {
    // Simulate network delay
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 100 + 50),
    );

    if (this.errors.has(url)) {
      throw this.errors.get(url);
    }

    if (this.responses.has(url)) {
      return this.responses.get(url);
    }

    throw new Error(`No mock response configured for URL: ${url}`);
  }

  static async post(url: string, data: any): Promise<any> {
    // Simulate network delay
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 100 + 50),
    );

    if (this.errors.has(url)) {
      throw this.errors.get(url);
    }

    if (this.responses.has(url)) {
      return this.responses.get(url);
    }

    throw new Error(`No mock response configured for URL: ${url}`);
  }
}

/**
 * Utility functions for mock setup and teardown
 */
export class MockUtils {
  static resetAllMocks(): void {
    CurrencyApiMock.setCustomExchangeRates('2024-01-01', {});
    ViaCepApiMock.addValidCep('', {} as ViaCepApiResponse);
    ProductApiMock.addProduct('', {} as ProductData);
    MockHttpClient.clear();
  }

  static setupSuccessScenario(): void {
    // Setup all services to return successful responses
    this.resetAllMocks();

    // Add test data
    ViaCepApiMock.addValidCep(
      '01310-100',
      MockResponseFactory.createViaCepApiResponse(),
    );
    ProductApiMock.addProduct(
      'SKU-001',
      MockResponseFactory.createProductData(),
    );
  }

  static setupFailureScenario(): void {
    this.resetAllMocks();

    // Configure all services to return errors
    MockHttpClient.setError(
      'https://api.exchangerate.host/latest',
      ErrorScenarioFactory.createNetworkError(),
    );
    MockHttpClient.setError(
      'https://viacep.com.br/ws/01001000/json',
      ErrorScenarioFactory.createNetworkError(),
    );
    MockHttpClient.setError(
      'https://fakestoreapi.com/products/1',
      ErrorScenarioFactory.createNetworkError(),
    );
  }

  static setupPartialFailureScenario(): void {
    this.resetAllMocks();

    // Some services succeed, others fail
    ViaCepApiMock.addValidCep(
      '01310-100',
      MockResponseFactory.createViaCepApiResponse(),
    );
    MockHttpClient.setError(
      'https://api.exchangerate.host/latest',
      ErrorScenarioFactory.createNetworkError(),
    );
    ProductApiMock.addProduct(
      'SKU-001',
      MockResponseFactory.createProductData(),
    );
  }
}
