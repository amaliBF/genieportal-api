import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BoostService } from './boost.service';
import { BoostController } from './boost.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [BoostController],
  providers: [BoostService],
  exports: [BoostService],
})
export class BoostModule {}
