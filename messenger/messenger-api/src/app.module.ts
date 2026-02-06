import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,}),
    PrismaModule,UsersModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // This tells NestJS where to save the generated schema
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      // Enables the browser-based IDE to test your queries
      playground: true, 
    }),
    AuthModule,
    ChatModule,
  ], controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}