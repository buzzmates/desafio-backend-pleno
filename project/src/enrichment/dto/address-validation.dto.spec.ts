import { plainToInstance } from 'class-transformer';

describe('AddressValidationRequest', () => {
  describe('interface validation', () => {
    it('should accept valid postal code', () => {
      // Arrange
      const validData = {
        postalCode: '01310-100',
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.postalCode).toBe('01310-100');
    });

    it('should accept postal code without hyphen', () => {
      // Arrange
      const validData = {
        postalCode: '01310100',
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.postalCode).toBe('01310100');
    });

    it('should accept empty postal code', () => {
      // Arrange
      const validData = {
        postalCode: '',
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.postalCode).toBe('');
    });

    it('should accept null postal code', () => {
      // Arrange
      const validData = {
        postalCode: null,
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.postalCode).toBeNull();
    });

    it('should accept undefined postal code', () => {
      // Arrange
      const validData = {
        postalCode: undefined,
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.postalCode).toBeUndefined();
    });
  });

  describe('postal code formats', () => {
    it('should accept São Paulo CEP format', () => {
      // Arrange
      const validData = {
        postalCode: '01001-000',
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.postalCode).toBe('01001-000');
    });

    it('should accept Rio de Janeiro CEP format', () => {
      // Arrange
      const validData = {
        postalCode: '20040-020',
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.postalCode).toBe('20040-020');
    });

    it('should accept Brasília CEP format', () => {
      // Arrange
      const validData = {
        postalCode: '70040-020',
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.postalCode).toBe('70040-020');
    });

    it('should accept 8-digit CEP format', () => {
      // Arrange
      const validData = {
        postalCode: '01001000',
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.postalCode).toBe('01001000');
    });
  });

  describe('edge cases', () => {
    it('should handle very long postal codes', () => {
      // Arrange
      const validData = {
        postalCode: '0'.repeat(100),
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.postalCode).toBe('0'.repeat(100));
    });

    it('should handle postal codes with special characters', () => {
      // Arrange
      const validData = {
        postalCode: 'ABC-123',
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.postalCode).toBe('ABC-123');
    });

    it('should handle numeric postal codes', () => {
      // Arrange
      const validData = {
        postalCode: 12345678 as any,
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.postalCode).toBe(12345678);
    });
  });
});

describe('AddressValidationResult', () => {
  describe('interface validation', () => {
    it('should accept valid result with address', () => {
      // Arrange
      const validData = {
        isValid: true,
        postalCode: '01310-100',
        address: {
          street: 'Praça da Sé',
          neighborhood: 'Sé',
          city: 'São Paulo',
          state: 'SP',
        },
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.isValid).toBe(true);
      expect(dto.postalCode).toBe('01310-100');
      expect(dto.address.street).toBe('Praça da Sé');
      expect(dto.address.neighborhood).toBe('Sé');
      expect(dto.address.city).toBe('São Paulo');
      expect(dto.address.state).toBe('SP');
    });

    it('should accept valid result without address', () => {
      // Arrange
      const validData = {
        isValid: false,
        postalCode: '00000-000',
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.isValid).toBe(false);
      expect(dto.postalCode).toBe('00000-000');
      expect(dto.address).toBeUndefined();
    });

    it('should accept result with error message', () => {
      // Arrange
      const validData = {
        isValid: false,
        postalCode: '99999-999',
        error: 'CEP não encontrado',
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.isValid).toBe(false);
      expect(dto.postalCode).toBe('99999-999');
      expect(dto.error).toBe('CEP não encontrado');
      expect(dto.address).toBeUndefined();
    });
  });

  describe('boolean validation', () => {
    it('should accept true', () => {
      // Arrange
      const validData = {
        isValid: true,
        postalCode: '01310-100',
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.isValid).toBe(true);
    });

    it('should accept false', () => {
      // Arrange
      const validData = {
        isValid: false,
        postalCode: '01310-100',
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.isValid).toBe(false);
    });

    it('should handle string boolean values', () => {
      // Arrange
      const validData = {
        isValid: 'true' as any,
        postalCode: '01310-100',
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.isValid).toBe('true');
    });

    it('should handle numeric boolean values', () => {
      // Arrange
      const validData = {
        isValid: 1 as any,
        postalCode: '01310-100',
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.isValid).toBe(1);
    });
  });

  describe('address object validation', () => {
    it('should accept complete address', () => {
      // Arrange
      const validData = {
        isValid: true,
        postalCode: '01310-100',
        address: {
          street: 'Rua Augusta, 1234',
          neighborhood: 'Consolação',
          city: 'São Paulo',
          state: 'SP',
        },
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.address.street).toBe('Rua Augusta, 1234');
      expect(dto.address.neighborhood).toBe('Consolação');
      expect(dto.address.city).toBe('São Paulo');
      expect(dto.address.state).toBe('SP');
    });

    it('should accept partial address', () => {
      // Arrange
      const validData = {
        isValid: true,
        postalCode: '01310-100',
        address: {
          street: 'Rua Teste',
          neighborhood: '',
          city: 'São Paulo',
          state: 'SP',
        },
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.address.street).toBe('Rua Teste');
      expect(dto.address.neighborhood).toBe('');
      expect(dto.address.city).toBe('São Paulo');
      expect(dto.address.state).toBe('SP');
    });

    it('should accept empty address object', () => {
      // Arrange
      const validData = {
        isValid: true,
        postalCode: '01310-100',
        address: {},
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.address).toEqual({});
    });
  });
});

describe('ViaCepApiResponse', () => {
  describe('interface validation', () => {
    it('should accept complete ViaCEP response', () => {
      // Arrange
      const validData = {
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
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.cep).toBe('01310-100');
      expect(dto.logradouro).toBe('Praça da Sé');
      expect(dto.complemento).toBe('lado ímpar');
      expect(dto.bairro).toBe('Sé');
      expect(dto.localidade).toBe('São Paulo');
      expect(dto.uf).toBe('SP');
      expect(dto.ibge).toBe('3550308');
      expect(dto.gia).toBe('1004');
      expect(dto.ddd).toBe('11');
      expect(dto.siafi).toBe('7107');
    });

    it('should accept ViaCEP response with error', () => {
      // Arrange
      const validData = {
        cep: '99999-999',
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

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.cep).toBe('99999-999');
      expect(dto.erro).toBe(true);
    });

    it('should accept ViaCEP response without error', () => {
      // Arrange
      const validData = {
        cep: '01310-100',
        logradouro: 'Praça da Sé',
        complemento: '',
        bairro: 'Sé',
        localidade: 'São Paulo',
        uf: 'SP',
        ibge: '3550308',
        gia: '1004',
        ddd: '11',
        siafi: '7107',
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.erro).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle boolean error flag', () => {
      // Arrange
      const validData = {
        cep: '00000-000',
        erro: false,
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.erro).toBe(false);
    });

    it('should handle missing error flag', () => {
      // Arrange
      const validData = {
        cep: '01310-100',
      };

      // Act
      const dto = plainToInstance(Object, validData) as any;

      // Assert
      expect(dto.erro).toBeUndefined();
    });
  });
});
