import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class SsoJwtGuard extends AuthGuard('sso-jwt') {}
