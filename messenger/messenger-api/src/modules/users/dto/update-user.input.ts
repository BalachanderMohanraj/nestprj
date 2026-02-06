// src/modules/users/dto/register.input.ts
import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class UpdateUserInput {
  @Field()
  mobilenumber!: string;
  @Field()
  password!: string;
}