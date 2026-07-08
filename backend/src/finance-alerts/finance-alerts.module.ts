import { Module } from '@nestjs/common';
import { FinanceAlertsService } from './finance-alerts.service';

// PrismaService and NotificationsService come from @Global modules.
@Module({
  providers: [FinanceAlertsService],
  exports: [FinanceAlertsService],
})
export class FinanceAlertsModule {}
