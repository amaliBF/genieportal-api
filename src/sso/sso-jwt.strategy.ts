import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SsoJwtStrategy extends PassportStrategy(Strategy, 'sso-jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: (req: any) => req?.cookies?.genie_access_token || null,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('SSO_JWT_SECRET')!,
    });
  }

  async validate(payload: { sub: string; email: string }) {
    return { userId: payload.sub, email: payload.email };
  }
}
