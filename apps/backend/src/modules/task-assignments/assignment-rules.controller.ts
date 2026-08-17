import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { AssignmentRulesService } from './assignment-rules.service';
import { CreateAssignmentRuleDto, UpdateAssignmentRuleDto } from './dto/assignment-rules.dto';

@Controller('assignment-rules')
export class AssignmentRulesController {
  constructor(private readonly service: AssignmentRulesService) {}

  @Get()
  async findAll() {
    const data = await this.service.findAll();
    return { data };
  }

  @Post()
  async create(@Body() dto: CreateAssignmentRuleDto) {
    const data = await this.service.create(dto);
    return { data };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAssignmentRuleDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
