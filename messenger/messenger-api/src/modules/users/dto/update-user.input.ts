// src/modules/users/dto/register.input.ts
import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class UpdateUserInput {
  @Field()
  mobileNumber!: string;
  @Field()
  password!: string;
}