import { Test } from '@nestjs/testing';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';

describe('UsersResolver (unit)', () => {
  let resolver: UsersResolver;
  const usersServiceMock = {
    findAll: jest.fn(),
    register: jest.fn(),
    login: jest.fn(),
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersResolver,
        { provide: UsersService, useValue: usersServiceMock },
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
});
