import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (config: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: config.get('DB_HOST', 'localhost'),
  port: config.get<number>('DB_PORT', 5432),
  username: config.get('DB_USERNAME', 'postgres'),
  password: config.get('DB_PASSWORD', '') || undefined,
  database: config.get('DB_DATABASE', 'yeon'),
  autoLoadEntities: true,
  synchronize: true, // dev only — 프로덕션에서는 migrations 사용
});
