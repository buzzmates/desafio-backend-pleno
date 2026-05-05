export interface ProductVerificationRequest {
  sku: string;
}

export interface ProductVerificationResult {
  sku: string;
  isValid: boolean;
  name?: string;
  price?: number;
  stock?: number;
  isActive?: boolean;
  error?: string;
}

export interface ProductData {
  name: string;
  price: number;
  stock: number;
  isActive: boolean;
}
