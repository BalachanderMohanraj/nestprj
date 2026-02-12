import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy (unit)', () => {
  let strategy: JwtStrategy;

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

  const buildStrategy = async (secret: string | undefined) => {
    configMock.get.mockReturnValue(secret);

    const moduleRef = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    return moduleRef.get(JwtStrategy);
  };

  describe('constructor', () => {
    it('should throw error if JWT_SECRET is not defined', async () => {
      await expect(buildStrategy(undefined)).rejects.toThrow(
        'JWT_SECRET is not defined',
      );
    });

    it('should construct successfully if JWT_SECRET exists', async () => {
      strategy = await buildStrategy('secret123');
      expect(strategy).toBeDefined();
      expect(configMock.get).toHaveBeenCalledWith('JWT_SECRET');
    });
  });

  describe('validate()', () => {
    it('should return user when user exists and tokenVersion matches', async () => {
      strategy = await buildStrategy('secret123');

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
      strategy = await buildStrategy('secret123');

      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        strategy.validate({ sub: 'u1', email: 'a@b.com', tokenVersion: 1 }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if tokenVersion does not match', async () => {
      strategy = await buildStrategy('secret123');

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
