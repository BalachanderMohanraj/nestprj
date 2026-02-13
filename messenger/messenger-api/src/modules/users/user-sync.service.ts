import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FIREBASE_ADMIN } from '../auth/firebase/firebase-admin.provider';
import { Inject } from '@nestjs/common';
import type * as admin from 'firebase-admin';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class UserSyncService {
  private readonly logger = new Logger(UserSyncService.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FIREBASE_ADMIN) private readonly firebase: typeof admin,
  ) {}
  @Interval('user-sync', 60_000)
  async scheduledSync() {
    if (process.env.NODE_ENV === 'production') return;
    const minutes = Number(process.env.USER_SYNC_INTERVAL_MINUTES ?? 10);
    const intervalMs = Math.max(1, minutes) * 60_000;
    const lastRunKey = `USER_SYNC_LAST_RUN`;
    const lastRun = (globalThis as any)[lastRunKey] as number | undefined;
    const now = Date.now();
    if (lastRun && now - lastRun < intervalMs) return;
    (globalThis as any)[lastRunKey] = now;
    await this.reconcileDbToFirebase();
    await this.reconcileFirebaseToDb();
  }
  async reconcileDbToFirebase() {
    const users = await this.prisma.user.findMany({
      where: { isActive: true, firebaseUid: { not: null } },
      select: { id: true, firebaseUid: true },
    });
    for (const user of users) {
      if (!user.firebaseUid) continue;
      try {
        await this.firebase.auth().getUser(user.firebaseUid);
      } catch (err: any) {
        if (err?.code === 'auth/user-not-found') {
          this.logger.warn(
            `Firebase user missing for DB user ${user.id}. Marking inactive.`,
          );
          await this.prisma.user.update({
            where: { id: user.id },
            data: { isActive: false, tokenVersion: { increment: 1 } },
          });
        } else {
          this.logger.warn(
            `Error checking Firebase user ${user.firebaseUid}: ${err?.message ?? err}`,
          );
        }
      }
    }
  }
  async reconcileFirebaseToDb() {
    let pageToken: string | undefined;
    do {
      const res = await this.firebase.auth().listUsers(1000, pageToken);
      for (const fbUser of res.users) {
        const exists = await this.prisma.user.findUnique({
          where: { firebaseUid: fbUser.uid },
          select: { id: true },
        });
        if (!exists) {
          this.logger.warn(
            `DB user missing for Firebase uid ${fbUser.uid}. Disabling Firebase user.`,
          );
          await this.firebase.auth().updateUser(fbUser.uid, { disabled: true });
        }
      }
      pageToken = res.pageToken;
    } while (pageToken);
  }
}
