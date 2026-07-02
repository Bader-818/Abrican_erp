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
import { ConvertEstimateDto } from './dto/convert-estimate.dto';
import { CreateEstimateDto } from './dto/create-estimate.dto';
import { EstimatesQueryDto } from './dto/estimates-query.dto';
import { RejectEstimateDto } from './dto/reject-estimate.dto';
import { UpdateEstimateDto } from './dto/update-estimate.dto';
import { EstimatesService } from './estimates.service';

@Controller('estimates')
export class EstimatesController {
  constructor(private readonly estimatesService: EstimatesService) {}

  @Get()
  @RequirePermissions('estimates.view')
  findAll(@Query() query: EstimatesQueryDto) {
    return this.estimatesService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('estimates.view')
  findOne(@Param('id') id: string) {
    return this.estimatesService.findOne(id);
  }

  @Get(':id/pdf')
  @Throttle({ default: { limit: 15, ttl: 60_000 } }) // PDF rendering is costly (P-07)
  @RequirePermissions('estimates.view')
  async pdf(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.estimatesService.renderPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }

  @Post()
  @RequirePermissions('estimates.manage')
  create(
    @Body() dto: CreateEstimateDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.estimatesService.create(dto, user, ipAddress);
  }

  @Patch(':id')
  @RequirePermissions('estimates.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEstimateDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.estimatesService.update(id, dto, user, ipAddress);
  }

  @Delete(':id')
  @RequirePermissions('estimates.manage')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.estimatesService.remove(id, user, ipAddress);
  }

  @Post(':id/send')
  @RequirePermissions('estimates.manage')
  send(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.estimatesService.send(id, user, ipAddress);
  }

  @Post(':id/approve')
  @RequirePermissions('estimates.approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.estimatesService.approve(id, user, ipAddress);
  }

  @Post(':id/reject')
  @RequirePermissions('estimates.approve')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectEstimateDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.estimatesService.reject(id, dto.reason, user, ipAddress);
  }

  @Post(':id/convert')
  @RequirePermissions('estimates.manage')
  convert(
    @Param('id') id: string,
    @Body() dto: ConvertEstimateDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.estimatesService.convert(id, dto, user, ipAddress);
  }
}
