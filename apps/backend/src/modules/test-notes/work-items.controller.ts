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
  CreateWorkItemDto,
  TestNoteFilterDto,
  UpdateWorkItemDto,
  WorkItemFilterDto,
} from './dto/test-notes.dto';
import { TestNotesService } from './test-notes.service';

@ApiTags('work-items')
@ApiBearerAuth()
@Controller('work-items')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkItemsController {
  constructor(private readonly service: TestNotesService) {}

  @Get()
  @RequirePermissions('settings.view')
  @ApiOperation({ summary: 'İş/karar kayıtlarını listele' })
  async findAll(@Query() query: WorkItemFilterDto) {
    const result = await this.service.findAllWorkItems(query);
    return { success: true, data: result.data, meta: result.meta };
  }

  @Get(':id')
  @RequirePermissions('settings.view')
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOneWorkItem(id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('settings.update')
  async create(@Body() dto: CreateWorkItemDto, @Req() req: any) {
    const data = await this.service.createWorkItem(dto, req.user.id);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('settings.update')
  async update(@Param('id') id: string, @Body() dto: UpdateWorkItemDto, @Req() req: any) {
    const data = await this.service.updateWorkItem(id, dto, req.user.id);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('settings.update')
  async remove(@Param('id') id: string, @Req() req: any) {
    const data = await this.service.removeWorkItem(id, req.user.id);
    return { success: true, data };
  }

  @Get('export/excel')
  @RequirePermissions('settings.view')
  async exportExcel(@Query() query: WorkItemFilterDto, @Res() res: Response) {
    const buffer = await this.service.exportExcel({ page: 1, limit: 5000 } as TestNoteFilterDto, query);
    const filename = `gecici-is-gorev-takip-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=\"${filename}\"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }
}