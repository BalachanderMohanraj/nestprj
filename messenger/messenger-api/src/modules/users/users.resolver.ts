// src/modules/users/users.resolver.ts
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { User } from './dto/user.model';
import { UsersService } from './users.service';
import { RegisterInput } from './dto/register.input';
import { AuthResponse } from '../auth/dto/auth-response.model';
import { LoginInput } from '../auth/dto/login.input';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdateUserInput } from './dto/update-user.input';
import { UpdatePasswordInput } from './dto/update-password.input';
import { SyncUserReport } from './dto/sync-user-report.model';
// import { UpdateUserInput } from './dto/update-user.input';

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

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async updateProfile(
    @CurrentUser() user: any,
    @Args('data') data: UpdateUserInput,
  ) {
    return this.usersService.updateProfile(user.id, data);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async updatePassword(
    @CurrentUser() user: any,
    @Args('data') data: UpdatePasswordInput,
  ) {
    return this.usersService.updatePassword(user.id, data);
  }

  @Mutation(() => String)
  async forgotPassword(
    @Args('email') email: string,
    @Args('useOobCode', { type: () => Boolean, nullable: true })
    useOobCode?: boolean,
  ) {
    return this.usersService.forgotPassword(email, useOobCode);
  }

  @Mutation(() => String)
  async requestEnableAccount(@Args('email') email: string) {
    return this.usersService.requestEnableAccount(email);
  }

  @Mutation(() => User)
  async enableAccountWithToken(@Args('token') token: string) {
    return this.usersService.enableAccountWithToken(token);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async disableAccount(@CurrentUser() user: any) {
    return this.usersService.disableAccount(user.id);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async logout(@CurrentUser() user: any) {
    return this.usersService.logout(user.id);
  }

  @Mutation(() => SyncUserReport)
  @UseGuards(GqlAuthGuard)
  async syncUser(
    @Args('uidOrEmail') uidOrEmail: string,
    @Args('adminKey') adminKey: string,
  ) {
    return this.usersService.syncUser(uidOrEmail, adminKey);
  }
}
