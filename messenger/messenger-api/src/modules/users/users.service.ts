import {  Injectable,  BadRequestException,  UnauthorizedException,  Inject,  InternalServerErrorException,} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterInput } from './dto/register.input';
import { UpdateUserInput } from './dto/update-user.input';
import { UpdatePasswordInput } from './dto/update-password.input';
import { SyncUserReport } from './dto/sync-user-report.model';
import { LoginInput } from '../auth/dto/login.input';
import { FIREBASE_ADMIN } from '../auth/firebase/firebase-admin.provider';
import type * as admin from 'firebase-admin';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

type FirebaseSignInResponse = {
  idToken: string;
  refreshToken: string;
  email: string;
  localId: string; // Firebase UID
};
type FirebaseRefreshResponse = {
  id_token: string;      // new Firebase ID token
  refresh_token: string; // new refresh token
  user_id: string;       // uid
};
 
@Injectable()
export class UsersService {
  private readonly enableAccountCooldownByEmail = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FIREBASE_ADMIN) private readonly firebase: typeof admin,
  ) {}
  async register(data: RegisterInput) {
    if (data.password !== data.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { userName: data.userName },
          { mobileNumber: data.mobileNumber },
        ],
      },
    });
    if (existing) {
      throw new BadRequestException(
        'User already exists with this email, username, or phone',
      );
    }
let fbUser: admin.auth.UserRecord;
  try {
    fbUser = await this.firebase.auth().createUser({
      email: data.email,
      password: data.password,
    });
  } catch (e: any) {
    if (e?.code === 'auth/email-already-exists') {
      fbUser = await this.firebase.auth().getUserByEmail(data.email);
    } else {
      throw new BadRequestException(e?.message ?? 'Failed to create Firebase user');
    }
  }
    const { confirmPassword, ...userData } = data;
    try {
    return await this.prisma.user.create({
      data: {
        ...userData,
        password: null,
        firebaseUid: fbUser.uid,    
      },
    });
  } catch (err) {
    try {
      await this.firebase.auth().deleteUser(fbUser.uid);
    } catch {
    }
    throw err;
  }
}
  async login(data: LoginInput) {
    const signIn = await this.firebaseSignInWithPassword(data.email, data.password);
    const user = await this.prisma.user.findUnique({
      where: { email: signIn.email },
    });
    if (!user) {
      throw new UnauthorizedException(
        'User not found in DB. Please register first.',
      );
    }
    if (user.isActive === false) {
      throw new UnauthorizedException('User is inactive or deleted');
    }
    // 3) Link firebaseUid (one-time) if missing OR validate it matches
    if (!user.firebaseUid) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { firebaseUid: signIn.localId },
      });
    } else if (user.firebaseUid !== signIn.localId) {
      throw new UnauthorizedException('Firebase UID mismatch for this user');
    }
    // 4) Increment tokenVersion in DB
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    });
    // 5) Set Firebase custom claim tv = tokenVersion
    await this.firebase.auth().setCustomUserClaims(signIn.localId, {
      tv: updatedUser.tokenVersion,
    });
    // 6) Refresh token so returned token includes the updated custom claim
    const refreshed = await this.firebaseRefreshIdToken(signIn.refreshToken);
    // 7) Return Firebase ID token as accessToken (transitional contract)
    return {
      accessToken: refreshed.id_token,
      user: updatedUser,
    };
  }
  // Used for the 'users' query
  async findAll() {
    return this.prisma.user.findMany({
      where: { isActive: true },
    });
  }
  async updateProfile(userId: string, data: UpdateUserInput) {
    const { mobileNumber, firstName, lastName } = data;
    if (!mobileNumber && !firstName && !lastName) {
      throw new BadRequestException('No profile fields provided');
    }
    if (mobileNumber) {
      const existing = await this.prisma.user.findFirst({
        where: {
          mobileNumber,
          NOT: { id: userId },
        },
      });
      if (existing) {
        throw new BadRequestException('Mobile number already in use');
      }
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(mobileNumber ? { mobileNumber } : {}),
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      },
    });
  }
  async updatePassword(userId: string, data: UpdatePasswordInput) {
    const { currentPassword, newPassword } = data;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const signIn = await this.firebaseSignInWithPassword(
      user.email,
      currentPassword,
    );
    const uid = user.firebaseUid ?? signIn.localId;
    if (!uid) {
      throw new UnauthorizedException('Firebase user not found');
    }
    await this.firebase.auth().updateUser(uid, { password: newPassword });
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { password: null },
      });
    } catch (err) {
      try {
        await this.firebase.auth().updateUser(uid, { password: currentPassword });
      } catch {
      }
      throw err;
    }
  }
  async forgotPassword(email: string, useOobCode = false) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user || user.isActive === false) {
      throw new BadRequestException('User not found');
    }
    const link = await this.firebase.auth().generatePasswordResetLink(email);
    if (useOobCode) {
      await this.firebaseSendPasswordResetOobCode(email);
    }
    return link;
  }
  async requestEnableAccount(email: string) {
    const genericMessage =
      'If the account exists, an account activation link was sent';
    const normalizedEmail = email.trim().toLowerCase();

    const now = Date.now();
    const cooldownMs = Math.max(
      1_000,
      Number(process.env.ENABLE_ACCOUNT_REQUEST_COOLDOWN_MS ?? 60_000),
    );
    const lastRequestAt = this.enableAccountCooldownByEmail.get(normalizedEmail);
    if (lastRequestAt && now - lastRequestAt < cooldownMs) {
      return genericMessage;
    }
    this.enableAccountCooldownByEmail.set(normalizedEmail, now);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user || user.isActive || !user.firebaseUid) {
      return genericMessage;
    }

    const ttlMinutes = Math.min(
      15,
      Math.max(10, Number(process.env.ENABLE_ACCOUNT_TOKEN_TTL_MINUTES ?? 15)),
    );
    const expiresAt = new Date(now + ttlMinutes * 60_000);
    const jti = randomUUID();

    await this.prisma.enableAccountToken.create({
      data: {
        jti,
        userId: user.id,
        expiresAt,
      },
    });

    const token = this.signEnableAccountToken({
      sub: user.id,
      uid: user.firebaseUid,
      email: user.email,
      jti,
      exp: Math.floor(expiresAt.getTime() / 1000),
    });

    const baseUrl =
      process.env.ENABLE_ACCOUNT_LINK_BASE_URL?.trim() ||
      'http://localhost:3001';
    const link = `${baseUrl.replace(/\/+$/, '')}/api/activate-account?token=${encodeURIComponent(token)}`;

    return `${genericMessage}. DEV_LINK: ${link}`;
  }

  async enableAccountWithToken(token: string) {
    const payload = this.verifyEnableAccountToken(token);

    const storedToken = await this.prisma.enableAccountToken.findUnique({
      where: { jti: payload.jti },
    });
    if (
      !storedToken ||
      storedToken.userId !== payload.sub ||
      storedToken.usedAt ||
      storedToken.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Invalid or expired activation token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.firebaseUid || user.firebaseUid !== payload.uid) {
      throw new BadRequestException('Firebase user not linked');
    }

    try {
      await this.firebase.auth().getUser(payload.uid);
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') {
        throw new BadRequestException('Firebase user not found');
      }
      throw err;
    }

    await this.firebase.auth().updateUser(payload.uid, { disabled: false });
    try {
      const [updatedUser] = await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: user.id },
          data: { isActive: true, tokenVersion: { increment: 1 } },
        }),
        this.prisma.enableAccountToken.update({
          where: { jti: payload.jti },
          data: { usedAt: new Date() },
        }),
      ]);

      await this.firebase.auth().setCustomUserClaims(payload.uid, {
        tv: updatedUser.tokenVersion,
      });
      return updatedUser;
    } catch (err) {
      try {
        await this.firebase.auth().updateUser(payload.uid, { disabled: true });
      } catch {
      }
      throw err;
    }
  }
  async disableAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const uid = user.firebaseUid;
    if (!uid) {
      throw new BadRequestException('Firebase user not linked');
    }
    await this.firebase.auth().updateUser(uid, { disabled: true });
    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { isActive: false, tokenVersion: { increment: 1 } },
      });
      await this.firebase.auth().setCustomUserClaims(uid, {
        tv: updated.tokenVersion,
      });
      return updated;
    } catch (err) {
      try {
        await this.firebase.auth().updateUser(uid, { disabled: false });
      } catch {
      }
      throw err;
    }
  }
  async logout(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.firebaseUid) {
      throw new BadRequestException('Firebase user not linked');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    });

    await this.firebase.auth().setCustomUserClaims(user.firebaseUid, {
      tv: updatedUser.tokenVersion,
    });
    return true;
  }
  async syncUser(uidOrEmail: string, adminKey: string): Promise<SyncUserReport> {
    const expected = process.env.ADMIN_API_KEY;
    if (!expected || adminKey !== expected) {
      throw new UnauthorizedException('Admin access required');
    }
    let fbUser: admin.auth.UserRecord | null = null;
    try {
      fbUser = await this.firebase.auth().getUser(uidOrEmail);
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') {
        if (uidOrEmail.includes('@')) {
          try {
            fbUser = await this.firebase.auth().getUserByEmail(uidOrEmail);
          } catch (err2: any) {
            if (err2?.code !== 'auth/user-not-found') {
              throw err2;
            }
          }
        }
      } else {
        throw err;
      }
    }
    if (fbUser) {
      const existing = await this.prisma.user.findUnique({
        where: { firebaseUid: fbUser.uid },
      });
      if (existing) {
        return {
          status: 'ok',
          action: 'noop',
          message: 'DB user already linked to Firebase user',
          dbUserId: existing.id,
          firebaseUid: fbUser.uid,
        };
      }
      const suffix = fbUser.uid;
      const shadowEmail = fbUser.email ?? `shadow+${suffix}@example.invalid`;
      const shadowUserName = `shadow_${suffix}`;
      const shadowMobile = `shadow_${suffix}`;
      const created = await this.prisma.user.create({
        data: {
          email: shadowEmail,
          userName: shadowUserName,
          mobileNumber: shadowMobile,
          firstName: fbUser.displayName?.split(' ')[0] ?? 'Shadow',
          lastName: fbUser.displayName?.split(' ').slice(1).join(' ') || 'User',
          password: null,
          firebaseUid: fbUser.uid,
          isActive: true,
        },
      });
      return {
        status: 'ok',
        action: 'created_db_shadow',
        dbUserId: created.id,
        firebaseUid: fbUser.uid,
      };
    }
    const dbUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { firebaseUid: uidOrEmail },
          { email: uidOrEmail },
        ],
      },
    });
    if (!dbUser) {
      return {
        status: 'not_found',
        message: 'No Firebase or DB user found',
      };
    }
    const updated = await this.prisma.user.update({
      where: { id: dbUser.id },
      data: { isActive: false, tokenVersion: { increment: 1 } },
    });
    return {
      status: 'ok',
      action: 'marked_db_inactive',
      dbUserId: updated.id,
      firebaseUid: updated.firebaseUid ?? undefined,
    };
  }
  // ---------------------------
  // Firebase REST helpers
  // ---------------------------
  private getFirebaseApiKey(): string {
    const apiKey = process.env.APIKEY;
    if (!apiKey) throw new Error('APIKEY (Firebase Web API key) is missing in env');
    return apiKey;
  }
  private async firebaseSignInWithPassword(email: string, password: string): Promise<FirebaseSignInResponse> {
    const apiKey = this.getFirebaseApiKey();
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    });
    const json: any = await res.json();
    if (!res.ok) {
      const msg = json?.error?.message ?? 'Firebase sign-in failed';
      if (msg === 'USER_DISABLED') {
        throw new UnauthorizedException('User disabled');
      }
      throw new UnauthorizedException(msg);
    }
    return {
      idToken: json.idToken,
      refreshToken: json.refreshToken,
      email: json.email,
      localId: json.localId,
    };
  }
  private async firebaseRefreshIdToken(refreshToken: string): Promise<FirebaseRefreshResponse> {
    const apiKey = this.getFirebaseApiKey();
    const url = `https://securetoken.googleapis.com/v1/token?key=${apiKey}`;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json: any = await res.json();
    if (!res.ok) {
      const msg = json?.error?.message ?? 'Firebase token refresh failed';
      throw new UnauthorizedException(msg);
    }
    return {
      id_token: json.id_token,
      refresh_token: json.refresh_token,
      user_id: json.user_id,
    };
  }
  private async firebaseSendPasswordResetOobCode(email: string): Promise<void> {
    const apiKey = this.getFirebaseApiKey();
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestType: 'PASSWORD_RESET',
        email,
      }),
    });
    const json: any = await res.json();
    if (!res.ok) {
      const msg = json?.error?.message ?? 'Firebase password reset failed';
      throw new BadRequestException(msg);
    }
  }

  private getEnableAccountSecret(): string {
    const secret = process.env.ENABLE_ACCOUNT_TOKEN_SECRET;
    if (!secret) {
      throw new InternalServerErrorException(
        'ENABLE_ACCOUNT_TOKEN_SECRET is missing in env',
      );
    }
    return secret;
  }

  private base64UrlEncode(input: string): string {
    return Buffer.from(input, 'utf8').toString('base64url');
  }

  private base64UrlDecode(input: string): string {
    return Buffer.from(input, 'base64url').toString('utf8');
  }

  private signEnableAccountToken(payload: {
    sub: string;
    uid: string;
    email: string;
    jti: string;
    exp: number;
  }): string {
    const header = { alg: 'HS256', typ: 'EAT' };
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const unsigned = `${encodedHeader}.${encodedPayload}`;
    const signature = createHmac('sha256', this.getEnableAccountSecret())
      .update(unsigned)
      .digest('base64url');
    return `${unsigned}.${signature}`;
  }

  private verifyEnableAccountToken(token: string): {
    sub: string;
    uid: string;
    email: string;
    jti: string;
    exp: number;
  } {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !signature) {
      throw new UnauthorizedException('Invalid or expired activation token');
    }

    const unsigned = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = createHmac('sha256', this.getEnableAccountSecret())
      .update(unsigned)
      .digest('base64url');

    const signatureBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Invalid or expired activation token');
    }

    let payload: any;
    try {
      payload = JSON.parse(this.base64UrlDecode(encodedPayload));
    } catch {
      throw new UnauthorizedException('Invalid or expired activation token');
    }

    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      typeof payload.uid !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.jti !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      throw new UnauthorizedException('Invalid or expired activation token');
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Invalid or expired activation token');
    }

    return payload;
  }
}
