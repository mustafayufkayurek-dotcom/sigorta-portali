import { Controller, Get, Post, Body, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
@UseGuards(PermissionsGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @RequirePermissions('document.view')
  @ApiOperation({ summary: 'Belgeleri listele' })
  async findAll(@Query() query: any) {
    const result = await this.documentsService.findAll(query);
    return { success: true, data: result.data, meta: result.meta };
  }

  @Get(':id')
  @RequirePermissions('document.view')
  @ApiOperation({ summary: 'Belge detayı' })
  async findOne(@Param('id') id: string) {
    const data = await this.documentsService.findOne(id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('document.upload')
  @ApiOperation({ summary: 'Yeni belge yükle' })
  async create(@Body() createDto: any, @CurrentUser() user: any) {
    const data = await this.documentsService.create(createDto, user.id);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('document.delete')
  @ApiOperation({ summary: 'Belge sil' })
  async remove(@Param('id') id: string) {
    const data = await this.documentsService.remove(id);
    return { success: true, data };
  }
}
