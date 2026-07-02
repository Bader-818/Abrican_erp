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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UPLOAD_LIMITS } from '../common/upload-limits.constant';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpensesQueryDto } from './dto/expenses-query.dto';
import { ReimburseDto } from './dto/reimburse.dto';
import { RejectDto } from './dto/reject.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService, UploadedFileLike } from './expenses.service';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly service: ExpensesService) {}

  @Get()
  @RequirePermissions('expenses.view')
  findAll(@Query() query: ExpensesQueryDto) {
    return this.service.findAll(query);
  }

  @Get('reimbursements/summary')
  @RequirePermissions('expenses.view')
  reimbursementSummary() {
    return this.service.reimbursementSummary();
  }

  @Get(':id')
  @RequirePermissions('expenses.view')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/receipt')
  @RequirePermissions('expenses.view')
  async receipt(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { path, filename } = await this.service.getReceipt(id);
    res.set({ 'Content-Disposition': `inline; filename="${filename}"` });
    return new StreamableFile(createReadStream(path));
  }

  @Post()
  @RequirePermissions('expenses.manage')
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.service.create(dto, user, ip);
  }

  @Patch(':id')
  @RequirePermissions('expenses.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.service.update(id, dto, user, ip);
  }

  @Delete(':id')
  @RequirePermissions('expenses.manage')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.service.remove(id, user, ip);
  }

  @Post(':id/receipt')
  @RequirePermissions('expenses.manage')
  @UseInterceptors(FileInterceptor('file', { limits: UPLOAD_LIMITS }))
  attachReceipt(
    @Param('id') id: string,
    @UploadedFile() file: UploadedFileLike | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.service.attachReceipt(id, file, user, ip);
  }

  @Post(':id/submit')
  @RequirePermissions('expenses.manage')
  submit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.service.submit(id, user, ip);
  }

  @Post(':id/approve')
  @RequirePermissions('expenses.approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.service.approve(id, user, ip);
  }

  @Post(':id/reject')
  @RequirePermissions('expenses.approve')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.service.reject(id, dto.reason, user, ip);
  }

  @Post(':id/post')
  @RequirePermissions('expenses.approve')
  post(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.service.post(id, user, ip);
  }

  @Post(':id/reimburse')
  @RequirePermissions('expenses.approve')
  reimburse(
    @Param('id') id: string,
    @Body() dto: ReimburseDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.service.reimburse(id, dto, user, ip);
  }
}
