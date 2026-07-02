import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { CreateInvoiceFromEstimateDto } from './dto/create-invoice-from-estimate.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoicesQueryDto } from './dto/invoices-query.dto';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @RequirePermissions('invoices.view')
  findAll(@Query() query: InvoicesQueryDto) {
    return this.invoicesService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('invoices.view')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Get(':id/pdf')
  @Throttle({ default: { limit: 15, ttl: 60_000 } }) // PDF rendering is costly (P-07)
  @RequirePermissions('invoices.view')
  async pdf(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.invoicesService.renderPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }

  @Post()
  @RequirePermissions('invoices.manage')
  create(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.invoicesService.create(dto, user, ipAddress);
  }

  @Post('from-estimate')
  @RequirePermissions('invoices.manage')
  createFromEstimate(
    @Body() dto: CreateInvoiceFromEstimateDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.invoicesService.createFromEstimate(dto, user, ipAddress);
  }

  @Patch(':id')
  @RequirePermissions('invoices.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.invoicesService.update(id, dto, user, ipAddress);
  }

  @Delete(':id')
  @RequirePermissions('invoices.manage')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.invoicesService.remove(id, user, ipAddress);
  }

  @Post(':id/submit-for-approval')
  @RequirePermissions('invoices.manage')
  submitForApproval(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.invoicesService.submitForApproval(id, user, ipAddress);
  }

  @Post(':id/approve')
  @RequirePermissions('invoices.approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.invoicesService.approve(id, user, ipAddress);
  }

  @Post(':id/issue')
  @RequirePermissions('invoices.approve')
  issue(
    @Param('id') id: string,
    @Body() dto: IssueInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.invoicesService.issue(id, dto, user, ipAddress);
  }

  @Post(':id/cancel')
  @RequirePermissions('invoices.manage')
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.invoicesService.cancel(id, user, ipAddress);
  }
}
