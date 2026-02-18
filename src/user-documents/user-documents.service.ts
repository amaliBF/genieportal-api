import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { DocumentType } from '@prisma/client';

@Injectable()
export class UserDocumentsService {
  private static readonly MAX_DOCUMENTS = 10;
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
  ];

  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  async list(userId: string) {
    return this.prisma.userDocument.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        dokumentTyp: true,
        name: true,
        originalName: true,
        mimeType: true,
        fileSize: true,
        createdAt: true,
      },
    });
  }

  async upload(
    userId: string,
    file: Express.Multer.File,
    name: string,
    dokumentTyp: DocumentType = DocumentType.SONSTIGES,
  ) {
    // Validate file
    this.validateDocument(file);

    // Check limit
    const count = await this.prisma.userDocument.count({ where: { userId } });
    if (count >= UserDocumentsService.MAX_DOCUMENTS) {
      throw new BadRequestException(
        `Maximal ${UserDocumentsService.MAX_DOCUMENTS} Dokumente erlaubt`,
      );
    }

    // Save file
    const storagePath = await this.uploadService.saveFile(
      file,
      'user-documents',
      userId,
    );

    // Create DB record
    return this.prisma.userDocument.create({
      data: {
        userId,
        dokumentTyp,
        name,
        filename: storagePath.split('/').pop()!,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath,
      },
      select: {
        id: true,
        dokumentTyp: true,
        name: true,
        originalName: true,
        mimeType: true,
        fileSize: true,
        createdAt: true,
      },
    });
  }

  async delete(userId: string, documentId: string) {
    const doc = await this.prisma.userDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new NotFoundException('Dokument nicht gefunden');
    }

    if (doc.userId !== userId) {
      throw new ForbiddenException('Kein Zugriff auf dieses Dokument');
    }

    // Delete file from disk
    await this.uploadService.deleteFile(doc.storagePath);

    // Delete DB record
    await this.prisma.userDocument.delete({ where: { id: documentId } });

    return { message: 'Dokument gelöscht' };
  }

  async getFilePath(userId: string, documentId: string) {
    const doc = await this.prisma.userDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new NotFoundException('Dokument nicht gefunden');
    }

    if (doc.userId !== userId) {
      throw new ForbiddenException('Kein Zugriff auf dieses Dokument');
    }

    return {
      storagePath: doc.storagePath,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
    };
  }

  private validateDocument(file: Express.Multer.File) {
    if (
      !UserDocumentsService.ALLOWED_MIME_TYPES.includes(file.mimetype)
    ) {
      throw new BadRequestException(
        'Nur PDF, DOC, DOCX, JPEG und PNG Dateien sind erlaubt',
      );
    }

    if (file.size > UserDocumentsService.MAX_FILE_SIZE) {
      throw new BadRequestException('Datei darf maximal 10MB groß sein');
    }
  }
}
