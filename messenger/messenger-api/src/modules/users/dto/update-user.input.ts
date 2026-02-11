// src/modules/users/dto/update-user.input.ts
import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

@InputType()
export class UpdateUserInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  mobileNumber?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  firstName?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  lastName?: string;
}
