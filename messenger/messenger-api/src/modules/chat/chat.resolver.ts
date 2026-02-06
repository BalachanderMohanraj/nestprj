import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway'; // Import your Gateway
import { Conversation } from './dto/conversation.model';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Message } from './dto/conversation.model';
@Resolver()
@UseGuards(GqlAuthGuard) // Protect all chat actions
export class ChatResolver {
  constructor(private readonly chatService: ChatService,private readonly chatGateway: ChatGateway,) {}

  @Mutation(() => Conversation)
  async startConversation(
    @CurrentUser() user: any,
    @Args('recipientId') recipientId: string,
  ) {
    // This logic ensures we don't create duplicate chats for the same 2 people
    return this.chatService.findOrCreateOneToOneChat(user.id, recipientId);
  }
@Mutation(() => Message) // You'll need to define the Message ObjectType in your DTO
async sendMessage(
  @CurrentUser() user: any,
  @Args('conversationId') conversationId: string,
  @Args('content') content: string,
) {
 const newMessage = await this.chatService.sendMessage(
      conversationId,
      user.id,
      content,
    );

    // 2. THE BROADCAST: Tell the Gateway to emit the message live
    // We send it to a specific room named after the conversationId
    this.chatGateway.server
      .to(conversationId)
      .emit('onMessage', newMessage);

    return newMessage;
  }
  @Query(() => [Conversation])
  async myConversations(@CurrentUser() user: any) {
    return this.chatService.getUserConversations(user.id);
  }
}