// src/modules/users/users.resolver.ts
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { User } from './dto/user.model';
import { UsersService } from './users.service';
import { RegisterInput } from './dto/register.input';
import { AuthResponse } from '../auth/dto/auth-response.model';
import { LoginInput } from '../auth/dto/login.input';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { UpdateUserInput } from './dto/update-user.input';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [User], { name: 'users' })
  @UseGuards(GqlAuthGuard) // <--- Only users with a valid token can run this now!
  async getUsers() {
    return this.usersService.findAll();
  }


  @Mutation(() => User)
  async register(@Args('data') data: RegisterInput) {
    return this.usersService.register(data);
  }


  @Mutation(() => AuthResponse)
  async login(@Args('data') data: LoginInput) {  // data format for login including auth jwt
    return this.usersService.login(data);
  }


  // @Mutation(() => UpdateUserInput)
  // async updatefield(@Args('data') data: LoginInput) {
  //   return this.usersService.login(data);
  // }
}
