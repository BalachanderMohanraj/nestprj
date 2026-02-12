import { Injectable, BadRequestException, UnauthorizedException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterInput } from './dto/register.input';
import { UpdateUserInput } from './dto/update-user.input';
import { UpdatePasswordInput } from './dto/update-password.input';
import { SyncUserReport } from './dto/sync-user-report.model';
import { LoginInput } from '../auth/dto/login.input';
import { FIREBASE_ADMIN } from '../auth/firebase/firebase-admin.provider';
import type * as admin from 'firebase-admin';

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
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FIREBASE_ADMIN) private readonly firebase: typeof admin,
  ) {}
  // Used for the 'register' mutation (kept as-is for your DB)
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
    // If user already exists in Firebase, link it (optional but good for sync)
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
        firebaseUid: fbUser.uid,    // ✅ DB <-> Firebase link
      },
    });
  } catch (err) {
    // Rollback Firebase user if DB fails and we created a brand new one
    // (If Firebase already existed, we should NOT delete it.)
    // Best-effort cleanup:
    try {
      // If DB failed after createUser, fbUser exists. But we don't know if it was created or fetched.
      // You can track a boolean `createdInFirebase` to be precise; here is safe-ish cleanup:
      await this.firebase.auth().deleteUser(fbUser.uid);
    } catch {
      // ignore rollback failure
    }
    throw err;
  }
}
  async login(data: LoginInput) {
    // 1) Authenticate via Firebase using email/password (backend-only)
    const signIn = await this.firebaseSignInWithPassword(data.email, data.password);
    // console.log('APIKEY present?', !!process.env.APIKEY);
    // 2) Find DB user by email (your system’s user record)
    const user = await this.prisma.user.findUnique({
      where: { email: signIn.email },
    });
    if (!user) {
      // You can choose to auto-create here, but you said DB must be in sync.
      // For safety: do not create silently.
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
        // best-effort rollback
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
        // best-effort rollback
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
      // Common Firebase error payload: { error: { message: "INVALID_PASSWORD" } }
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

}
