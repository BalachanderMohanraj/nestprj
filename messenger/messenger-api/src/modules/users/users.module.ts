import { Module } from '@nestjs/common';
import { UsersResolver } from './users.resolver';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule], // Import AuthModule here
  providers: [UsersService, UsersResolver],
})
export class UsersModule {}