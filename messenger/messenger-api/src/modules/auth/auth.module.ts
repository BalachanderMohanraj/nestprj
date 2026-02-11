import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FirebaseModule } from './firebase/firebase.module';
import { GqlAuthGuard } from './gql-auth.guard';
@Module({
  imports: [
    PrismaModule,
    FirebaseModule,
  ],
  providers: [GqlAuthGuard],
  exports: [GqlAuthGuard, FirebaseModule],
})
export class AuthModule {}
