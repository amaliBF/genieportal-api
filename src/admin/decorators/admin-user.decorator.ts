import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const AdminUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const adminUser = request.adminUser;
    if (data) {
      return adminUser?.[data];
    }
    return adminUser;
  },
);
