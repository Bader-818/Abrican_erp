import { Controller, Get, Ip, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { CostingService } from './costing.service';

@Controller('jobs/:jobId/costing')
export class CostingController {
  constructor(private readonly costingService: CostingService) {}

  /** Live cost/profit breakdown for the job (does not persist). */
  @Get()
  @RequirePermissions('jobs.costing_view')
  compute(@Param('jobId') jobId: string) {
    return this.costingService.computeCost(jobId);
  }

  /** Persist the cost review and advance COMPLETED → COSTING_REVIEW. */
  @Post('review')
  @RequirePermissions('jobs.costing_review')
  review(
    @Param('jobId') jobId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.costingService.review(jobId, user, ipAddress);
  }

  /** COSTING_REVIEW → READY_FOR_INVOICE. */
  @Post('ready-for-invoice')
  @RequirePermissions('jobs.costing_review')
  ready(@Param('jobId') jobId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.costingService.markReadyForInvoice(jobId, user);
  }
}
