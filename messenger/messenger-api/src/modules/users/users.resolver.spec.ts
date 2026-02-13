import { Test } from '@nestjs/testing';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { FIREBASE_ADMIN } from '../auth/firebase/firebase-admin.provider';

describe('UsersResolver (unit)', () => {
  let resolver: UsersResolver;
  const usersServiceMock = {
    findAll: jest.fn(),
    register: jest.fn(),
    login: jest.fn(),
    updateProfile: jest.fn(),
    updatePassword: jest.fn(),
    forgotPassword: jest.fn(),
    requestEnableAccount: jest.fn(),
    enableAccountWithToken: jest.fn(),
    disableAccount: jest.fn(),
    logout: jest.fn(),
    syncUser: jest.fn(),
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersResolver,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: GqlAuthGuard, useValue: { canActivate: jest.fn(() => true) } },
        { provide: PrismaService, useValue: { user: { findUnique: jest.fn() } } },
        { provide: FIREBASE_ADMIN, useValue: { auth: jest.fn() } },
      ],
    }).compile();
    resolver = moduleRef.get(UsersResolver);
  });
  describe('getUsers()', () => {
    it('should return users from usersService.findAll', async () => {
      const fakeUsers = [
        { id: 'u1', email: 'a@b.com' },
        { id: 'u2', email: 'c@d.com' },
      ];
      usersServiceMock.findAll.mockResolvedValue(fakeUsers);
      const res = await resolver.getUsers();
      expect(usersServiceMock.findAll).toHaveBeenCalledTimes(1);
      expect(res).toEqual(fakeUsers);
    });
  });
  describe('register()', () => {
    it('should call usersService.register with input data and return created user', async () => {
      const input = {
        email: 'a@b.com',
        userName: 'bala',
        mobileNumber: '9999999999',
        password: 'pw',
        confirmPassword: 'pw',
      };
      const created = { id: 'u1', email: 'a@b.com', userName: 'bala' };
      usersServiceMock.register.mockResolvedValue(created);
      const res = await resolver.register(input as any);
      expect(usersServiceMock.register).toHaveBeenCalledTimes(1);
      expect(usersServiceMock.register).toHaveBeenCalledWith(input);
      expect(res).toEqual(created);
    });
  });
  describe('login()', () => {
    it('should call usersService.login with input data and return auth response', async () => {
      const input = { email: 'a@b.com', password: 'pw' };
      const authResponse = {
        accessToken: 'token123',
        user: { id: 'u1', email: 'a@b.com', tokenVersion: 1 },
      };
      usersServiceMock.login.mockResolvedValue(authResponse);
      const res = await resolver.login(input as any);
      expect(usersServiceMock.login).toHaveBeenCalledTimes(1);
      expect(usersServiceMock.login).toHaveBeenCalledWith(input);
      expect(res).toEqual(authResponse);
    });
  });

  describe('logout()', () => {
    it('should call usersService.logout with current user id and return true', async () => {
      const currentUser = { id: 'u1' };
      usersServiceMock.logout.mockResolvedValue(true);

      const res = await resolver.logout(currentUser as any);

      expect(usersServiceMock.logout).toHaveBeenCalledTimes(1);
      expect(usersServiceMock.logout).toHaveBeenCalledWith('u1');
      expect(res).toBe(true);
    });
  });

  describe('updateProfile()', () => {
    it('should call usersService.updateProfile with current user id and input data', async () => {
      const currentUser = { id: 'u1' };
      const input = { firstName: 'New', lastName: 'Name', mobileNumber: '9999999999' };
      const updated = { id: 'u1', ...input };
      usersServiceMock.updateProfile.mockResolvedValue(updated);

      const res = await resolver.updateProfile(currentUser as any, input as any);

      expect(usersServiceMock.updateProfile).toHaveBeenCalledTimes(1);
      expect(usersServiceMock.updateProfile).toHaveBeenCalledWith('u1', input);
      expect(res).toEqual(updated);
    });
  });

  describe('updatePassword()', () => {
    it('should call usersService.updatePassword with current user id and input data', async () => {
      const currentUser = { id: 'u1' };
      const input = { currentPassword: 'OldPassword@123', newPassword: 'NewPassword@123' };
      const updatedUser = { id: 'u1', email: 'a@b.com' };
      usersServiceMock.updatePassword.mockResolvedValue(updatedUser);

      const res = await resolver.updatePassword(currentUser as any, input as any);

      expect(usersServiceMock.updatePassword).toHaveBeenCalledTimes(1);
      expect(usersServiceMock.updatePassword).toHaveBeenCalledWith('u1', input);
      expect(res).toEqual(updatedUser);
    });
  });

  describe('forgotPassword()', () => {
    it('should call usersService.forgotPassword with email and useOobCode', async () => {
      const email = 'a@b.com';
      const response = 'If the account exists, an email was sent';
      usersServiceMock.forgotPassword.mockResolvedValue(response);

      const res = await resolver.forgotPassword(email, true);

      expect(usersServiceMock.forgotPassword).toHaveBeenCalledTimes(1);
      expect(usersServiceMock.forgotPassword).toHaveBeenCalledWith(email, true);
      expect(res).toBe(response);
    });
  });

  describe('requestEnableAccount()', () => {
    it('should call usersService.requestEnableAccount with email', async () => {
      usersServiceMock.requestEnableAccount.mockResolvedValue(
        'If the account exists, an account activation link was sent',
      );

      const res = await resolver.requestEnableAccount('a@b.com');

      expect(usersServiceMock.requestEnableAccount).toHaveBeenCalledTimes(1);
      expect(usersServiceMock.requestEnableAccount).toHaveBeenCalledWith(
        'a@b.com',
      );
      expect(res).toContain('If the account exists');
    });
  });

  describe('enableAccountWithToken()', () => {
    it('should call usersService.enableAccountWithToken with token', async () => {
      const updated = { id: 'u1', isActive: true };
      usersServiceMock.enableAccountWithToken.mockResolvedValue(updated);

      const res = await resolver.enableAccountWithToken('token-123');

      expect(usersServiceMock.enableAccountWithToken).toHaveBeenCalledTimes(1);
      expect(usersServiceMock.enableAccountWithToken).toHaveBeenCalledWith(
        'token-123',
      );
      expect(res).toEqual(updated);
    });
  });

  describe('disableAccount()', () => {
    it('should call usersService.disableAccount with current user id', async () => {
      const currentUser = { id: 'u1' };
      const updated = { id: 'u1', isActive: false };
      usersServiceMock.disableAccount.mockResolvedValue(updated);

      const res = await resolver.disableAccount(currentUser as any);

      expect(usersServiceMock.disableAccount).toHaveBeenCalledTimes(1);
      expect(usersServiceMock.disableAccount).toHaveBeenCalledWith('u1');
      expect(res).toEqual(updated);
    });
  });

  describe('syncUser()', () => {
    it('should call usersService.syncUser with uidOrEmail and adminKey', async () => {
      const uidOrEmail = 'a@b.com';
      const adminKey = 'admin-key';
      const report = { status: 'ok', action: 'noop' };
      usersServiceMock.syncUser.mockResolvedValue(report);

      const res = await resolver.syncUser(uidOrEmail, adminKey);

      expect(usersServiceMock.syncUser).toHaveBeenCalledTimes(1);
      expect(usersServiceMock.syncUser).toHaveBeenCalledWith(uidOrEmail, adminKey);
      expect(res).toEqual(report);
    });
  });
});
