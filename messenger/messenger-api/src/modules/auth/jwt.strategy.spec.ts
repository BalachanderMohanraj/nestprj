import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy (unit)', () => {
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const configMock = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error if JWT_SECRET is not defined', async () => {
      configMock.get.mockReturnValue(undefined);

      // CreateTestingModule will try to instantiate JwtStrategy,
      // which should throw in constructor
      await expect(async () => {
        const moduleRef = await Test.createTestingModule({
          providers: [
            JwtStrategy,
            { provide: PrismaService, useValue: prismaMock },
            { provide: ConfigService, useValue: configMock },
          ],
        }).compile();

        moduleRef.get(JwtStrategy);
      }).rejects.toThrow('JWT_SECRET is not defined');
    });

    it('should construct successfully if JWT_SECRET exists', async () => {
      configMock.get.mockReturnValue('secret123');

      const moduleRef = await Test.createTestingModule({
        providers: [
          JwtStrategy,
          { provide: PrismaService, useValue: prismaMock },
          { provide: ConfigService, useValue: configMock },
        ],
      }).compile();

      const strategy = moduleRef.get(JwtStrategy);
      expect(strategy).toBeDefined();
      expect(configMock.get).toHaveBeenCalledWith('JWT_SECRET');
    });
  });

  describe('validate()', () => {
    it('should return user when user exists and tokenVersion matches', async () => {
      configMock.get.mockReturnValue('secret123');

      const moduleRef = await Test.createTestingModule({
        providers: [
          JwtStrategy,
          { provide: PrismaService, useValue: prismaMock },
          { provide: ConfigService, useValue: configMock },
        ],
      }).compile();

      const strategy = moduleRef.get(JwtStrategy);

      const payload = { sub: 'u1', email: 'a@b.com', tokenVersion: 2 };

      const user = { id: 'u1', email: 'a@b.com', tokenVersion: 2 };
      prismaMock.user.findUnique.mockResolvedValue(user);

      const res = await strategy.validate(payload);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'u1' },
      });
      expect(res).toEqual(user);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      configMock.get.mockReturnValue('secret123');

      const moduleRef = await Test.createTestingModule({
        providers: [
          JwtStrategy,
          { provide: PrismaService, useValue: prismaMock },
          { provide: ConfigService, useValue: configMock },
        ],
      }).compile();

      const strategy = moduleRef.get(JwtStrategy);

      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        strategy.validate({ sub: 'u1', email: 'a@b.com', tokenVersion: 1 }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if tokenVersion does not match', async () => {
      configMock.get.mockReturnValue('secret123');

      const moduleRef = await Test.createTestingModule({
        providers: [
          JwtStrategy,
          { provide: PrismaService, useValue: prismaMock },
          { provide: ConfigService, useValue: configMock },
        ],
      }).compile();

      const strategy = moduleRef.get(JwtStrategy);

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        tokenVersion: 5, // DB version
      });

      await expect(
        strategy.validate({ sub: 'u1', email: 'a@b.com', tokenVersion: 1 }), // token version
      ).rejects.toThrow('Token is no longer valid');
    });
  });
});
