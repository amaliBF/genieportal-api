import { Module } from '@nestjs/common';
import { EmbedController } from './embed.controller';
import { SdkController } from './sdk.controller';
import { EmbedService } from './embed.service';

@Module({
  controllers: [EmbedController, SdkController],
  providers: [EmbedService],
})
export class EmbedModule {}
