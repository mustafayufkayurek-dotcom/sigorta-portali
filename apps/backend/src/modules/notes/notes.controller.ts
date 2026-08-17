import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotesService } from './notes.service';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('notes')
@ApiBearerAuth()
@Controller('notes')
@UseGuards(PermissionsGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @RequirePermissions('note.view')
  @ApiOperation({ summary: 'Notları listele' })
  async findAll(@Query() query: any) {
    const result = await this.notesService.findAll(query);
    return { success: true, data: result.data, meta: result.meta };
  }

  @Get(':id')
  @RequirePermissions('note.view')
  @ApiOperation({ summary: 'Not detayı' })
  async findOne(@Param('id') id: string) {
    const data = await this.notesService.findOne(id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('note.create')
  @ApiOperation({ summary: 'Yeni not oluştur' })
  async create(@Body() createDto: any, @CurrentUser() user: any) {
    const data = await this.notesService.create(createDto, user.id);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('note.update')
  @ApiOperation({ summary: 'Not güncelle' })
  async update(@Param('id') id: string, @Body() updateDto: any, @CurrentUser() user: any) {
    const data = await this.notesService.update(id, updateDto, user.id);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('note.delete')
  @ApiOperation({ summary: 'Not sil' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.notesService.remove(id, user.id);
    return { success: true, data };
  }
}
