import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SajuModule } from './saju/saju.module';
import { CompatibilityModule } from './compatibility/compatibility.module';
import { MatchingModule } from './matching/matching.module';
import { RomanceTimingModule } from './romance-timing/romance-timing.module';
import { FriendsModule } from './friends/friends.module';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    UsersModule,
    AuthModule,
    SajuModule,
    CompatibilityModule,
    MatchingModule,
    RomanceTimingModule,
    FriendsModule,
    PaymentModule,
  ],
})
export class AppModule {}
