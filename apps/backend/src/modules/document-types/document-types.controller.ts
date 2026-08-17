import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { DocumentTypesService } from './document-types.service';
import { CreateDocumentTypeDto, UpdateDocumentTypeDto } from './dto/document-types.dto';

@Controller('document-types')
export class DocumentTypesController {
  constructor(private readonly service: DocumentTypesService) {}

  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('departmentId') departmentId?: string,
    @Query('entityScope') entityScope?: 'vendor' | 'customer',
    @Query('serviceBranchType') serviceBranchType?: 'hasar' | 'acil_yardim',
    @Query('customerSubType') customerSubType?: string,
  ) {
    return this.service.findAll({
      status,
      departmentId,
      entityScope,
      serviceBranchType,
      customerSubType,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data };
  }

  @Post()
  async create(@Body() dto: CreateDocumentTypeDto) {
    const data = await this.service.create(dto);
    return { data };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateDocumentTypeDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
