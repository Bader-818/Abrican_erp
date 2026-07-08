import { Module } from '@nestjs/common';
import { FinanceAlertsModule } from '../finance-alerts/finance-alerts.module';
import { JobsModule } from '../jobs/jobs.module';
import { CostingController } from './costing.controller';
import { CostingService } from './costing.service';

@Module({
  imports: [JobsModule, FinanceAlertsModule],
  controllers: [CostingController],
  providers: [CostingService],
  exports: [CostingService],
})
export class CostingModule {}
