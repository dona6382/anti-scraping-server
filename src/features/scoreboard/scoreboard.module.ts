import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityEvent } from '../../core/database/entities';
import { AuthModule } from '../auth/auth.module';
import { ScoreboardController } from './scoreboard.controller';
import { ScoreboardService } from './scoreboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SecurityEvent]),
    AuthModule,
  ],
  controllers: [ScoreboardController],
  providers: [ScoreboardService],
})
export class ScoreboardModule {}
