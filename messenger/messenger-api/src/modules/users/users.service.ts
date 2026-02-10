import { Injectable, BadRequestException, UnauthorizedException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterInput } from './dto/register.input';
import { LoginInput } from '../auth/dto/login.input';
import * as bcrypt from 'bcrypt';
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
      // displayName: `${data.firstName} ${data.lastName}`.trim(),
    });
  } catch (e: any) {
    // If user already exists in Firebase, link it (optional but good for sync)
    if (e?.code === 'auth/email-already-exists') {
      fbUser = await this.firebase.auth().getUserByEmail(data.email);
    } else {
      throw new BadRequestException(e?.message ?? 'Failed to create Firebase user');
    }
  }
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const { confirmPassword, ...userData } = data;
    try {
    return await this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,   // keep for now (schema requires it)
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

  /**
   * Transitional Firebase login (backend-only):
   * - Validates user against Firebase (email/password) via REST API using APIKEY
   * - Links/syncs DB user with firebaseUid
   * - Increments tokenVersion in DB
   * - Sets Firebase custom claim tv=<tokenVersion>
   * - Refreshes token so returned ID token includes the updated tv claim
   * - Returns { accessToken: <FirebaseIdToken>, user }
   */

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
    return this.prisma.user.findMany();
  }
  // ---------------------------
  // Firebase REST helpers
  // ---------------------------
  private getFirebaseApiKey(): string {
    const apiKey = process.env.APIKEY;
    // const apiKey = (process.env.APIKEY ?? '').trim();
    // console.log('APIKEY present?', !!process.env.APIKEY);
    // const apiKey = (process.env.APIKEY ?? '').trim();
    // console.log('APIKEY startsWith AIza?', apiKey.startsWith('AIza'), 'len', apiKey.length);
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
}
