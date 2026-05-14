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
import { ClaimResponsibilitiesService } from './claim-responsibilities.service';
import { CreateClaimResponsibilityDto, UpdateClaimResponsibilityDto } from './dto/claim-responsibilities.dto';

@Controller()
export class ClaimResponsibilitiesController {
  constructor(private readonly service: ClaimResponsibilitiesService) {}

  @Get('claim-responsibilities')
  async findAll(
    @Query('userId') userId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('isActive') isActive?: string,
  ) {
    const filters: any = {};
    if (userId) filters.userId = userId;
    if (departmentId) filters.departmentId = departmentId;
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const data = await this.service.findAll(filters);
    return { data };
  }

  @Get('claim-responsibilities/:id')
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data };
  }

  @Post('claim-responsibilities')
  async create(@Body() dto: CreateClaimResponsibilityDto) {
    const data = await this.service.create(dto);
    return { data };
  }

  @Put('claim-responsibilities/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateClaimResponsibilityDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete('claim-responsibilities/:id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('claim-responsibilities/find-responsible')
  async findResponsible(
    @Body() params: { departmentId: string; city: string; district?: string; claimSubjectId?: string },
  ) {
    const user = await this.service.findResponsibleUser(params);
    return { data: user };
  }
}
