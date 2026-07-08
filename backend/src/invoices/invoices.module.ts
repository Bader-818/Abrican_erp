import { Module } from '@nestjs/common';
import { FinanceAlertsModule } from '../finance-alerts/finance-alerts.module';
import { JobsModule } from '../jobs/jobs.module';
import { PdfModule } from '../pdf/pdf.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [JobsModule, PdfModule, FinanceAlertsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
