import { Global, Module } from '@nestjs/common';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { AdminModule } from '../admin/admin.module';

@Global()
@Module({
  imports: [AdminModule],
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
