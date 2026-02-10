// src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
// import { JwtModule } from '@nestjs/jwt';
// import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
// import { JwtStrategy } from './jwt.strategy';
import { FirebaseModule } from './firebase/firebase.module';
import { GqlAuthGuard } from './gql-auth.guard';

// @Module({
//   imports: [
//     PrismaModule,FirebaseModule,
//     // We use registerAsync so we can wait for ConfigService to be ready
//     JwtModule.registerAsync({
//       imports: [ConfigModule],
//       inject: [ConfigService],
//       useFactory: async (configService: ConfigService) => ({
//         secret: configService.get<string>('JWT_SECRET'),
//         // secretOrKey: configService.get<string>('JWT_SECRET'),
//         signOptions: { 
//           expiresIn: configService.get<string>('JWT_EXPIRES_IN') as any
//         },
//       }),
//     }),
//   ],
//   providers: [JwtStrategy],
//   exports: [JwtModule], // Export this so Chat/Users can use it
// })
// export class AuthModule {}
@Module({
  imports: [
    PrismaModule,
    FirebaseModule,
  ],
  providers: [GqlAuthGuard],
  exports: [GqlAuthGuard],
})
export class AuthModule {}
