import { Global, Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { BunnyStorageService } from './bunny-storage.service';

@Global()
@Module({
  providers: [UploadService, BunnyStorageService],
  exports: [UploadService, BunnyStorageService],
})
export class UploadModule {}
