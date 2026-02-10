// // src/modules/users/gql-auth.guard.ts
// import { ExecutionContext, Injectable } from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';
// import { GqlExecutionContext } from '@nestjs/graphql';

// @Injectable()
// export class GqlAuthGuard extends AuthGuard('jwt') {
//   getRequest(context: ExecutionContext) {
//     const ctx = GqlExecutionContext.create(context);
//     return ctx.getContext().req;
//   }
// }

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PrismaService } from '../../prisma/prisma.service';
import { FIREBASE_ADMIN } from '../auth/firebase/firebase-admin.provider'; // adjust path
import type * as admin from 'firebase-admin';

@Injectable()
export class GqlAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FIREBASE_ADMIN) private readonly firebase: typeof admin,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const req = ctx.getContext().req;

    const authHeader: string | undefined = req.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const idToken = authHeader.slice('Bearer '.length).trim();

    try {
      // `true` => also checks if token was revoked (recommended)
      const decoded = await this.firebase.auth().verifyIdToken(idToken, true);

      // Option 1: Find user by firebase UID (best)
      const user = await this.prisma.user.findUnique({
        where: { firebaseUid: decoded.uid }, // requires column in DB
      });

      if (!user) throw new UnauthorizedException('User not found');

      // Attach just like Passport did
      req.user = user;

      return true;
    } catch (e) {
      throw new UnauthorizedException('Invalid/expired Firebase token');
    }
  }
}
