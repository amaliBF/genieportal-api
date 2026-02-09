import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [SocialController],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
