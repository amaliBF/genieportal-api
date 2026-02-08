import { Module } from '@nestjs/common';
import {
  UserLikesController,
  UserMatchesController,
  DashboardCandidatesController,
  DashboardMatchesController,
} from './matching.controller';
import { MatchingService } from './matching.service';

@Module({
  controllers: [
    UserLikesController,
    UserMatchesController,
    DashboardCandidatesController,
    DashboardMatchesController,
  ],
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
