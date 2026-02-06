import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatResolver } from './chat.resolver';
// import { ChatGateway } from './chat.gateway';
import { PrismaModule } from '../../prisma/prisma.module'; // To get PrismaService
import { AuthModule } from '../auth/auth.module';
import { ChatGateway } from './chat.gateway';
@Module({
  providers: [ChatService, ChatResolver,ChatGateway],
  imports:[PrismaModule, 
    AuthModule]
})
export class ChatModule {}
