import { Test } from '@nestjs/testing';
import { ChatResolver } from './chat.resolver';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { FIREBASE_ADMIN } from '../auth/firebase/firebase-admin.provider';

describe('ChatResolver (unit)', () => {
  let resolver: ChatResolver;
  // Mock ChatService methods used by resolver
  const chatServiceMock = {
    findOrCreateOneToOneChat: jest.fn(),
    sendMessage: jest.fn(),
    getUserConversations: jest.fn(),
  };
  /**
   * Mock gateway "server.to(...).emit(...)"
   * We simulate:
   *   this.chatGateway.server.to(conversationId).emit('onMessage', newMessage)
   */
  const emitMock = jest.fn();
  const toMock = jest.fn(() => ({ emit: emitMock }));
  const chatGatewayMock = {
    server: {
      to: toMock,
    },
  };

  const gqlAuthGuardMock = {
    canActivate: jest.fn(() => true),
  };

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const firebaseAdminMock = {
    auth: jest.fn(() => ({
      verifyIdToken: jest.fn(),
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatResolver,
        { provide: ChatService, useValue: chatServiceMock },
        { provide: ChatGateway, useValue: chatGatewayMock },
        { provide: GqlAuthGuard, useValue: gqlAuthGuardMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: FIREBASE_ADMIN, useValue: firebaseAdminMock },
      ],
    }).compile();
    resolver = moduleRef.get(ChatResolver);
  });
  describe('startConversation()', () => {
    it('should call chatService.findOrCreateOneToOneChat with user.id and recipientId', async () => {
      const user = { id: 'user1' };
      const recipientId = 'user2';
      const conversation = { id: 'c1', participants: ['user1', 'user2'] };
      chatServiceMock.findOrCreateOneToOneChat.mockResolvedValue(conversation);
      const res = await resolver.startConversation(user as any, recipientId);
      expect(chatServiceMock.findOrCreateOneToOneChat).toHaveBeenCalledTimes(1);
      expect(chatServiceMock.findOrCreateOneToOneChat).toHaveBeenCalledWith(
        'user1',
        'user2',
      );
      expect(res).toEqual(conversation);
    });
  });
  describe('sendMessage()', () => {
    it('should call chatService.sendMessage and broadcast via gateway to room conversationId', async () => {
      const user = { id: 'user1' };
      const conversationId = 'conv123';
      const content = 'hello';

      const newMessage = {
        id: 'm1',
        conversationId,
        senderId: 'user1',
        content,
      };
      chatServiceMock.sendMessage.mockResolvedValue(newMessage);
      const res = await resolver.sendMessage(
        user as any,
        conversationId,
        content,
      );
      // 1) Service call
      expect(chatServiceMock.sendMessage).toHaveBeenCalledTimes(1);
      expect(chatServiceMock.sendMessage).toHaveBeenCalledWith(
        conversationId,
        'user1',
        content,
      );
      // 2) Broadcast call: server.to(conversationId).emit('onMessage', newMessage)
      expect(toMock).toHaveBeenCalledTimes(1);
      expect(toMock).toHaveBeenCalledWith(conversationId);
      expect(emitMock).toHaveBeenCalledTimes(1);
      expect(emitMock).toHaveBeenCalledWith('onMessage', newMessage);
      // 3) Resolver returns newMessage
      expect(res).toEqual(newMessage);
    });
  });
  describe('myConversations()', () => {
    it('should return conversations from chatService.getUserConversations(user.id)', async () => {
      const user = { id: 'user1' };
      const conversations = [{ id: 'c1' }, { id: 'c2' }];
      chatServiceMock.getUserConversations.mockResolvedValue(conversations);
      const res = await resolver.myConversations(user as any);
      expect(chatServiceMock.getUserConversations).toHaveBeenCalledTimes(1);
      expect(chatServiceMock.getUserConversations).toHaveBeenCalledWith('user1');
      expect(res).toEqual(conversations);
    });
  });
});

