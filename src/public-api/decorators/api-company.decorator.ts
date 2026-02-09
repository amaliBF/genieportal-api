import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const ApiCompany = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const apiKey = request.apiKey;
    if (data) return apiKey?.[data];
    return apiKey;
  },
);
