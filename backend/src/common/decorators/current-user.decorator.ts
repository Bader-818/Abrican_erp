import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-user.interface';

/** Extracts the authenticated user (set by JwtStrategy) from the request. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    return data ? user?.[data] : user;
  },
);
