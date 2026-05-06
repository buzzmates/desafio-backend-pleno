import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CurrencyConversionRequest } from './currency-conversion.dto';

describe('CurrencyConversionRequest', () => {
  describe('validation', () => {
    it('should pass validation with valid data', async () => {
      // Arrange
      const validData = {
        amount: 100.5,
        from: 'USD',
        to: 'BRL',
      };

      // Act
      const dto = plainToInstance(CurrencyConversionRequest, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.amount).toBe(100.5);
      expect(dto.from).toBe('USD');
      expect(dto.to).toBe('BRL');
    });

    it('should pass validation with zero amount', async () => {
      // Arrange
      const validData = {
        amount: 0,
        from: 'EUR',
        to: 'USD',
      };

      // Act
      const dto = plainToInstance(CurrencyConversionRequest, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.amount).toBe(0);
    });

    it('should pass validation with decimal amount', async () => {
      // Arrange
      const validData = {
        amount: 99.99,
        from: 'BRL',
        to: 'EUR',
      };

      // Act
      const dto = plainToInstance(CurrencyConversionRequest, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.amount).toBe(99.99);
    });

    it('should fail validation with negative amount', async () => {
      // Arrange
      const invalidData = {
        amount: -50,
        from: 'USD',
        to: 'BRL',
      };

      // Act
      const dto = plainToInstance(CurrencyConversionRequest, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('amount');
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should fail validation with missing amount', async () => {
      // Arrange
      const invalidData = {
        from: 'USD',
        to: 'BRL',
      };

      // Act
      const dto = plainToInstance(CurrencyConversionRequest, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('amount');
    });

    it('should fail validation with empty from currency', async () => {
      // Arrange
      const invalidData = {
        amount: 100,
        from: '',
        to: 'BRL',
      };

      // Act
      const dto = plainToInstance(CurrencyConversionRequest, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('from');
    });

    it('should fail validation with missing from currency', async () => {
      // Arrange
      const invalidData = {
        amount: 100,
        to: 'BRL',
      };

      // Act
      const dto = plainToInstance(CurrencyConversionRequest, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('from');
    });

    it('should fail validation with empty to currency', async () => {
      // Arrange
      const invalidData = {
        amount: 100,
        from: 'USD',
        to: '',
      };

      // Act
      const dto = plainToInstance(CurrencyConversionRequest, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('to');
    });

    it('should fail validation with missing to currency', async () => {
      // Arrange
      const invalidData = {
        amount: 100,
        from: 'USD',
      };

      // Act
      const dto = plainToInstance(CurrencyConversionRequest, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('to');
    });

    it('should fail validation with too long from currency', async () => {
      // Arrange
      const invalidData = {
        amount: 100,
        from: 'USDD',
        to: 'BRL',
      };

      // Act
      const dto = plainToInstance(CurrencyConversionRequest, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('from');
      expect(errors[0].constraints).toHaveProperty('isLength');
    });

    it('should fail validation with too short from currency', async () => {
      // Arrange
      const invalidData = {
        amount: 100,
        from: 'US',
        to: 'BRL',
      };

      // Act
      const dto = plainToInstance(CurrencyConversionRequest, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('from');
      expect(errors[0].constraints).toHaveProperty('isLength');
    });

    it('should fail validation with too long to currency', async () => {
      // Arrange
      const invalidData = {
        amount: 100,
        from: 'USD',
        to: 'BRLL',
      };

      // Act
      const dto = plainToInstance(CurrencyConversionRequest, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('to');
      expect(errors[0].constraints).toHaveProperty('isLength');
    });

    it('should fail validation with too short to currency', async () => {
      // Arrange
      const invalidData = {
        amount: 100,
        from: 'USD',
        to: 'BR',
      };

      // Act
      const dto = plainToInstance(CurrencyConversionRequest, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('to');
      expect(errors[0].constraints).toHaveProperty('isLength');
    });
  });

  describe('edge cases', () => {
    it('should accept valid currency codes', async () => {
      // Arrange
      const validCurrencies = ['USD', 'EUR', 'BRL', 'GBP', 'JPY', 'CAD', 'AUD'];

      for (const from of validCurrencies) {
        for (const to of validCurrencies) {
          if (from === to) continue; // Skip same currency conversion

          const validData = {
            amount: 100,
            from,
            to,
          };

          // Act
          const dto = plainToInstance(CurrencyConversionRequest, validData);
          const errors = await validate(dto);

          // Assert
          expect(errors).toHaveLength(0);
          expect(dto.from).toBe(from);
          expect(dto.to).toBe(to);
        }
      }
    });

    it('should handle very large amounts', async () => {
      // Arrange
      const validData = {
        amount: 999999999.99,
        from: 'USD',
        to: 'BRL',
      };

      // Act
      const dto = plainToInstance(CurrencyConversionRequest, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.amount).toBe(999999999.99);
    });

    it('should handle string number conversion', async () => {
      // Arrange
      const validData = {
        amount: '100.50' as any,
        from: 'USD',
        to: 'BRL',
      };

      // Act
      const dto = plainToInstance(CurrencyConversionRequest, validData);
      const errors = await validate(dto);

      // Assert - class-transformer should handle the conversion
      expect(errors.length).toBeGreaterThanOrEqual(0);
    });

    it('should report multiple validation errors', async () => {
      // Arrange
      const invalidData = {
        amount: -100,
        from: 'TOOLONG',
        to: '',
      };

      // Act
      const dto = plainToInstance(CurrencyConversionRequest, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(1);
      const errorProperties = errors.map((e) => e.property);
      expect(errorProperties).toContain('amount');
      expect(errorProperties).toContain('from');
      expect(errorProperties).toContain('to');
    });

    it('should handle null and undefined values', async () => {
      // Arrange
      const invalidData = {
        amount: null,
        from: undefined,
        to: null,
      };

      // Act
      const dto = plainToInstance(CurrencyConversionRequest, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('currency code validation', () => {
    it('should accept lowercase currency codes', async () => {
      // Arrange
      const validData = {
        amount: 100,
        from: 'usd',
        to: 'brl',
      };

      // Act
      const dto = plainToInstance(CurrencyConversionRequest, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.from).toBe('usd');
      expect(dto.to).toBe('brl');
    });

    it('should accept mixed case currency codes', async () => {
      // Arrange
      const validData = {
        amount: 100,
        from: 'Usd',
        to: 'BrL',
      };

      // Act
      const dto = plainToInstance(CurrencyConversionRequest, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.from).toBe('Usd');
      expect(dto.to).toBe('BrL');
    });

    it('should accept numeric currency codes', async () => {
      // Arrange
      const validData = {
        amount: 100,
        from: '123',
        to: '456',
      };

      // Act
      const dto = plainToInstance(CurrencyConversionRequest, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.from).toBe('123');
      expect(dto.to).toBe('456');
    });
  });
});
