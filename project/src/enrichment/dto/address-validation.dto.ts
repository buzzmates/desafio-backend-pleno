export interface AddressValidationRequest {
  postalCode: string;
}

export interface AddressValidationResult {
  isValid: boolean;
  postalCode: string;
  address?: {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  error?: string;
}

export interface ViaCepApiResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}
