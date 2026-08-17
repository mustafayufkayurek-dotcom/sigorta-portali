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
import { ClaimSubjectsService } from './claim-subjects.service';
import { CreateClaimSubjectDto, UpdateClaimSubjectDto } from './dto/claim-subjects.dto';

@Controller()
export class ClaimSubjectsController {
  constructor(private readonly service: ClaimSubjectsService) {}

  @Get('claim-subjects')
  async findAll(@Query('category') category?: string) {
    const data = await this.service.findAll(category);
    return { data };
  }

  @Get('claim-subjects/active')
  async findActive(@Query('category') category?: string) {
    const data = await this.service.findActive(category);
    return { data };
  }

  @Get('claim-subjects/:id')
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data };
  }

  @Post('claim-subjects')
  async create(@Body() dto: CreateClaimSubjectDto) {
    const data = await this.service.create(dto);
    return { data };
  }

  @Put('claim-subjects/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateClaimSubjectDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete('claim-subjects/:id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
