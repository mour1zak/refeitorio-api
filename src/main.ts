import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CSP desligado porque o Swagger UI (script/style inline) quebra com o
  // Content-Security-Policy padrão do helmet; os demais headers de segurança
  // continuam ativos.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Refeitorio Corporativo API')
      .setDescription('API para gestão de cardápios e reservas de refeições.')
      .setVersion('1.0')
      .addBearerAuth()
      .build()

      const document = SwaggerModule.createDocument(app, config)
      SwaggerModule.setup('api', app, document) 
  }
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
