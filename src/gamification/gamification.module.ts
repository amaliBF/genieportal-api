import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [GamificationController],
  providers: [GamificationService],
  exports: [GamificationService],
})
export class GamificationModule {}
