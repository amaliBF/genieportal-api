import { Module } from '@nestjs/common';
import { UserDocumentsController } from './user-documents.controller';
import { UserDocumentsService } from './user-documents.service';

@Module({
  controllers: [UserDocumentsController],
  providers: [UserDocumentsService],
  exports: [UserDocumentsService],
})
export class UserDocumentsModule {}
