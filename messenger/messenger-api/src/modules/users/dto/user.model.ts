// src/modules/users/dto/user.model.ts
import { Field, ID, ObjectType } from '@nestjs/graphql';
@ObjectType()
export class User {
  @Field() id!: string;
  @Field() email!: string;
  @Field() userName!: string;
  @Field() firstName!: string;
  @Field({ nullable: true }) middleName?: string;
  @Field() lastName!: string;
  @Field() mobileNumber!: string;
  @Field() createdAt!: Date;
}  // user register