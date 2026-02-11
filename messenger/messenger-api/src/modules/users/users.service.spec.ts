import { Test } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FIREBASE_ADMIN } from '../auth/firebase/firebase-admin.provider';

describe('UsersService (unit) - Firebase Auth transitional', () => {
  let service: UsersService;

  const prismaMock = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };

  // firebase-admin mock (only what you use)
  const firebaseAuthMock = {
    createUser: jest.fn(),
    getUserByEmail: jest.fn(),
    deleteUser: jest.fn(),
    setCustomUserClaims: jest.fn(),
    updateUser: jest.fn(),
  };

  const firebaseMock = {
    auth: () => firebaseAuthMock,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // mock fetch for login flow
    (global as any).fetch = jest.fn();

    process.env.APIKEY = 'AIzaFakeKeyForTests';
    process.env.ADMIN_API_KEY = 'admin-key';

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: FIREBASE_ADMIN, useValue: firebaseMock },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  // --------------------
  // register()
  // --------------------
  describe('register()', () => {
    it('throws if password mismatch', async () => {
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
      expect(firebaseAuthMock.createUser).not.toHaveBeenCalled();
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('throws if user exists in DB', async () => {
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

      expect(firebaseAuthMock.createUser).not.toHaveBeenCalled();
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('creates Firebase user and creates DB user without storing password', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      firebaseAuthMock.createUser.mockResolvedValue({ uid: 'fb_uid_1' });

      prismaMock.user.create.mockResolvedValue({
        id: 'db_u1',
        email: 'a@b.com',
        userName: 'bala',
        firebaseUid: 'fb_uid_1',
      });

      const result = await service.register({
        email: 'a@b.com',
        userName: 'bala',
        mobileNumber: '9999999999',
        password: 'pw',
        confirmPassword: 'pw',
      } as any);

      expect(firebaseAuthMock.createUser).toHaveBeenCalledWith({
        email: 'a@b.com',
        password: 'pw',
      });

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          email: 'a@b.com',
          userName: 'bala',
          mobileNumber: '9999999999',
          password: null,
          firebaseUid: 'fb_uid_1',
        },
      });

      expect(result).toEqual({
        id: 'db_u1',
        email: 'a@b.com',
        userName: 'bala',
        firebaseUid: 'fb_uid_1',
      });
    });

    it('if Firebase says email exists, links by getUserByEmail', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      const err: any = new Error('exists');
      err.code = 'auth/email-already-exists';

      firebaseAuthMock.createUser.mockRejectedValue(err);
      firebaseAuthMock.getUserByEmail.mockResolvedValue({ uid: 'fb_uid_existing' });

      prismaMock.user.create.mockResolvedValue({ id: 'db_u1', firebaseUid: 'fb_uid_existing' });

      await service.register({
        email: 'a@b.com',
        userName: 'bala',
        mobileNumber: '9999999999',
        password: 'pw',
        confirmPassword: 'pw',
      } as any);

      expect(firebaseAuthMock.getUserByEmail).toHaveBeenCalledWith('a@b.com');
      expect(prismaMock.user.create).toHaveBeenCalled();
    });

    it('rolls back Firebase user (deleteUser) if DB create fails', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);
      firebaseAuthMock.createUser.mockResolvedValue({ uid: 'fb_uid_rollback' });
      prismaMock.user.create.mockRejectedValue(new Error('DB fail'));

      await expect(
        service.register({
          email: 'a@b.com',
          userName: 'bala',
          mobileNumber: '9999999999',
          password: 'pw',
          confirmPassword: 'pw',
        } as any),
      ).rejects.toThrow('DB fail');

      expect(firebaseAuthMock.deleteUser).toHaveBeenCalledWith('fb_uid_rollback');
    });
  });

  // --------------------
  // login()
  // --------------------
  describe('login()', () => {
    it('throws if Firebase sign-in fails', async () => {
      // signInWithPassword fetch mock -> not ok
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }),
      });

      await expect(
        service.login({ email: 'a@b.com', password: 'wrongpw' } as any),
      ).rejects.toThrow(new UnauthorizedException('INVALID_LOGIN_CREDENTIALS'));

      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws if Firebase user is disabled', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'USER_DISABLED' } }),
      });

      await expect(
        service.login({ email: 'a@b.com', password: 'pw' } as any),
      ).rejects.toThrow(new UnauthorizedException('User disabled'));
    });

    it('throws if user not found in DB (after Firebase login)', async () => {
      // Firebase sign in ok
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          idToken: 'id1',
          refreshToken: 'ref1',
          email: 'a@b.com',
          localId: 'fb_uid_1',
        }),
      });

      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'a@b.com', password: 'pw' } as any),
      ).rejects.toThrow('User not found in DB. Please register first.');

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'a@b.com' },
      });
    });

    it('links firebaseUid if missing, increments tokenVersion, sets claims, refreshes token, returns accessToken', async () => {
      // 1) signInWithPassword
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          idToken: 'id1',
          refreshToken: 'ref1',
          email: 'a@b.com',
          localId: 'fb_uid_1',
        }),
      });

      // 2) refresh token call
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id_token: 'id2_with_claims',
          refresh_token: 'ref2',
          user_id: 'fb_uid_1',
        }),
      });

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'db_u1',
        email: 'a@b.com',
        firebaseUid: null,
        tokenVersion: 0,
      });

      prismaMock.user.update
        // link firebaseUid
        .mockResolvedValueOnce({ id: 'db_u1', firebaseUid: 'fb_uid_1' })
        // increment tokenVersion
        .mockResolvedValueOnce({
          id: 'db_u1',
          email: 'a@b.com',
          firebaseUid: 'fb_uid_1',
          tokenVersion: 1,
        });

      const res = await service.login({ email: 'a@b.com', password: 'pw' } as any);

      expect(prismaMock.user.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'db_u1' },
        data: { firebaseUid: 'fb_uid_1' },
      });

      expect(prismaMock.user.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'db_u1' },
        data: { tokenVersion: { increment: 1 } },
      });

      expect(firebaseAuthMock.setCustomUserClaims).toHaveBeenCalledWith('fb_uid_1', { tv: 1 });

      expect(res).toEqual({
        accessToken: 'id2_with_claims',
        user: {
          id: 'db_u1',
          email: 'a@b.com',
          firebaseUid: 'fb_uid_1',
          tokenVersion: 1,
        },
      });
    });

    it('throws if firebaseUid mismatch', async () => {
      // signIn ok
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          idToken: 'id1',
          refreshToken: 'ref1',
          email: 'a@b.com',
          localId: 'fb_uid_NEW',
        }),
      });

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'db_u1',
        email: 'a@b.com',
        firebaseUid: 'fb_uid_OLD',
        tokenVersion: 0,
      });

      await expect(
        service.login({ email: 'a@b.com', password: 'pw' } as any),
      ).rejects.toThrow('Firebase UID mismatch for this user');

      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(firebaseAuthMock.setCustomUserClaims).not.toHaveBeenCalled();
    });
  });

  // --------------------
  // findAll()
  // --------------------
  describe('findAll()', () => {
    it('returns users from prisma.user.findMany', async () => {
      prismaMock.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
      const res = await service.findAll();

      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(res).toEqual([{ id: 'u1' }, { id: 'u2' }]);
    });
  });

  // --------------------
  // disableAccount()
  // --------------------
  describe('disableAccount()', () => {
    it('disables Firebase user and marks DB inactive', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        firebaseUid: 'fb_uid_1',
      });
      prismaMock.user.update.mockResolvedValue({ id: 'u1', isActive: false });
      firebaseAuthMock.updateUser.mockResolvedValue({});

      const res = await service.disableAccount('u1');

      expect(firebaseAuthMock.updateUser).toHaveBeenCalledWith('fb_uid_1', { disabled: true });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { isActive: false },
      });
      expect(res).toEqual({ id: 'u1', isActive: false });
    });

    it('throws if user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.disableAccount('u1')).rejects.toThrow(
        new UnauthorizedException('User not found'),
      );
      expect(firebaseAuthMock.updateUser).not.toHaveBeenCalled();
    });
  });

  // --------------------
  // deleteAccountHard()
  // --------------------
  describe('deleteAccountHard()', () => {
    it('anonymizes DB user and deletes Firebase user', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        userName: 'user1',
        mobileNumber: '999',
        firebaseUid: 'fb_uid_1',
      });
      prismaMock.user.update.mockResolvedValue({ id: 'u1', isActive: false });
      firebaseAuthMock.deleteUser.mockResolvedValue({});
      const res = await service.deleteAccountHard('u1', 'admin-key');

      expect(prismaMock.user.update).toHaveBeenCalled();
      expect(firebaseAuthMock.deleteUser).toHaveBeenCalledWith('fb_uid_1');
      expect(res).toEqual({ id: 'u1', isActive: false });
    });

    it('throws for unknown user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteAccountHard('u1', 'admin-key')).rejects.toThrow(
        new BadRequestException('User not found'),
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(firebaseAuthMock.deleteUser).not.toHaveBeenCalled();
    });
  });
});
