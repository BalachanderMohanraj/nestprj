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
    enableAccountToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((ops: Promise<any>[]) => Promise.all(ops)),
  };

  // firebase-admin mock (only what you use)
  const firebaseAuthMock = {
    createUser: jest.fn(),
    getUserByEmail: jest.fn(),
    getUser: jest.fn(),
    deleteUser: jest.fn(),
    setCustomUserClaims: jest.fn(),
    updateUser: jest.fn(),
    generatePasswordResetLink: jest.fn(),
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
    process.env.ENABLE_ACCOUNT_TOKEN_SECRET = 'enable-secret';

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
      prismaMock.user.update.mockResolvedValue({
        id: 'u1',
        isActive: false,
        tokenVersion: 2,
      });
      firebaseAuthMock.updateUser.mockResolvedValue({});

      const res = await service.disableAccount('u1');

      expect(firebaseAuthMock.updateUser).toHaveBeenCalledWith('fb_uid_1', { disabled: true });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { isActive: false, tokenVersion: { increment: 1 } },
      });
      expect(firebaseAuthMock.setCustomUserClaims).toHaveBeenCalledWith('fb_uid_1', { tv: 2 });
      expect(res).toEqual({ id: 'u1', isActive: false, tokenVersion: 2 });
    });

    it('throws if user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.disableAccount('u1')).rejects.toThrow(
        new UnauthorizedException('User not found'),
      );
      expect(firebaseAuthMock.updateUser).not.toHaveBeenCalled();
    });

    it('rolls back Firebase disable if DB update fails', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        firebaseUid: 'fb_uid_1',
      });
      firebaseAuthMock.updateUser.mockResolvedValue({});
      prismaMock.user.update.mockRejectedValue(new Error('DB fail'));

      await expect(service.disableAccount('u1')).rejects.toThrow('DB fail');

      expect(firebaseAuthMock.updateUser).toHaveBeenNthCalledWith(1, 'fb_uid_1', {
        disabled: true,
      });
      expect(firebaseAuthMock.updateUser).toHaveBeenNthCalledWith(2, 'fb_uid_1', {
        disabled: false,
      });
    });
  });

  // --------------------
  // logout()
  // --------------------
  describe('logout()', () => {
    it('increments tokenVersion and updates Firebase custom claim', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        firebaseUid: 'fb_uid_1',
      });
      prismaMock.user.update.mockResolvedValue({
        id: 'u1',
        tokenVersion: 3,
      });

      const res = await service.logout('u1');

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { tokenVersion: { increment: 1 } },
      });
      expect(firebaseAuthMock.setCustomUserClaims).toHaveBeenCalledWith('fb_uid_1', { tv: 3 });
      expect(res).toBe(true);
    });

    it('throws if user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.logout('u1')).rejects.toThrow(
        new UnauthorizedException('User not found'),
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(firebaseAuthMock.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it('throws if Firebase user is not linked', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        firebaseUid: null,
      });

      await expect(service.logout('u1')).rejects.toThrow(
        new BadRequestException('Firebase user not linked'),
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(firebaseAuthMock.setCustomUserClaims).not.toHaveBeenCalled();
    });
  });

  // --------------------
  // updateProfile()
  // --------------------
  describe('updateProfile()', () => {
    it('throws if no profile fields provided', async () => {
      await expect(service.updateProfile('u1', {} as any)).rejects.toThrow(
        new BadRequestException('No profile fields provided'),
      );
      expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('throws if mobile number already in use by another user', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'other' });

      await expect(
        service.updateProfile('u1', { mobileNumber: '9999999999' } as any),
      ).rejects.toThrow(new BadRequestException('Mobile number already in use'));

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: { mobileNumber: '9999999999', NOT: { id: 'u1' } },
      });
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('updates provided profile fields', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);
      prismaMock.user.update.mockResolvedValue({
        id: 'u1',
        firstName: 'A',
        lastName: 'B',
        mobileNumber: '9999999999',
      });

      const res = await service.updateProfile('u1', {
        firstName: 'A',
        lastName: 'B',
        mobileNumber: '9999999999',
      } as any);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: {
          mobileNumber: '9999999999',
          firstName: 'A',
          lastName: 'B',
        },
      });
      expect(res).toEqual({
        id: 'u1',
        firstName: 'A',
        lastName: 'B',
        mobileNumber: '9999999999',
      });
    });
  });

  // --------------------
  // updatePassword()
  // --------------------
  describe('updatePassword()', () => {
    it('throws if DB user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePassword('u1', {
          currentPassword: 'old',
          newPassword: 'new',
        } as any),
      ).rejects.toThrow(new UnauthorizedException('User not found'));
    });

    it('updates Firebase password and DB password placeholder', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        firebaseUid: 'fb_uid_1',
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          idToken: 'id1',
          refreshToken: 'ref1',
          email: 'a@b.com',
          localId: 'fb_uid_1',
        }),
      });
      firebaseAuthMock.updateUser.mockResolvedValue({});
      prismaMock.user.update.mockResolvedValue({ id: 'u1', password: null });

      const res = await service.updatePassword('u1', {
        currentPassword: 'old',
        newPassword: 'new',
      } as any);

      expect(firebaseAuthMock.updateUser).toHaveBeenCalledWith('fb_uid_1', {
        password: 'new',
      });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { password: null },
      });
      expect(res).toEqual({ id: 'u1', password: null });
    });

    it('rolls back Firebase password if DB update fails', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        firebaseUid: 'fb_uid_1',
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          idToken: 'id1',
          refreshToken: 'ref1',
          email: 'a@b.com',
          localId: 'fb_uid_1',
        }),
      });
      firebaseAuthMock.updateUser.mockResolvedValue({});
      prismaMock.user.update.mockRejectedValue(new Error('DB fail'));

      await expect(
        service.updatePassword('u1', {
          currentPassword: 'old',
          newPassword: 'new',
        } as any),
      ).rejects.toThrow('DB fail');

      expect(firebaseAuthMock.updateUser).toHaveBeenNthCalledWith(1, 'fb_uid_1', {
        password: 'new',
      });
      expect(firebaseAuthMock.updateUser).toHaveBeenNthCalledWith(2, 'fb_uid_1', {
        password: 'old',
      });
    });
  });

  // --------------------
  // forgotPassword()
  // --------------------
  describe('forgotPassword()', () => {
    it('throws when user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.forgotPassword('a@b.com')).rejects.toThrow(
        new BadRequestException('User not found'),
      );
      expect(firebaseAuthMock.generatePasswordResetLink).not.toHaveBeenCalled();
    });

    it('throws when user is inactive', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        isActive: false,
      });

      await expect(service.forgotPassword('a@b.com')).rejects.toThrow(
        new BadRequestException('User not found'),
      );
      expect(firebaseAuthMock.generatePasswordResetLink).not.toHaveBeenCalled();
    });

    it('returns reset link without oob call by default', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        isActive: true,
      });
      firebaseAuthMock.generatePasswordResetLink.mockResolvedValue(
        'https://reset-link',
      );

      const res = await service.forgotPassword('a@b.com');

      expect(firebaseAuthMock.generatePasswordResetLink).toHaveBeenCalledWith(
        'a@b.com',
      );
      expect(global.fetch).not.toHaveBeenCalled();
      expect(res).toBe('https://reset-link');
    });

    it('calls Firebase sendOobCode when useOobCode=true', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        isActive: true,
      });
      firebaseAuthMock.generatePasswordResetLink.mockResolvedValue(
        'https://reset-link',
      );
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const res = await service.forgotPassword('a@b.com', true);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(res).toBe('https://reset-link');
    });
  });

  // --------------------
  // syncUser()
  // --------------------
  describe('syncUser()', () => {
    it('rejects when admin key is invalid', async () => {
      await expect(service.syncUser('uid-or-email', 'wrong-key')).rejects.toThrow(
        new UnauthorizedException('Admin access required'),
      );
    });

    it('returns noop when Firebase exists and DB user already linked', async () => {
      firebaseAuthMock.getUser.mockResolvedValue({
        uid: 'fb_uid_1',
        email: 'a@b.com',
      });
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });

      const res = await service.syncUser('fb_uid_1', 'admin-key');

      expect(res).toEqual({
        status: 'ok',
        action: 'noop',
        message: 'DB user already linked to Firebase user',
        dbUserId: 'u1',
        firebaseUid: 'fb_uid_1',
      });
    });

    it('creates DB shadow user when Firebase exists but DB is missing', async () => {
      firebaseAuthMock.getUser.mockResolvedValue({
        uid: 'fb_uid_1',
        email: 'a@b.com',
        displayName: 'Test User',
      });
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({
        id: 'shadow_u1',
        firebaseUid: 'fb_uid_1',
      });

      const res = await service.syncUser('fb_uid_1', 'admin-key');

      expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
      expect(res).toEqual({
        status: 'ok',
        action: 'created_db_shadow',
        dbUserId: 'shadow_u1',
        firebaseUid: 'fb_uid_1',
      });
    });

    it('marks DB user inactive when Firebase user is missing but DB user exists', async () => {
      const notFoundError: any = new Error('not found');
      notFoundError.code = 'auth/user-not-found';
      firebaseAuthMock.getUser.mockRejectedValue(notFoundError);
      prismaMock.user.findFirst.mockResolvedValue({
        id: 'u1',
        firebaseUid: 'fb_uid_1',
      });
      prismaMock.user.update.mockResolvedValue({
        id: 'u1',
        firebaseUid: 'fb_uid_1',
      });

      const res = await service.syncUser('fb_uid_1', 'admin-key');

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { isActive: false, tokenVersion: { increment: 1 } },
      });
      expect(res).toEqual({
        status: 'ok',
        action: 'marked_db_inactive',
        dbUserId: 'u1',
        firebaseUid: 'fb_uid_1',
      });
    });
  });

  // --------------------
  // requestEnableAccount() + enableAccountWithToken()
  // --------------------
  describe('account activation', () => {
    it('requestEnableAccount returns generic message for unknown user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const res = await service.requestEnableAccount('missing@x.com');

      expect(res).toBe(
        'If the account exists, an account activation link was sent',
      );
      expect(prismaMock.enableAccountToken.create).not.toHaveBeenCalled();
    });

    it('requestEnableAccount creates one-time token and returns dev link for inactive user', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        isActive: false,
        firebaseUid: 'fb_uid_1',
      });
      prismaMock.enableAccountToken.create.mockResolvedValue({
        jti: 'j1',
      });

      const res = await service.requestEnableAccount('a@b.com');

      expect(prismaMock.enableAccountToken.create).toHaveBeenCalledTimes(1);
      expect(res).toContain(
        'If the account exists, an account activation link was sent',
      );
      expect(res).toContain('/activate-account?token=');
    });

    it('enableAccountWithToken enables Firebase and DB and consumes token', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        isActive: false,
        firebaseUid: 'fb_uid_1',
      });
      prismaMock.user.update.mockResolvedValue({
        id: 'u1',
        isActive: true,
        tokenVersion: 5,
      });
      prismaMock.enableAccountToken.update.mockResolvedValue({
        jti: 'token-jti',
      });
      prismaMock.$transaction.mockImplementationOnce((ops: Promise<any>[]) =>
        Promise.all(ops),
      );

      const tokenWithKnownJti =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkVBVCJ9.eyJzdWIiOiJ1MSIsInVpZCI6ImZiX3VpZF8xIiwiZW1haWwiOiJhQGIuY29tIiwianRpIjoidG9rZW4tanRpIiwiZXhwIjo0MTAyNDQ0ODAwfQ.unszcYDkrIATwmGekrn8aysgTdqZdixw0n9ahCBsYV4';
      prismaMock.enableAccountToken.findUnique.mockResolvedValue({
        jti: 'token-jti',
        userId: 'u1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 5 * 60_000),
      });
      firebaseAuthMock.getUser.mockResolvedValue({ uid: 'fb_uid_1' });
      firebaseAuthMock.updateUser.mockResolvedValue({});

      const res = await service.enableAccountWithToken(tokenWithKnownJti);

      expect(firebaseAuthMock.updateUser).toHaveBeenCalledWith('fb_uid_1', {
        disabled: false,
      });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { isActive: true, tokenVersion: { increment: 1 } },
      });
      expect(prismaMock.enableAccountToken.update).toHaveBeenCalledWith({
        where: { jti: 'token-jti' },
        data: { usedAt: expect.any(Date) },
      });
      expect(firebaseAuthMock.setCustomUserClaims).toHaveBeenCalledWith(
        'fb_uid_1',
        { tv: 5 },
      );
      expect(res).toEqual({ id: 'u1', isActive: true, tokenVersion: 5 });
    });
  });

});
