import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreateFileSubjectDto,
  UpdateFileSubjectDto,
  UpsertFieldConfigDto,
} from './dto/departments.dto';

@Controller()
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  // ─── Departments ───────────────────────────────────────────────────────────

  @Get('departments')
  async findAll() {
    const data = await this.service.findAll();
    return { data };
  }

  @Post('departments')
  async create(@Body() dto: CreateDepartmentDto) {
    const data = await this.service.create(dto);
    return { data };
  }

  @Get('departments/seed')
  async seed() {
    const data = await this.service.seedSystemData();
    return { data, message: 'Seed tamamlandı' };
  }

  @Get('departments/:id')
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data };
  }

  @Put('departments/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete('departments/:id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ─── File Subjects ─────────────────────────────────────────────────────────

  @Get('departments/:id/file-subjects')
  async getFileSubjects(@Param('id') id: string) {
    const data = await this.service.getFileSubjects(id);
    return { data };
  }

  @Post('departments/:id/file-subjects')
  async createFileSubject(
    @Param('id') id: string,
    @Body() dto: CreateFileSubjectDto,
  ) {
    const data = await this.service.createFileSubject(id, dto);
    return { data };
  }

  @Put('department-file-subjects/:id')
  async updateFileSubject(
    @Param('id') id: string,
    @Body() dto: UpdateFileSubjectDto,
  ) {
    const data = await this.service.updateFileSubject(id, dto);
    return { data };
  }

  @Delete('department-file-subjects/:id')
  async removeFileSubject(@Param('id') id: string) {
    return this.service.removeFileSubject(id);
  }

  // ─── Field Configs ─────────────────────────────────────────────────────────

  @Get('departments/:id/field-configs')
  async getFieldConfigs(
    @Param('id') id: string,
    @Query('reportFormat') reportFormat?: string,
  ) {
    const data = await this.service.getFieldConfigs(id, reportFormat);
    return { data };
  }

  @Put('departments/:id/field-configs')
  async upsertFieldConfigs(
    @Param('id') id: string,
    @Body() body: { configs: UpsertFieldConfigDto[] },
  ) {
    const data = await this.service.upsertFieldConfigs(id, body.configs);
    return { data };
  }
}
