import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { InterviewService } from './interview.service';
import { InterviewController } from './interview.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [JwtModule.register({}), EmailModule],
  controllers: [InterviewController],
  providers: [InterviewService],
  exports: [InterviewService],
})
export class InterviewModule {}
