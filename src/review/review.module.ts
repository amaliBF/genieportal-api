import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
