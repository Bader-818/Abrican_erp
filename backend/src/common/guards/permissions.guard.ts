import { ForbiddenException, Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_ONLY_KEY } from '../decorators/auth-only.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../types/authenticated-user.interface';

/**
 * Deny-by-default access control (pentest P-05): every route must declare
 * @Public, @AuthOnly, or @RequirePermissions. A route with none of the three
 * is a wiring mistake and is rejected for everyone rather than silently
 * exposed to any authenticated user.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required && required.length > 0) {
      const hasAll = required.every((permission) => user.permissions.includes(permission));
      if (!hasAll) {
        throw new ForbiddenException(
          `Missing required permission(s): ${required.join(', ')}`,
        );
      }
      return true;
    }

    const authOnly = this.reflector.getAllAndOverride<boolean>(AUTH_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (authOnly) {
      return true;
    }

    throw new ForbiddenException('Route has no access-control declaration');
  }
}
