import { Test } from '@nestjs/testing';
import { UserSyncService } from './user-sync.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FIREBASE_ADMIN } from '../auth/firebase/firebase-admin.provider';

describe('UserSyncService (unit)', () => {
  let service: UserSyncService;
  const LAST_RUN_KEY = 'USER_SYNC_LAST_RUN';

  const prismaMock = {
    user: {
      findMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const firebaseAuthMock = {
    getUser: jest.fn(),
    listUsers: jest.fn(),
    updateUser: jest.fn(),
  };

  const firebaseMock = {
    auth: () => firebaseAuthMock,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    delete (globalThis as any)[LAST_RUN_KEY];
    process.env.NODE_ENV = 'test';
    process.env.USER_SYNC_INTERVAL_MINUTES = '10';

    const moduleRef = await Test.createTestingModule({
      providers: [
        UserSyncService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: FIREBASE_ADMIN, useValue: firebaseMock },
      ],
    }).compile();

    service = moduleRef.get(UserSyncService);
  });

  afterEach(() => {
    delete (globalThis as any)[LAST_RUN_KEY];
  });

  describe('scheduledSync()', () => {
    it('skips sync in production', async () => {
      process.env.NODE_ENV = 'production';
      const dbSpy = jest.spyOn(service, 'reconcileDbToFirebase');
      const fbSpy = jest.spyOn(service, 'reconcileFirebaseToDb');

      await service.scheduledSync();

      expect(dbSpy).not.toHaveBeenCalled();
      expect(fbSpy).not.toHaveBeenCalled();
    });

    it('runs both reconciliations when interval elapsed', async () => {
      const dbSpy = jest
        .spyOn(service, 'reconcileDbToFirebase')
        .mockResolvedValue(undefined);
      const fbSpy = jest
        .spyOn(service, 'reconcileFirebaseToDb')
        .mockResolvedValue(undefined);

      await service.scheduledSync();

      expect(dbSpy).toHaveBeenCalledTimes(1);
      expect(fbSpy).toHaveBeenCalledTimes(1);
      expect(typeof (globalThis as any)[LAST_RUN_KEY]).toBe('number');
    });

    it('does not run again before interval window', async () => {
      const dbSpy = jest
        .spyOn(service, 'reconcileDbToFirebase')
        .mockResolvedValue(undefined);
      const fbSpy = jest
        .spyOn(service, 'reconcileFirebaseToDb')
        .mockResolvedValue(undefined);

      await service.scheduledSync();
      await service.scheduledSync();

      expect(dbSpy).toHaveBeenCalledTimes(1);
      expect(fbSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('reconcileDbToFirebase()', () => {
    it('marks DB user inactive when firebase user missing', async () => {
      prismaMock.user.findMany.mockResolvedValue([
        { id: 'u1', firebaseUid: 'fb_uid_1' },
      ]);
      const err: any = new Error('missing');
      err.code = 'auth/user-not-found';
      firebaseAuthMock.getUser.mockRejectedValue(err);
      prismaMock.user.update.mockResolvedValue({ id: 'u1', isActive: false });

      await service.reconcileDbToFirebase();

      expect(firebaseAuthMock.getUser).toHaveBeenCalledWith('fb_uid_1');
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { isActive: false, tokenVersion: { increment: 1 } },
      });
    });

    it('does not update DB when firebase user exists', async () => {
      prismaMock.user.findMany.mockResolvedValue([
        { id: 'u1', firebaseUid: 'fb_uid_1' },
      ]);
      firebaseAuthMock.getUser.mockResolvedValue({ uid: 'fb_uid_1' });

      await service.reconcileDbToFirebase();

      expect(firebaseAuthMock.getUser).toHaveBeenCalledWith('fb_uid_1');
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('does not mark DB inactive for non not-found Firebase errors', async () => {
      prismaMock.user.findMany.mockResolvedValue([
        { id: 'u1', firebaseUid: 'fb_uid_1' },
      ]);
      const err: any = new Error('firebase unavailable');
      err.code = 'auth/internal-error';
      firebaseAuthMock.getUser.mockRejectedValue(err);

      await service.reconcileDbToFirebase();

      expect(firebaseAuthMock.getUser).toHaveBeenCalledWith('fb_uid_1');
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });
  });

  describe('reconcileFirebaseToDb()', () => {
    it('disables firebase users missing in DB', async () => {
      firebaseAuthMock.listUsers.mockResolvedValue({
        users: [{ uid: 'fb_uid_1' }],
        pageToken: undefined,
      });
      prismaMock.user.findUnique.mockResolvedValue(null);

      await service.reconcileFirebaseToDb();

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { firebaseUid: 'fb_uid_1' },
        select: { id: true },
      });
      expect(firebaseAuthMock.updateUser).toHaveBeenCalledWith('fb_uid_1', {
        disabled: true,
      });
    });

    it('does not disable firebase user when DB user exists', async () => {
      firebaseAuthMock.listUsers.mockResolvedValue({
        users: [{ uid: 'fb_uid_1' }],
        pageToken: undefined,
      });
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });

      await service.reconcileFirebaseToDb();

      expect(firebaseAuthMock.updateUser).not.toHaveBeenCalled();
    });

    it('handles pagination and processes all pages', async () => {
      firebaseAuthMock.listUsers
        .mockResolvedValueOnce({
          users: [{ uid: 'fb_uid_1' }],
          pageToken: 'next-page',
        })
        .mockResolvedValueOnce({
          users: [{ uid: 'fb_uid_2' }],
          pageToken: undefined,
        });
      prismaMock.user.findUnique.mockResolvedValue(null);

      await service.reconcileFirebaseToDb();

      expect(firebaseAuthMock.listUsers).toHaveBeenNthCalledWith(1, 1000, undefined);
      expect(firebaseAuthMock.listUsers).toHaveBeenNthCalledWith(2, 1000, 'next-page');
      expect(firebaseAuthMock.updateUser).toHaveBeenCalledTimes(2);
      expect(firebaseAuthMock.updateUser).toHaveBeenNthCalledWith(1, 'fb_uid_1', {
        disabled: true,
      });
      expect(firebaseAuthMock.updateUser).toHaveBeenNthCalledWith(2, 'fb_uid_2', {
        disabled: true,
      });
    });
  });
});
