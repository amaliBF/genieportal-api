import { Module } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import {
  DiscoveryController,
  FeedJobsController,
} from './discovery.controller';

@Module({
  controllers: [DiscoveryController, FeedJobsController],
  providers: [DiscoveryService],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
