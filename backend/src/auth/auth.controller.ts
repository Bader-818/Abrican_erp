import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AllowDuringPasswordChange } from '../common/decorators/allow-password-change.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { AccountService } from './account.service';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { MfaTokenDto } from './dto/mfa-token.dto';
import { verifyTotp } from './totp.util';

function refreshIdFrom(req: Request): string | undefined {
  return (req.cookies?.['refresh_token'] as string | undefined)?.split('.')[0];
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountService: AccountService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Second factor: once the password is correct, require a valid TOTP code.
    if (user.mfaEnabled) {
      if (!dto.totp) {
        return { mfaRequired: true };
      }
      if (!user.mfaSecret || !verifyTotp(user.mfaSecret, dto.totp)) {
        throw new UnauthorizedException('Invalid authentication code');
      }
    }

    const ctx = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
    const tokens = await this.authService.login(user.id, ctx);
    res.cookie('refresh_token', tokens.refreshToken, this.authService.getRefreshCookieOptions());

    return {
      accessToken: tokens.accessToken,
      user: { id: user.id, name: user.name, email: user.email },
      mustChangePassword: user.mustChangePassword,
    };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const tokens = await this.authService.refresh(refreshToken, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.cookie('refresh_token', tokens.refreshToken, this.authService.getRefreshCookieOptions());

    return { accessToken: tokens.accessToken };
  }

  @AllowDuringPasswordChange()
  @HttpCode(200)
  @Post('logout')
  async logout(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refresh_token'];
    const result = await this.authService.logout(refreshToken, userId, req.ip);
    res.clearCookie('refresh_token', this.authService.getRefreshCookieClearOptions());
    return result;
  }

  @AllowDuringPasswordChange()
  @HttpCode(200)
  @Post('logout-all')
  async logoutAll(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.logoutAll(userId, req.ip);
    res.clearCookie('refresh_token', this.authService.getRefreshCookieClearOptions());
    return result;
  }

  @AllowDuringPasswordChange()
  @Get('me')
  @RequirePermissions('auth.me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  // --- Self-service account & security -------------------------------------

  @AllowDuringPasswordChange()
  @HttpCode(200)
  @Post('change-password')
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.accountService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
      refreshIdFrom(req),
      req.ip,
    );
  }

  @HttpCode(200)
  @Post('mfa/setup')
  mfaSetup(@CurrentUser() user: AuthenticatedUser) {
    return this.accountService.startMfaSetup(user.id, user.email);
  }

  @HttpCode(200)
  @Post('mfa/enable')
  mfaEnable(@CurrentUser('id') userId: string, @Body() dto: MfaTokenDto, @Req() req: Request) {
    return this.accountService.enableMfa(userId, dto.token, req.ip);
  }

  @HttpCode(200)
  @Post('mfa/disable')
  mfaDisable(@CurrentUser('id') userId: string, @Body() dto: MfaTokenDto, @Req() req: Request) {
    return this.accountService.disableMfa(userId, dto.token, req.ip);
  }

  @Get('sessions')
  sessions(@CurrentUser('id') userId: string, @Req() req: Request) {
    return this.accountService.listSessions(userId, refreshIdFrom(req));
  }

  @HttpCode(200)
  @Post('sessions/:id/revoke')
  revokeSession(@CurrentUser('id') userId: string, @Param('id') id: string, @Req() req: Request) {
    return this.accountService.revokeSession(userId, id, req.ip);
  }
}
