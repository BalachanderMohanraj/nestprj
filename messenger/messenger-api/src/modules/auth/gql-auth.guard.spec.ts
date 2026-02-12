import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GqlAuthGuard } from './gql-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

describe('GqlAuthGuard (unit)', () => {
  let guard: GqlAuthGuard;
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;
  const firebaseAuthMock = {
    verifyIdToken: jest.fn(),
  };
  const firebaseMock = {
    auth: () => firebaseAuthMock,
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new GqlAuthGuard(prismaMock, firebaseMock);
  });

  it('throws when bearer token is missing', async () => {
    const req = { headers: {} };
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({ req }),
    } as any);

    await expect(guard.canActivate({} as ExecutionContext)).rejects.toThrow(
      new UnauthorizedException('Missing Bearer token'),
    );
  });

  it('throws when tokenVersion claim does not match DB tokenVersion', async () => {
    const req = { headers: { authorization: 'Bearer token123' } };
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({ req }),
    } as any);
    firebaseAuthMock.verifyIdToken.mockResolvedValue({
      uid: 'fb_uid_1',
      tv: 1,
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      firebaseUid: 'fb_uid_1',
      isActive: true,
      tokenVersion: 2,
    });

    await expect(guard.canActivate({} as ExecutionContext)).rejects.toThrow(
      new UnauthorizedException('Invalid/expired Firebase token'),
    );
  });

  it('throws when Firebase token verification fails', async () => {
    const req = { headers: { authorization: 'Bearer bad-token' } };
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({ req }),
    } as any);
    firebaseAuthMock.verifyIdToken.mockRejectedValue(new Error('invalid token'));

    await expect(guard.canActivate({} as ExecutionContext)).rejects.toThrow(
      new UnauthorizedException('Invalid/expired Firebase token'),
    );
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('throws when user is inactive', async () => {
    const req = { headers: { authorization: 'Bearer token123' } };
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({ req }),
    } as any);
    firebaseAuthMock.verifyIdToken.mockResolvedValue({
      uid: 'fb_uid_1',
      tv: 1,
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      firebaseUid: 'fb_uid_1',
      isActive: false,
      tokenVersion: 1,
    });

    await expect(guard.canActivate({} as ExecutionContext)).rejects.toThrow(
      new UnauthorizedException('Invalid/expired Firebase token'),
    );
  });

  it('attaches user and returns true for valid token + matching tokenVersion', async () => {
    const req = { headers: { authorization: 'Bearer token123' } as any, user: undefined };
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({ req }),
    } as any);
    firebaseAuthMock.verifyIdToken.mockResolvedValue({
      uid: 'fb_uid_1',
      tv: 2,
    });
    const dbUser = {
      id: 'u1',
      firebaseUid: 'fb_uid_1',
      isActive: true,
      tokenVersion: 2,
    };
    prismaMock.user.findUnique.mockResolvedValue(dbUser);

    const result = await guard.canActivate({} as ExecutionContext);

    expect(firebaseAuthMock.verifyIdToken).toHaveBeenCalledWith('token123', true);
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { firebaseUid: 'fb_uid_1' },
    });
    expect(req.user).toEqual(dbUser);
    expect(result).toBe(true);
  });
});
