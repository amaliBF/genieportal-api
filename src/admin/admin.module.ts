import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('ADMIN_JWT_SECRET'),
        signOptions: {
          expiresIn: '30m',
        },
      }),
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminAuthService, AdminAuthGuard],
  exports: [AdminAuthService, AdminAuthGuard, JwtModule],
})
export class AdminModule {}
