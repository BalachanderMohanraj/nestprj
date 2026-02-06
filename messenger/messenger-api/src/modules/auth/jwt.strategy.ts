// src/modules/users/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      // 1. Look for the token in the 'Authorization: Bearer <token>' header
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'SUPER_SECRET_KEY', // Must match the secret in UsersModule
    });
  }

  // 2. This runs AFTER the token is verified. It attaches the user to the request.
// sub: user.id, gmail: user.gmail, sub: user.id, tokenVersion: user.tokenVersion
  async validate(payload: { sub: string; gmail: string, tokenVersion:number }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.tokenVersion !== payload.tokenVersion ) 
      {
    throw new UnauthorizedException('Token is no longer valid');
  }
  return user;
}
}