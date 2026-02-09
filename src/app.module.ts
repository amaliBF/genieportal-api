import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { UploadModule } from './upload/upload.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { ProfessionsModule } from './professions/professions.module';
import { JobsModule } from './jobs/jobs.module';
import { VideosModule } from './videos/videos.module';
import { MatchingModule } from './matching/matching.module';
import { ChatModule } from './chat/chat.module';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { EmailModule } from './email/email.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { TeamModule } from './team/team.module';
import { PortalModule } from './portal/portal.module';
import { CustomerModule } from './customer/customer.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { SecurityModule } from './common/security/security.module';
import { CouponModule } from './coupon/coupon.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Rate Limiting: 100 Requests pro 15 Minuten (global)
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 Sekunde
        limit: 10, // Max 10 Req/Sekunde
      },
      {
        name: 'medium',
        ttl: 60000, // 1 Minute
        limit: 60, // Max 60 Req/Minute
      },
      {
        name: 'long',
        ttl: 900000, // 15 Minuten
        limit: 300, // Max 300 Req/15 Min
      },
    ]),
    PrismaModule,
    UploadModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    ProfessionsModule,
    JobsModule,
    VideosModule,
    MatchingModule,
    ChatModule,
    AdminModule,
    AiModule,
    AnalyticsModule,
    EmailModule,
    NotificationsModule,
    DiscoveryModule,
    SubscriptionModule,
    TeamModule,
    PortalModule,
    CustomerModule,
    AuditLogModule,
    SecurityModule,
    CouponModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
