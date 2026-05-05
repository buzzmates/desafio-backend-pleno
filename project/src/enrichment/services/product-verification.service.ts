import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { BaseExternalService } from '../base-external.service';
import { 
  ProductVerificationRequest, 
  ProductVerificationResult, 
  ProductData 
} from '../dto/product-verification.dto';

@Injectable()
export class ProductVerificationService extends BaseExternalService {
  constructor(httpService: HttpService) {
    super('ProductVerificationService', httpService);
  }

  protected getApiKey(): string {
    return process.env.PRODUCT_API_KEY || '';
  }

  protected getBaseUrl(): string {
    return process.env.PRODUCT_API_URL || 'https://fakestoreapi.com/products/';
  }

  protected getServiceName(): string {
    return 'ProductVerification';
  }

  async verifyProduct(request: ProductVerificationRequest): Promise<ProductVerificationResult> {
    const { sku } = request;
    this.logger.log(`Verificando produto SKU: ${sku}`);

    try {
      const mockProductData: Record<string, any> = {
        'ABC123': { name: 'Produto Amostra', price: 59.90, stock: 100, isActive: true },
        'XYZ789': { name: 'Outro Produto', price: 29.90, stock: 50, isActive: true },
      };

      const product = mockProductData[sku];
      if (!product) {
        const result: ProductVerificationResult = {
          sku,
          isValid: false,
          error: 'Produto não encontrado',
        };

        return result;
      }

      const result: ProductVerificationResult = {
        sku,
        isValid: true,
        name: product.name,
        price: product.price,
        stock: product.stock,
        isActive: product.isActive,
      };

      return result;
    } catch (error) {
      this.logger.error(`Verificação de produto falhou:`, error.message);
      
      const result: ProductVerificationResult = {
        sku,
        isValid: false,
        error: error.message,
      };

      return result;
    }
  }
}
