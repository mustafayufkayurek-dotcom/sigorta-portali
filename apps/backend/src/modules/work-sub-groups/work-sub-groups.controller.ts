import { Controller, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { WorkSubGroupsService } from './work-sub-groups.service';
import { CreateWorkSubGroupDto } from './dto/create-work-sub-group.dto';
import { UpdateWorkSubGroupDto } from './dto/update-work-sub-group.dto';

@Controller()
export class WorkSubGroupsController {
  constructor(private readonly service: WorkSubGroupsService) {}

  @Post('work-groups/:workGroupId/sub-groups')
  @RequirePermissions('report.create', 'claim_file.update')
  async create(
    @Param('workGroupId') workGroupId: string,
    @Body() dto: CreateWorkSubGroupDto,
  ) {
    const data = await this.service.create(workGroupId, dto);
    return { data };
  }

  @Put('work-sub-groups/:id')
  @RequirePermissions('settings.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateWorkSubGroupDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete('work-sub-groups/:id')
  @RequirePermissions('settings.manage')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
