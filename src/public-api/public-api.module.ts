import { Module } from '@nestjs/common';
import { PublicApiController } from './public-api.controller';
import { ApiKeyController } from './api-key.controller';
import { PublicApiService } from './public-api.service';
import { ApiKeyGuard } from './guards/api-key.guard';

@Module({
  controllers: [PublicApiController, ApiKeyController],
  providers: [PublicApiService, ApiKeyGuard],
})
export class PublicApiModule {}
