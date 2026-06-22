/**
 * Shape attached to `req.user` by JwtStrategy after validating an access token.
 * Includes the resolved set of permission keys for the user's role so that
 * PermissionsGuard can check authorization without extra DB round-trips.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  mfaEnabled: boolean;
  mustChangePassword: boolean;
}
