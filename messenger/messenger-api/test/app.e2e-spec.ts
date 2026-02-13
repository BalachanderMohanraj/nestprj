import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { AppModule } from '../src/app.module';

const requiredEnv = [
  'DATABASE_URL',
  'FIREBASE_SERVICE_ACCOUNT_PATH',
  'FIREBASE_PROJECT_ID',
  'APIKEY',
];
const hasRequiredEnv = requiredEnv.every((key) => !!process.env[key]);
const describeIfReady = hasRequiredEnv ? describe : describe.skip;
// console.log(requiredEnv);

describeIfReady('App Real Flow (e2e)', () => {
  let app: INestApplication;

  const gql = async (
    query: string,
    variables: Record<string, unknown> = {},
    accessToken?: string,
  ): Promise<Response> => {
    const req = request(app.getHttpServer()).post('/graphql');
    if (accessToken) {
      req.set('Authorization', `Bearer ${accessToken}`);
    }
    return req.send({ query, variables }).expect(200);
  };

  const ensureNoGraphqlErrors = (res: Response) => {
    if (res.body?.errors?.length) {
      throw new Error(JSON.stringify(res.body.errors, null, 2));
    }
  };

  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userA = {
    email: `e2e.a.${unique}@example.com`,
    userName: `e2e_user_a_${unique}`,
    mobileNumber: `91${Math.floor(10000000 + Math.random() * 89999999)}`,
    firstName: 'E2E',
    lastName: 'UserA',
  };
  const userB = {
    email: `e2e.b.${unique}@example.com`,
    userName: `e2e_user_b_${unique}`,
    mobileNumber: `92${Math.floor(10000000 + Math.random() * 89999999)}`,
    firstName: 'E2E',
    lastName: 'UserB',
  };

  const passwords = {
    initial: 'E2ePass@123',
    updated: 'E2ePass@456',
  };

  beforeAll(async () => {
    jest.setTimeout(180_000);
    if (!process.env.ADMIN_API_KEY) {
      process.env.ADMIN_API_KEY = 'e2e-admin-key';
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs full account + chat + recovery flow with real services', async () => {
    const registerMutation = `
      mutation Register($data: RegisterInput!) {
        register(data: $data) { id email userName firstName lastName mobileNumber }
      }
    `;
    // console.log(registerMutation);
    
    const loginMutation = `
      mutation Login($data: LoginInput!) {
        login(data: $data) { accessToken user { id email } }
      }
    `;
    // console.log(loginMutation);
    
    // 1) Register two users
    const registerA = await gql(registerMutation, {
      data: {
        ...userA,
        password: passwords.initial,
        confirmPassword: passwords.initial,
      },
    });
    ensureNoGraphqlErrors(registerA);
    const userAId = registerA.body.data.register.id as string;

    const registerB = await gql(registerMutation, {
      data: {
        ...userB,
        password: passwords.initial,
        confirmPassword: passwords.initial,
      },
    });
    ensureNoGraphqlErrors(registerB);
    const userBId = registerB.body.data.register.id as string;

    // 2) Login user A
    const loginA1 = await gql(loginMutation, {
      data: { email: userA.email, password: passwords.initial },
    });
    ensureNoGraphqlErrors(loginA1);
    const tokenA1 = loginA1.body.data.login.accessToken as string;

    // 3) Protected query works
    const usersQ = await gql(`query { users { id email } }`, {}, tokenA1);
    ensureNoGraphqlErrors(usersQ);

    // 4) Update profile
    const updateProfile = await gql(
      `
      mutation UpdateProfile($data: UpdateUserInput!) {
        updateProfile(data: $data) { id firstName lastName mobileNumber }
      }
      `,
      {
        data: {
          firstName: 'Updated',
          lastName: 'Name',
          mobileNumber: `93${Math.floor(10000000 + Math.random() * 89999999)}`,
        },
      },
      tokenA1,
    );
    ensureNoGraphqlErrors(updateProfile);

    // 5) Update password
    const updatePassword = await gql(
      `
      mutation UpdatePassword($data: UpdatePasswordInput!) {
        updatePassword(data: $data) { id email }
      }
      `,
      {
        data: {
          currentPassword: passwords.initial,
          newPassword: passwords.updated,
        },
      },
      tokenA1,
    );
    ensureNoGraphqlErrors(updatePassword);

    // 6) Old password login should fail
    const loginOld = await gql(loginMutation, {
      data: { email: userA.email, password: passwords.initial },
    });
    expect(loginOld.body.errors?.length).toBeGreaterThan(0);

    // 7) New password login works
    const loginA2 = await gql(loginMutation, {
      data: { email: userA.email, password: passwords.updated },
    });
    ensureNoGraphqlErrors(loginA2);
    const tokenA2 = loginA2.body.data.login.accessToken as string;

    // 8) Chat flow: start conversation + send message + list
    const startConversation = await gql(
      `
      mutation StartConversation($recipientId: String!) {
        startConversation(recipientId: $recipientId) { id }
      }
      `,
      { recipientId: userBId },
      tokenA2,
    );
    ensureNoGraphqlErrors(startConversation);
    const conversationId = startConversation.body.data.startConversation.id as string;

    const sendMessage = await gql(
      `
      mutation SendMessage($conversationId: String!, $content: String!) {
        sendMessage(conversationId: $conversationId, content: $content) {
          id
          conversationId
          content
        }
      }
      `,
      { conversationId, content: 'hello from e2e' },
      tokenA2,
    );
    ensureNoGraphqlErrors(sendMessage);

    const myConversations = await gql(
      `query { myConversations { id } }`,
      {},
      tokenA2,
    );
    ensureNoGraphqlErrors(myConversations);

    // 9) Forgot password link generation
    const forgot = await gql(
      `
      mutation ForgotPassword($email: String!, $useOobCode: Boolean) {
        forgotPassword(email: $email, useOobCode: $useOobCode)
      }
      `,
      { email: userA.email, useOobCode: false },
    );
    ensureNoGraphqlErrors(forgot);
    expect(typeof forgot.body.data.forgotPassword).toBe('string');

    // 10) Logout invalidates current token
    const logout = await gql(`mutation { logout }`, {}, tokenA2);
    ensureNoGraphqlErrors(logout);
    expect(logout.body.data.logout).toBe(true);

    const usersAfterLogout = await gql(`query { users { id } }`, {}, tokenA2);
    expect(usersAfterLogout.body.errors?.length).toBeGreaterThan(0);

    // 11) Login again
    const loginA3 = await gql(loginMutation, {
      data: { email: userA.email, password: passwords.updated },
    });
    ensureNoGraphqlErrors(loginA3);
    const tokenA3 = loginA3.body.data.login.accessToken as string;

    // 12) Disable account -> login fails
    const disable = await gql(`mutation { disableAccount { id } }`, {}, tokenA3);
    ensureNoGraphqlErrors(disable);
    expect(disable.body.data.disableAccount.id).toBe(userAId);

    const loginAfterDisable = await gql(loginMutation, {
      data: { email: userA.email, password: passwords.updated },
    });
    expect(loginAfterDisable.body.errors?.length).toBeGreaterThan(0);

    // 13) Request account enable + click link via backend endpoint
    const reqEnable = await gql(
      `
      mutation RequestEnable($email: String!) {
        requestEnableAccount(email: $email)
      }
      `,
      { email: userA.email },
    );
    ensureNoGraphqlErrors(reqEnable);
    const msg = String(reqEnable.body.data.requestEnableAccount);
    expect(msg).toContain('If the account exists');
    expect(msg).toContain('DEV_LINK:');

    const token = decodeURIComponent(msg.split('token=')[1]);
    const activate = await request(app.getHttpServer())
      .get(`/api/activate-account?token=${encodeURIComponent(token)}`)
      .expect(200);
    expect(activate.body.success).toBe(true);

    // 13b) replay with same token must fail (one-time use)
    await request(app.getHttpServer())
      .get(`/api/activate-account?token=${encodeURIComponent(token)}`)
      .expect(401);

    // 14) Login works again
    const loginA4 = await gql(loginMutation, {
      data: { email: userA.email, password: passwords.updated },
    });
    ensureNoGraphqlErrors(loginA4);
    const tokenA4 = loginA4.body.data.login.accessToken as string;

    // 15) Admin sync mutation (expect noop for existing linked user)
    const sync = await gql(
      `
      mutation Sync($uidOrEmail: String!, $adminKey: String!) {
        syncUser(uidOrEmail: $uidOrEmail, adminKey: $adminKey) {
          status
          action
        }
      }
      `,
      {
        uidOrEmail: userA.email,
        adminKey: process.env.ADMIN_API_KEY,
      },
      tokenA4,
    );
    ensureNoGraphqlErrors(sync);
    expect(sync.body.data.syncUser.status).toBe('ok');
  },60000);
});

if (!hasRequiredEnv) {
  describe('App Real Flow (e2e) skipped', () => {
    it('requires env for real DB/Firebase', () => {
      expect(requiredEnv.filter((k) => !process.env[k]).length).toBeGreaterThan(0);
    });
  });
}
