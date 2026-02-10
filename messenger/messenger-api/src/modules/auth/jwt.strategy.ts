// src/modules/users/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

import {  ConfigService } from '@nestjs/config';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService,  private readonly configService: ConfigService) 
  {
  const secret = configService.get<string>('JWT_SECRET');
  if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }
  // console.log('JWT_SECRET in JwtStrategy:', secret);
  super({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    ignoreExpiration: false,
    secretOrKey: secret,
  });
}
  // 2. This runs AFTER the token is verified. It attaches the user to the request.
// sub: user.id, email: user.email, sub: user.id, tokenVersion: user.tokenVersion
  async validate(payload: { sub: string; email: string, tokenVersion:number }) {
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
