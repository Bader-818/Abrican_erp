import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('operations')
  @RequirePermissions('dashboard.operations.view')
  operations() {
    return this.dashboardService.operations();
  }

  @Get('assets')
  @RequirePermissions('dashboard.assets.view')
  assets() {
    return this.dashboardService.assets();
  }
}
