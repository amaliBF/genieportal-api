import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TalentPoolService } from './talent-pool.service';
import { TalentPoolController } from './talent-pool.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [TalentPoolController],
  providers: [TalentPoolService],
  exports: [TalentPoolService],
})
export class TalentPoolModule {}
