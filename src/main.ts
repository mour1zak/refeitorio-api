import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Refeitorio Corporativo API')
      .setDescription('API para gestão de cardápios e reservas de refeições.')
      .setVersion('1.0')
      .addBasicAuth()
      .build()

      const document = SwaggerModule.createDocument(app, config)
      SwaggerModule.setup('api', app, document) 
  }
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
