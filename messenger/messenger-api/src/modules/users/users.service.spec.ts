import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

// Mock bcrypt (very important for unit tests)
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));
describe('UsersService (unit)', () => {
  let service: UsersService;  //Create a fake UsersService instance
  const prismaMock = {
    user: {
      findFirst: jest.fn(),  // test -- creates an fake instance method to checks existing user
      findUnique: jest.fn(),  // test -- creates an fake instance method to Find user by email 
      create: jest.fn(),  // test -- creates an fake instance method for if no user found create
      update: jest.fn(),  //  test -- creates an fake instance method to Increment token version in the DB
      findMany: jest.fn(),  // test -- creates an fake instance method to display all users
    },
  };
  const jwtMock = {
    sign: jest.fn(),
  };
  beforeEach(async () => {  // run before every test
    jest.clearAllMocks();  
                    // |----> clear count args and order for jest.fn()
// clearing the test mock because in testcases they return no.of times executed and args and store them to maintain 
// record to avoid confusion we do clear mock
/*
            ============================================================
-------------THE ABOVE IS FOR CREATING A MOCK TEST AND CONTROLLING THEM------------- 
-------------THE BELOW IS FOR CREATING A MOCK TEST CASES AND TESTING---------------- 
            ============================================================
*/
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });
// register()
  describe('register()', () => {
    it('should throw if password and confirmPassword do not match', async () => {
      await expect(
        service.register({
          email: 'a@b.com',
          userName: 'bala',
          mobileNumber: '9999999999',
          password: 'pw1',
          confirmPassword: 'pw2',
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });
    it('should throw if user already exists (email/username/phone)', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(
        service.register({
          email: 'a@b.com',
          userName: 'bala',
          mobileNumber: '9999999999',
          password: 'pw',
          confirmPassword: 'pw',
        } as any),
      ).rejects.toThrow('User already exists with this email, username, or phone');
      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: 'a@b.com' },
            { userName: 'bala' },
            { mobileNumber: '9999999999' },
          ],
        },
      });
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });
    it('should hash password and create user when valid', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_pw');
      prismaMock.user.create.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        userName: 'bala',
      });
      const result = await service.register({
        email: 'a@b.com',
        userName: 'bala',
        mobileNumber: '9999999999',
        password: 'pw',
        confirmPassword: 'pw',
      } as any);
      expect(bcrypt.hash).toHaveBeenCalledWith('pw', 10);
      // confirmPassword must NOT be stored
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          email: 'a@b.com',
          userName: 'bala',
          mobileNumber: '9999999999',
          password: 'hashed_pw',
        },
      });
      expect(result).toEqual({
        id: 'u1',
        email: 'a@b.com',
        userName: 'bala',
      });
    });
  });

// login()   
  describe('login()', () => {
    it('should throw if user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'ad', password: 'sd' } as any),
      ).rejects.toThrow(new BadRequestException('Invalid credentials'));
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(jwtMock.sign).not.toHaveBeenCalled();
    });
    it('should throw if password is invalid', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password: 'hashed_pw',
        tokenVersion: 0,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        service.login({ email: 'a@b.com', password: 'wrong' } as any),
      ).rejects.toThrow('Invalid credentials');
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(jwtMock.sign).not.toHaveBeenCalled();
    });
    it('should increment tokenVersion, sign jwt, and return token + user', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password: 'hashed_pw',
        tokenVersion: 0,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prismaMock.user.update.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password: 'hashed_pw',
        tokenVersion: 1,
      });
      jwtMock.sign.mockReturnValue('token123');
      const res = await service.login({ email: 'a@b.com', password: 'pw' } as any);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { tokenVersion: { increment: 1 } },
      });
      expect(jwtMock.sign).toHaveBeenCalledWith({
        sub: 'u1',
        email: 'a@b.com',
        tokenVersion: 1,
      });
      expect(res).toEqual({
        accessToken: 'token123',
        user: {
          id: 'u1',
          email: 'a@b.com',
          password: 'hashed_pw',
          tokenVersion: 1,
        },
      });
    });
  });
// findAll()
  describe('findAll()', () => {
    it('should return users from prisma.user.findMany', async () => {
      prismaMock.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
      const res = await service.findAll();
      expect(prismaMock.user.findMany).toHaveBeenCalled();
      expect(res).toEqual([{ id: 'u1' }, { id: 'u2' }]);
    });
  });
});
