import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { PdfModule } from '../pdf/pdf.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [JobsModule, PdfModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
