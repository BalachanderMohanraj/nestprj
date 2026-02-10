import { Module } from '@nestjs/common';
import { UsersResolver } from './users.resolver';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';
import { FirebaseModule } from '../auth/firebase/firebase.module';
import { GqlAuthGuard } from '../auth/gql-auth.guard';

@Module({
  imports: [PrismaModule, AuthModule, FirebaseModule], // Import AuthModule here
  providers: [UsersService, UsersResolver,GqlAuthGuard],
})
export class UsersModule {}