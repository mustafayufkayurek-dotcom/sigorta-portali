import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import {
  CreateTestNoteDto,
  GenerateTestNoteFormatDto,
  TestNoteFilterDto,
  UpdateTestNoteDto,
  WorkItemFilterDto,
} from './dto/test-notes.dto';
import { TestNotesService } from './test-notes.service';

@ApiTags('test-notes')
@ApiBearerAuth()
@Controller('test-notes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TestNotesController {
  constructor(private readonly service: TestNotesService) {}

  @Get()
  @RequirePermissions('note.view')
  @ApiOperation({ summary: 'Test notlarını listele' })
  async findAll(@Query() query: TestNoteFilterDto) {
    const result = await this.service.findAllTestNotes(query);
    return { success: true, data: result.data, meta: result.meta };
  }

  @Get(':id')
  @RequirePermissions('note.view')
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOneTestNote(id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('note.create')
  async create(@Body() dto: CreateTestNoteDto, @Req() req: any) {
    const data = await this.service.createTestNote(dto, req.user.id);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('note.update', 'note.create')
  async update(@Param('id') id: string, @Body() dto: UpdateTestNoteDto, @Req() req: any) {
    const data = await this.service.updateTestNote(id, dto, req.user.id);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('note.update', 'note.create')
  async remove(@Param('id') id: string, @Req() req: any) {
    const data = await this.service.removeTestNote(id, req.user.id);
    return { success: true, data };
  }

  @Post(':id/generate-format')
  @RequirePermissions('note.update', 'note.create')
  async generateFormat(@Param('id') id: string, @Body() dto: GenerateTestNoteFormatDto, @Req() req: any) {
    const data = await this.service.generateFormat(id, dto, req.user.id);
    return { success: true, data };
  }

  @Get('export/excel')
  @RequirePermissions('note.view')
  async exportExcel(@Query() query: TestNoteFilterDto, @Query() workItemQuery: WorkItemFilterDto, @Res() res: Response) {
    const buffer = await this.service.exportExcel(query, workItemQuery);
    const filename = `test-notlari-ve-gorevler-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=\"${filename}\"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }
}