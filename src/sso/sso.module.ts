import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailModule } from '../email/email.module';
import { SsoController } from './sso.controller';
import { SsoService } from './sso.service';
import { SsoJwtStrategy } from './sso-jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'sso-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('SSO_JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
    EmailModule,
  ],
  controllers: [SsoController],
  providers: [SsoService, SsoJwtStrategy],
  exports: [SsoService],
})
export class SsoModule {}
