import {BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller()
export class AccountActivationController {
  constructor(private readonly usersService: UsersService) {}

  @Get('activate-account')
  async activateAccount(@Query('token') token: string | undefined) {
    if (!token) {
      throw new BadRequestException('Missing activation token');
    }
    const user = await this.usersService.enableAccountWithToken(token);
    return {
      success: true,
      message: 'Account activated successfully. Please login again.',
      userId: user.id,
      email: user.email,
    };
  }
}
