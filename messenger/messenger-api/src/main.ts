import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import {DocumentBuilder,SwaggerModule} from '@nestjs/swagger'
import * as firebaseAdmin from 'firebase-admin'
import * as fs from 'fs'
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const apiPath = 'api';
  app.setGlobalPrefix(apiPath);
  // Swagger Options
  const options = new DocumentBuilder()
    .addBearerAuth()
    .setTitle('Nest-js Swagger Example API')
    .setDescription('Swagger Example API API description')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, options);
  // Swagger path: http://localhost:3200/api/docs
  SwaggerModule.setup(`${apiPath}/docs`, app, document);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,       // Strips out fields that aren't in the DTO
    forbidNonWhitelisted: true, 
    transform: true,
  }));
  const firebaseKeyFilePath = '/home/oxi-010/Desktop/CodeBase/messenger_stb/nestprj/messenger/messenger-api/user-authentication-6ca8d-firebase-adminsdk-fbsvc-74020c95ff.json'
  const firebaseServiceAccount= JSON.parse(
    fs.readFileSync(firebaseKeyFilePath).toString(),
  )
  if(firebaseAdmin.apps.at.length === 0){
    console.log("INITILI firebase app");
    firebaseAdmin.initializeApp({
      credential:firebaseAdmin.credential.cert(firebaseServiceAccount)
    })
  }
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
