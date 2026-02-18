import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserDocumentsService } from './user-documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('User Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/user/documents')
export class UserDocumentsController {
  private uploadDir: string;

  constructor(private readonly documentsService: UserDocumentsService) {
    this.uploadDir =
      process.env.UPLOAD_DIR ||
      '/var/www/vhosts/ausbildungsgenie.de/uploads';
  }

  @Get()
  @ApiOperation({ summary: 'Alle Dokumente des Users auflisten' })
  list(@CurrentUser() user: any) {
    return this.documentsService.list(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Dokument hochladen' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentsService.upload(user.userId, file, dto.name, dto.dokumentTyp);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Dokument löschen' })
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.documentsService.delete(user.userId, id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Dokument herunterladen' })
  async download(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const doc = await this.documentsService.getFilePath(user.userId, id);
    const filePath = path.join(this.uploadDir, doc.storagePath);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: 'Datei nicht gefunden' });
      return;
    }

    res.set({
      'Content-Type': doc.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.originalName)}"`,
    });

    const fileStream = fs.createReadStream(filePath);
    return new StreamableFile(fileStream);
  }
}
