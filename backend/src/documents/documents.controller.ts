import {
  Body,
  Controller,
  Delete,
  Get,
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
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { AuditEntity } from '../common/decorators/audit-entity.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { DocumentsService, UploadedFileLike } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentsQueryDto } from './dto/documents-query.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @RequirePermissions('documents.view')
  findAll(@Query() query: DocumentsQueryDto) {
    return this.documentsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('documents.view')
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Get(':id/download')
  @RequirePermissions('documents.view')
  async download(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { path, filename } = await this.documentsService.getDownload(id);
    res.set({ 'Content-Disposition': `attachment; filename="${filename}"` });
    return new StreamableFile(createReadStream(path));
  }

  @Post()
  @RequirePermissions('documents.manage')
  @AuditEntity({ entityType: 'Document', prismaModel: 'document' })
  @UseInterceptors(FileInterceptor('file'))
  create(
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file: UploadedFileLike | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.create(dto, file, user.id);
  }

  @Patch(':id')
  @RequirePermissions('documents.manage')
  @AuditEntity({ entityType: 'Document', prismaModel: 'document' })
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.documentsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('documents.manage')
  @AuditEntity({ entityType: 'Document', prismaModel: 'document' })
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}
