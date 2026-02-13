import { Test } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AccountActivationController } from './account-activation.controller';
import { UsersService } from './users.service';

describe('AccountActivationController (unit)', () => {
  let controller: AccountActivationController;

  const usersServiceMock = {
    enableAccountWithToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [AccountActivationController],
      providers: [{ provide: UsersService, useValue: usersServiceMock }],
    }).compile();

    controller = moduleRef.get(AccountActivationController);
  });

  it('throws BadRequestException when token is missing', async () => {
    await expect(controller.activateAccount(undefined)).rejects.toThrow(
      new BadRequestException('Missing activation token'),
    );
    expect(usersServiceMock.enableAccountWithToken).not.toHaveBeenCalled();
  });

  it('activates account and returns success payload', async () => {
    usersServiceMock.enableAccountWithToken.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
    });

    const res = await controller.activateAccount('valid-token');

    expect(usersServiceMock.enableAccountWithToken).toHaveBeenCalledTimes(1);
    expect(usersServiceMock.enableAccountWithToken).toHaveBeenCalledWith(
      'valid-token',
    );
    expect(res).toEqual({
      success: true,
      message: 'Account activated successfully. Please login again.',
      userId: 'u1',
      email: 'user@example.com',
    });
  });

  it('propagates service errors for invalid/expired token', async () => {
    usersServiceMock.enableAccountWithToken.mockRejectedValue(
      new UnauthorizedException('Invalid or expired activation token'),
    );

    await expect(controller.activateAccount('bad-token')).rejects.toThrow(
      new UnauthorizedException('Invalid or expired activation token'),
    );
  });
});
