import { Module } from '@nestjs/common';
import { UsersResolver } from './users.resolver';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersService } from './users.service';
import { UserSyncService } from './user-sync.service';
import { AuthModule } from '../auth/auth.module';
import { AccountActivationController } from './account-activation.controller';

@Module({
  imports: [PrismaModule, AuthModule], // Import AuthModule here
  controllers: [AccountActivationController],
  providers: [UsersService, UsersResolver, UserSyncService],
})
export class UsersModule {}
