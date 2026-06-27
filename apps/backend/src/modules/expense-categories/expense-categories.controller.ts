import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ExpenseCategoriesService } from './expense-categories.service';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
} from './dto/expense-categories.dto';

@Controller()
export class ExpenseCategoriesController {
  constructor(private readonly service: ExpenseCategoriesService) {}

  @Get('expense-categories')
  async findTree(@Query('includeInactive') includeInactive?: string) {
    const data = await this.service.findTree({
      includeInactive: includeInactive === 'true' || includeInactive === '1',
    });
    return { data };
  }

  @Get('expense-categories/flat')
  async findFlat() {
    const data = await this.service.findFlat();
    return { data };
  }

  @Post('expense-categories/seed')
  async seed() {
    const data = await this.service.seedSystemData();
    return { data };
  }

  @Get('expense-categories/:id')
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data };
  }

  @Post('expense-categories')
  async create(@Body() dto: CreateExpenseCategoryDto) {
    const data = await this.service.create(dto);
    return { data };
  }

  @Patch('expense-categories/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateExpenseCategoryDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete('expense-categories/:id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
