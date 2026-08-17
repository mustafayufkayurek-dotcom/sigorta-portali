import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { RevisionRequestsService } from './revision-requests.service';
import {
  CreateRevisionRequestDto,
  UpdateRevisionStatusDto,
  ListRevisionRequestsDto,
  CreateRevisionMessageDto,
  StartRevisionDto,
  CompleteRevisionDto,
} from './dto/revision-requests.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';

@Controller('revision-requests')
export class RevisionRequestsController {
  constructor(private readonly service: RevisionRequestsService) {}

  // POST /api/v1/revision-requests
  @Post()
  @RequirePermissions('claim_file.view')
  async create(
    @Body() dto: CreateRevisionRequestDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.service.create(user.id, dto, user);
    return { data };
  }

  // GET /api/v1/revision-requests
  @Get()
  @RequirePermissions('claim_file.view')
  async findAll(@Query() query: ListRevisionRequestsDto, @CurrentUser() user: any) {
    return this.service.findAll(query, user);
  }

  // GET /api/v1/revision-requests/overdue
  @Get('overdue')
  @RequirePermissions('claim_file.view')
  async getOverdue(@CurrentUser() user: any) {
    return this.service.getOverdue(user);
  }

  // GET /api/v1/revision-requests/:id
  @Get(':id')
  @RequirePermissions('claim_file.view')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  // PATCH /api/v1/revision-requests/:id/status
  @Patch(':id/status')
  @RequirePermissions('claim_file.view')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRevisionStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.service.updateStatus(id, dto, user);
  }

  // POST /api/v1/revision-requests/:id/messages
  @Post(':id/messages')
  @RequirePermissions('claim_file.view')
  async addMessage(
    @Param('id') id: string,
    @Body() dto: CreateRevisionMessageDto,
    @CurrentUser() user: any,
  ) {
    return this.service.addMessage(id, user.id, dto, user);
  }

  // GET /api/v1/revision-requests/:id/messages
  @Get(':id/messages')
  @RequirePermissions('claim_file.view')
  async getMessages(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.getMessages(id, user);
  }

  // POST /api/v1/revision-requests/:id/start-revision
  @Post(':id/start-revision')
  @RequirePermissions('claim_file.view')
  async startRevision(
    @Param('id') id: string,
    @Body() dto: StartRevisionDto,
    @CurrentUser() user: any,
  ) {
    return this.service.startRevision(id, user.id, dto, user);
  }

  // POST /api/v1/revision-requests/:id/complete
  @Post(':id/complete')
  @RequirePermissions('claim_file.view')
  async completeRevision(
    @Param('id') id: string,
    @Body() dto: CompleteRevisionDto,
    @CurrentUser() user: any,
  ) {
    return this.service.completeRevision(id, dto, user);
  }
}
