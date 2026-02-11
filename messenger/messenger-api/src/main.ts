import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const apiPath = 'api';    // Global prefix for API routes (Optional)
  app.setGlobalPrefix(apiPath);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, 
    forbidNonWhitelisted: true, 
    transform: true,
  }));
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Api is listening in http://localhost:${port}/graphql`);
}  
bootstrap();
