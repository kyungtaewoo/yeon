import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const origins = (process.env.CORS_ORIGINS || 'http://localhost:3001,http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Capacitor 네이티브 앱은 capacitor://localhost (iOS) / http://localhost (Android) origin 사용.
  // env 설정과 무관하게 항상 허용.
  origins.push('capacitor://localhost', 'http://localhost');

  app.enableCors({
    origin: origins,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(4000);
  console.log('🚀 NestJS API running on http://localhost:4000');
}
bootstrap();
