import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { PdfModule } from '../pdf/pdf.module';
import { EstimatesController } from './estimates.controller';
import { EstimatesService } from './estimates.service';

@Module({
  imports: [JobsModule, PdfModule],
  controllers: [EstimatesController],
  providers: [EstimatesService],
  exports: [EstimatesService],
})
export class EstimatesModule {}
