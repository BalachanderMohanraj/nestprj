// src/modules/users/dto/register.input.ts
import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

@InputType()
export class RegisterInput {
  @Field()
  @IsEmail()
  gmail!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  fname!: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional() // This allows mname to be missing or null
  mname?: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  lname!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  username!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  mobilenumber!: string;

  @Field()
  @IsString()
  @MinLength(8)
  password!: string;

  @Field()
  @IsString()
  @IsNotEmpty() // This "whitelists" confirmPassword so the pipe accepts it
  confirmPassword!: string;
}