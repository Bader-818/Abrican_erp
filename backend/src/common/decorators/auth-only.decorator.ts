import { SetMetadata } from '@nestjs/common';

export const AUTH_ONLY_KEY = 'authOnly';

/**
 * Marks a route as requiring authentication but no specific permission
 * (e.g. own profile, own notifications). Every route must carry @Public,
 * @AuthOnly, or @RequirePermissions — PermissionsGuard denies otherwise.
 */
export const AuthOnly = () => SetMetadata(AUTH_ONLY_KEY, true);
