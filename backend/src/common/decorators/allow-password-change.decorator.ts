import { SetMetadata } from '@nestjs/common';

export const ALLOW_DURING_PASSWORD_CHANGE = 'allowDuringPasswordChange';

/**
 * Marks a route as reachable while the user is in the "must change password"
 * state (e.g. /auth/me, change-password, logout). Everything else is blocked by
 * MustChangePasswordGuard until they set a new password.
 */
export const AllowDuringPasswordChange = () => SetMetadata(ALLOW_DURING_PASSWORD_CHANGE, true);
