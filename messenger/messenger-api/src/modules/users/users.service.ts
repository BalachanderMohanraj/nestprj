// src/modules/users/users.service.ts
import * as bcrypt from 'bcrypt';
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterInput } from './dto/register.input';
import { JwtService } from '@nestjs/jwt';
import { LoginInput } from '../auth/dto/login.input';
@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}
  // Used for the 'register' mutation
  async register(data: RegisterInput) {
    // console.log('Received Data:', data); // logging
    // console.log('Password Match:', data.password === data.confirmPassword);
    if (data.password !== data.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { gmail: data.gmail },
          { username: data.username },
          { mobilenumber: data.mobilenumber },
        ],
      },
    });
    if (existing) {
      throw new BadRequestException(
        'User already exists with this email, username, or phone',
      );
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const { confirmPassword, ...userData } = data;
    return this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
      },
    });
  }
  async login(data: LoginInput) {
    // 1. Find user by Gmail
    const user = await this.prisma.user.findUnique({where: { gmail: data.gmail }})
    if (!user) {throw new BadRequestException('Invalid credentials')}

    // 2. Compare Passwords
    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) { throw new BadRequestException('Invalid credentials')}
  
  // 3. Increment the version in the DB
    const updatedUser = await this.prisma.user.update({
    where: { id: user.id },
    data: { tokenVersion: { increment: 1 } }
  });
    // 3. Generate JWT
    const payload = { sub: updatedUser.id, gmail: user.gmail, tokenVersion: updatedUser.tokenVersion };
    return {
      accessToken: this.jwtService.sign(payload),
      user: updatedUser,
    };
  }

  // Used for the 'users' query
  async findAll() {
    return this.prisma.user.findMany();
  }
}
