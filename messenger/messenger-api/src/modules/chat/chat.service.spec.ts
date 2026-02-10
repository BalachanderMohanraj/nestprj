import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('ChatService (unit)', () => {
  let service: ChatService;

  const prismaMock = {
    conversation: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    message: {
      create: jest.fn(),
    },
  };

  const jwtMock = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = moduleRef.get(ChatService);
  });

  describe('findOrCreateOneToOneChat()', () => {
    it('should throw if currentUserId === targetUserId', async () => {
      await expect(
        service.findOrCreateOneToOneChat('u1', 'u1'),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.conversation.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.conversation.create).not.toHaveBeenCalled();
    });

    it('should return existing chat if found', async () => {
      const existingChat = { id: 'c1', participants: [], messages: [] };
      prismaMock.conversation.findFirst.mockResolvedValue(existingChat);

      const res = await service.findOrCreateOneToOneChat('u1', 'u2');

      expect(prismaMock.conversation.findFirst).toHaveBeenCalledTimes(1);
      expect(prismaMock.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          AND: [
            { participants: { some: { userId: 'u1' } } },
            { participants: { some: { userId: 'u2' } } },
          ],
        },
        include: {
          participants: { include: { user: true } },
          messages: { take: 1, orderBy: { createdAt: 'desc' } },
        },
      });

      expect(prismaMock.conversation.create).not.toHaveBeenCalled();
      expect(res).toEqual(existingChat);
    });

    it('should create a new chat if none exists', async () => {
      prismaMock.conversation.findFirst.mockResolvedValue(null);

      const createdChat = { id: 'c2', participants: [], messages: [] };
      prismaMock.conversation.create.mockResolvedValue(createdChat);

      const res = await service.findOrCreateOneToOneChat('u1', 'u2');

      expect(prismaMock.conversation.findFirst).toHaveBeenCalledTimes(1);

      expect(prismaMock.conversation.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.conversation.create).toHaveBeenCalledWith({
        data: {
          participants: {
            create: [{ userId: 'u1' }, { userId: 'u2' }],
          },
        },
        include: {
          participants: {
            include: { user: true },
          },
        },
      });

      expect(res).toEqual(createdChat);
    });
  });

  describe('getUserConversations()', () => {
    it('should return conversations for user and include participants + last message', async () => {
      const conversations = [{ id: 'c1' }, { id: 'c2' }];
      prismaMock.conversation.findMany.mockResolvedValue(conversations);

      const res = await service.getUserConversations('u1');

      expect(prismaMock.conversation.findMany).toHaveBeenCalledTimes(1);
      expect(prismaMock.conversation.findMany).toHaveBeenCalledWith({
        where: {
          participants: { some: { userId: 'u1' } },
        },
        include: {
          participants: { include: { user: true } },
          messages: { take: 1, orderBy: { createdAt: 'desc' } },
        },
      });

      expect(res).toEqual(conversations);
    });
  });

  describe('sendMessage()', () => {
    it('should create a message with sender details', async () => {
      const createdMessage = {
        id: 'm1',
        content: 'hello',
        conversationId: 'c1',
        senderId: 'u1',
        sender: { id: 'u1' },
      };

      prismaMock.message.create.mockResolvedValue(createdMessage);

      const res = await service.sendMessage('c1', 'u1', 'hello');

      expect(prismaMock.message.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.message.create).toHaveBeenCalledWith({
        data: {
          content: 'hello',
          conversationId: 'c1',
          senderId: 'u1',
        },
        include: {
          sender: true,
        },
      });

      expect(res).toEqual(createdMessage);
    });
  });
});
