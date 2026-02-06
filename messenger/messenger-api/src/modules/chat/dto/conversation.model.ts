import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../../users/dto/user.model';

@ObjectType()
export class Conversation {
  @Field(() => ID)
  id!: string;

  @Field()
  createdAt!: Date;

  @Field(() => [Participant])
  participants!: Participant[];
}

@ObjectType()
export class Participant {
  @Field(() => ID)
  id!: string;

  @Field(() => User)
  user!: User;
}

@ObjectType()
export class Message {
  @Field(() => ID)
  id!: string;

  @Field()
  content!: string;

  @Field(() => ID)
  conversationId!: string;

  @Field(() => User)
  sender!: User;

  @Field()
  senderId!: string;

  @Field()
  createdAt!: Date;
}