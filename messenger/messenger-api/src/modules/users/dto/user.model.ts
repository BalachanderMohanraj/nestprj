// src/modules/users/dto/user.model.ts
import { Field, ID, ObjectType } from '@nestjs/graphql';
@ObjectType()
export class User {
  @Field() id!: string;
  @Field() gmail!: string;
  @Field() username!: string;
  @Field() fname!: string;
  @Field({ nullable: true }) mname?: string;
  @Field() lname!: string;
  @Field() mobilenumber!: string;
  @Field() createdAt!: Date;
}  // user register