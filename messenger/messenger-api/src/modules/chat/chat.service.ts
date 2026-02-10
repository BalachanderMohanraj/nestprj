// import { Injectable, BadRequestException } from '@nestjs/common';
// import { PrismaService } from '../../prisma/prisma.service';
// import { JwtService } from '@nestjs/jwt';
// @Injectable()
// export class ChatService {
//   constructor(
//     private prisma: PrismaService,
//     private jwtService: JwtService,
//   ) {}
//   async findOrCreateOneToOneChat(currentUserId: string, targetUserId: string) {
//     // 1. Validation: Prevent chatting with yourself
//     if (currentUserId === targetUserId) 
//       {throw new BadRequestException('You cannot start a conversation with yourself.');
//     }
//     // 2. Search for an existing 1-on-1 conversation
//     const existingChat = await this.prisma.conversation.findFirst({
//       where: {AND:
//         [
//           { participants: { some: { userId: currentUserId } } },
//           { participants: { some: { userId: targetUserId } } },
//         ],},
//         //   // This ensures it's a 1-on-1 (exactly 2 participants)
//       include: {participants: {include:{user: true,},},
//         messages: { take: 1, orderBy: { createdAt: 'desc' } } },});
//     if (existingChat) {
//       return existingChat;
//     }
//     // 3. Create new conversation if none exists
//     return this.prisma.conversation.create({
//       data: {
//         participants: {create: [{ userId: currentUserId }, { userId: targetUserId }],},},
//       include: {participants: {
//           include: {user: true,},},},});
//   }
//   async getUserConversations(userId: string) {
//     return this.prisma.conversation.findMany({
//       where: {
//         participants: { some: { userId } },
//       },
//       include: {
//         participants: { include: { user: true } },
//         messages: { take: 1, orderBy: { createdAt: 'desc' } }, // Show last message
//       },
//     });
//   }
//   async sendMessage(conversationId: string, senderId: string, content: string) {
//   return this.prisma.message.create({
//     data: {
//       content,
//       conversationId,
//       senderId,
//     },
//     include: {
//       sender: true, // Returns sender details (name/email) for the UI
//     },
//   });
// }
// }
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async findOrCreateOneToOneChat(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      throw new BadRequestException('You cannot start a conversation with yourself.');
    }

    const existingChat = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: currentUserId } } },
          { participants: { some: { userId: targetUserId } } },
        ],
      },
      include: {
        participants: { include: { user: true } },
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    if (existingChat) return existingChat;

    return this.prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId: currentUserId }, { userId: targetUserId }],
        },
      },
      include: {
        participants: { include: { user: true } },
      },
    });
  }

  async getUserConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: { include: { user: true } },
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async sendMessage(conversationId: string, senderId: string, content: string) {
    return this.prisma.message.create({
      data: { content, conversationId, senderId },
      include: { sender: true },
    });
  }
}

