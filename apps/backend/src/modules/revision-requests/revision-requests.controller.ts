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

@Controller('revision-requests')
export class RevisionRequestsController {
  constructor(private readonly service: RevisionRequestsService) {}

  // POST /api/v1/revision-requests
  @Post()
  async create(
    @Body() dto: CreateRevisionRequestDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.service.create(user.id, dto);
    return { data };
  }

  // GET /api/v1/revision-requests
  @Get()
  async findAll(@Query() query: ListRevisionRequestsDto) {
    return this.service.findAll(query);
  }

  // GET /api/v1/revision-requests/overdue
  @Get('overdue')
  async getOverdue() {
    return this.service.getOverdue();
  }

  // GET /api/v1/revision-requests/:id
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // PATCH /api/v1/revision-requests/:id/status
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRevisionStatusDto,
  ) {
    return this.service.updateStatus(id, dto);
  }

  // POST /api/v1/revision-requests/:id/messages
  @Post(':id/messages')
  async addMessage(
    @Param('id') id: string,
    @Body() dto: CreateRevisionMessageDto,
    @CurrentUser() user: any,
  ) {
    return this.service.addMessage(id, user.id, dto);
  }

  // GET /api/v1/revision-requests/:id/messages
  @Get(':id/messages')
  async getMessages(@Param('id') id: string) {
    return this.service.getMessages(id);
  }

  // POST /api/v1/revision-requests/:id/start-revision
  @Post(':id/start-revision')
  async startRevision(
    @Param('id') id: string,
    @Body() dto: StartRevisionDto,
    @CurrentUser() user: any,
  ) {
    return this.service.startRevision(id, user.id, dto);
  }

  // POST /api/v1/revision-requests/:id/complete
  @Post(':id/complete')
  async completeRevision(
    @Param('id') id: string,
    @Body() dto: CompleteRevisionDto,
  ) {
    return this.service.completeRevision(id, dto);
  }
}
