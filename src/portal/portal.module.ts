import { Module } from '@nestjs/common';
import { PortalController, PublicPortalController } from './portal.controller';
import { PortalService } from './portal.service';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [AdminModule],
  controllers: [PublicPortalController, PortalController],
  providers: [PortalService],
  exports: [PortalService],
})
export class PortalModule {}
