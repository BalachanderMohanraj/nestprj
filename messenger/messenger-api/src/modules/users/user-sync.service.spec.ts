import { Test } from '@nestjs/testing';
import { UserSyncService } from './user-sync.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FIREBASE_ADMIN } from '../auth/firebase/firebase-admin.provider';

describe('UserSyncService (unit)', () => {
  let service: UserSyncService;

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

    const moduleRef = await Test.createTestingModule({
      providers: [
        UserSyncService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: FIREBASE_ADMIN, useValue: firebaseMock },
      ],
    }).compile();

    service = moduleRef.get(UserSyncService);
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
  });
});
