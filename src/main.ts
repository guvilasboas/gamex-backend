import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { enablePatches } from 'immer';
import { Container } from './common/container';

enablePatches();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  Container.set(app);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('GameX API')
    .setDescription('The GameX API documentation')
    .setVersion('1.0')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  app.useGlobalPipes(new ValidationPipe());

  await app.listen(3000);
}
bootstrap();
