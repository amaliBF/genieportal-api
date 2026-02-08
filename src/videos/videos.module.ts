import { Module } from '@nestjs/common';
import {
  VideosController,
  FeedController,
  VideosDashboardController,
} from './videos.controller';
import { VideosService } from './videos.service';

@Module({
  controllers: [VideosController, FeedController, VideosDashboardController],
  providers: [VideosService],
  exports: [VideosService],
})
export class VideosModule {}
