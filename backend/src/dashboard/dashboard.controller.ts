import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardFinanceQueryDto } from './dto/dashboard-finance-query.dto';

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

  @Get('finance')
  @RequirePermissions('dashboard.finance.view')
  finance(@Query() query: DashboardFinanceQueryDto) {
    return this.dashboardService.finance(query);
  }
}
