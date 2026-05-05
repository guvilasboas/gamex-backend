import { Test, TestingModule } from '@nestjs/testing';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordService],
    }).compile();

    service = module.get<PasswordService>(PasswordService);
  });

  describe('hashPassword', () => {
    it('should return a hashed string', async () => {
      const hash = await service.hashPassword('secret');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe('secret');
    });

    it('should produce different hashes for the same password', async () => {
      const hash1 = await service.hashPassword('secret');
      const hash2 = await service.hashPassword('secret');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should return true for a matching password', async () => {
      const hash = await service.hashPassword('correct');
      const result = await service.comparePassword('correct', hash);
      expect(result).toBe(true);
    });

    it('should return false for a non-matching password', async () => {
      const hash = await service.hashPassword('correct');
      const result = await service.comparePassword('wrong', hash);
      expect(result).toBe(false);
    });
  });
});
