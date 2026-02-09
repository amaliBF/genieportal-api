import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CompanyFollowService } from './company-follow.service';
import { CompanyFollowController } from './company-follow.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [CompanyFollowController],
  providers: [CompanyFollowService],
  exports: [CompanyFollowService],
})
export class CompanyFollowModule {}
