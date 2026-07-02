import { ForbiddenException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_ONLY_KEY } from '../decorators/auth-only.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let metadata: Record<string, unknown>;
  let user: { permissions: string[] } | undefined;

  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    metadata = {};
    user = { permissions: ['clients.view'] };
    const reflector = {
      getAllAndOverride: (key: string) => metadata[key],
    } as unknown as Reflector;
    guard = new PermissionsGuard(reflector);
  });

  it('allows @Public routes without a user', () => {
    metadata[IS_PUBLIC_KEY] = true;
    user = undefined;
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows @AuthOnly routes for any authenticated user', () => {
    metadata[AUTH_ONLY_KEY] = true;
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects @AuthOnly routes without a user', () => {
    metadata[AUTH_ONLY_KEY] = true;
    user = undefined;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows when the user holds all required permissions', () => {
    metadata[PERMISSIONS_KEY] = ['clients.view'];
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects when a required permission is missing', () => {
    metadata[PERMISSIONS_KEY] = ['clients.view', 'clients.manage'];
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('denies by default when a route declares no access control', () => {
    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException('Route has no access-control declaration'),
    );
  });

  it('handler @RequirePermissions wins over class-level @AuthOnly', () => {
    metadata[AUTH_ONLY_KEY] = true;
    metadata[PERMISSIONS_KEY] = ['users.manage'];
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
