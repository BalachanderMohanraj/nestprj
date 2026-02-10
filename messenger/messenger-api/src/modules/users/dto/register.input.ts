// src/modules/users/dto/register.input.ts
import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsStrongPassword, MinLength } from 'class-validator';

@InputType()
export class RegisterInput {
  @Field()
  @IsEmail()
  email!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional() // This allows mname to be missing or null
  middleName?: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  userName!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  mobileNumber!: string;

  @Field()
  @IsString()
  @MinLength(8)
  @IsStrongPassword()
  password!: string;

  @Field()
  @IsString()
  @IsNotEmpty() // This "whitelists" confirmPassword so the pipe accepts it
  confirmPassword!: string;
}