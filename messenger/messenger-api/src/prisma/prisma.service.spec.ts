import { PrismaService } from './prisma.service';

const connectMock = jest.fn();
const disconnectMock = jest.fn();
const prismaClientCtorMock = jest.fn();
const poolEndMock = jest.fn();
const poolCtorMock = jest.fn();
const prismaPgCtorMock = jest.fn();

jest.mock('@prisma/client', () => {
  class PrismaClient {
    $connect = connectMock;
    $disconnect = disconnectMock;

    constructor(args?: unknown) {
      prismaClientCtorMock(args);
    }
  }

  return { PrismaClient };
});

jest.mock('@prisma/adapter-pg', () => {
  class PrismaPg {
    constructor(pool: unknown) {
      prismaPgCtorMock(pool);
    }
  }

  return { PrismaPg };
});

jest.mock('pg', () => {
  class Pool {
    end = poolEndMock;

    constructor(config?: unknown) {
      poolCtorMock(config);
    }
  }

  return {
    __esModule: true,
    default: { Pool },
    Pool,
  };
});

describe('PrismaService (unit)', () => {
  let service: PrismaService;
  const oldDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATABASE_URL = 'postgresql://unit-test-db';
    service = new PrismaService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize PrismaClient with PrismaPg adapter backed by pg pool', () => {
    expect(poolCtorMock).toHaveBeenCalledWith({
      connectionString: 'postgresql://unit-test-db',
    });
    expect(prismaPgCtorMock).toHaveBeenCalledTimes(1);
    expect(prismaClientCtorMock).toHaveBeenCalledWith({
      adapter: expect.any(Object),
    });
  });

  it('onModuleInit should call $connect', async () => {
    await service.onModuleInit();
    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy should call $disconnect and close pg pool', async () => {
    await service.onModuleDestroy();

    expect(disconnectMock).toHaveBeenCalledTimes(1);
    expect(poolEndMock).toHaveBeenCalledTimes(1);
    expect(disconnectMock.mock.invocationCallOrder[0]).toBeLessThan(
      poolEndMock.mock.invocationCallOrder[0],
    );
  });

  afterAll(() => {
    process.env.DATABASE_URL = oldDatabaseUrl;
  });
});
