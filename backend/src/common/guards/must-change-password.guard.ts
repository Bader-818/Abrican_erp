import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_DURING_PASSWORD_CHANGE } from '../decorators/allow-password-change.decorator';
import { AuthenticatedUser } from '../types/authenticated-user.interface';

/**
 * When a user is flagged `mustChangePassword` (e.g. after an admin reset), this
 * guard blocks every authenticated route except those marked
 * `@AllowDuringPasswordChange()` until they set a new password. Runs after the
 * JWT guard so `req.user` is populated; public routes (no user) pass through.
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user?.mustChangePassword) return true;

    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_DURING_PASSWORD_CHANGE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return true;

    throw new ForbiddenException('You must change your password before continuing.');
  }
}
