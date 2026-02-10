// -- need to remove this file
// src/modules/users/dto/create-user.input.ts
import { InputType, Field } from '@nestjs/graphql';
@InputType()
export class CreateUserInput {
  @Field()
  userName!: string;
  @Field()
  email!: string;
}