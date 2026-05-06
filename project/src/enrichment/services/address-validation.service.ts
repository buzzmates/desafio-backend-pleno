import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { BaseExternalService } from '../base-external.service';
import {
  AddressValidationRequest,
  AddressValidationResult,
  ViaCepApiResponse,
} from '../dto/address-validation.dto';

@Injectable()
export class AddressValidationService extends BaseExternalService {
  constructor(httpService: HttpService) {
    super('AddressValidationService', httpService);
  }

  protected getApiKey(): string {
    return process.env.ADDRESS_API_KEY || '';
  }

  protected getBaseUrl(): string {
    return process.env.ADDRESS_API_URL || 'https://viacep.com.br/ws/';
  }

  protected getServiceName(): string {
    return 'AddressValidation';
  }

  async validateAddress(
    request: AddressValidationRequest,
  ): Promise<AddressValidationResult> {
    const { postalCode } = request;
    this.logger.log(`Validando endereço para CEP: ${postalCode}`);

    try {
      const response = await this.httpService.axiosRef.get(
        `https://viacep.com.br/ws/${postalCode}/json/`,
      );

      const data = response.data;

      if (data.erro) {
        const result: AddressValidationResult = {
          isValid: false,
          postalCode,
          error: 'CEP inválido',
        };

        return result;
      }

      const result: AddressValidationResult = {
        isValid: true,
        postalCode,
        address: {
          street: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
          state: data.uf,
        },
      };

      return result;
    } catch (error) {
      this.logger.error(`Validação de endereço falhou:`, error.message);

      const result: AddressValidationResult = {
        isValid: false,
        postalCode,
        error: error.message,
      };

      return result;
    }
  }
}
