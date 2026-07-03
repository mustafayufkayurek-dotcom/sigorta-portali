import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
@UseGuards(PermissionsGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @RequirePermissions('task.view')
  @ApiOperation({ summary: 'Görevleri listele' })
  async findAll(@Query() query: any) {
    const result = await this.tasksService.findAll(query);
    return { success: true, data: result.data, meta: result.meta };
  }

  @Get(':id')
  @RequirePermissions('task.view')
  @ApiOperation({ summary: 'Görev detayı' })
  async findOne(@Param('id') id: string) {
    const data = await this.tasksService.findOne(id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('task.create')
  @ApiOperation({ summary: 'Yeni görev oluştur' })
  async create(@Body() createDto: CreateTaskDto) {
    const data = await this.tasksService.create(createDto);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('task.update')
  @ApiOperation({ summary: 'Görev güncelle' })
  async update(@Param('id') id: string, @Body() updateDto: any) {
    const data = await this.tasksService.update(id, updateDto);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('task.delete')
  @ApiOperation({ summary: 'Görev sil' })
  async remove(@Param('id') id: string) {
    const data = await this.tasksService.remove(id);
    return { success: true, data };
  }

  @Post(':id/complete')
  @RequirePermissions('task.complete')
  @ApiOperation({ summary: 'Görevi tamamla' })
  async complete(@Param('id') id: string) {
    const data = await this.tasksService.complete(id);
    return { success: true, data };
  }
}
