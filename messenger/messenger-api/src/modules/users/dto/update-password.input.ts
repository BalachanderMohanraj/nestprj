import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

@InputType()
export class UpdatePasswordInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword!: string;
}
