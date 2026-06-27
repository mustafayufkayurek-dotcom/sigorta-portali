import { Controller, Get, Post, Put, Body, Patch, Param, Delete, Query, UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { BulkDeleteUsersDto, NormalizedScreenPermission, UpdateInsuranceCompanyScopesDto, UpdateScreenPermissionsDto } from './users.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('user.view')
  @ApiOperation({ summary: 'Tüm kullanıcıları listele' })
  async findAll(@Query() query: any) {
    const result = await this.usersService.findAll(query);
    return { success: true, data: result.data, meta: result.meta };
  }

  @Get(':id')
  @RequirePermissions('user.view')
  @ApiOperation({ summary: 'Kullanıcı detayı' })
  async findOne(@Param('id') id: string) {
    const data = await this.usersService.findOne(id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('user.create')
  @ApiOperation({ summary: 'Yeni kullanıcı oluştur' })
  async create(@Body() createUserDto: any) {
    const data = await this.usersService.create(createUserDto);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('user.update')
  @ApiOperation({ summary: 'Kullanıcı güncelle' })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: any,
    @CurrentUser() currentUser: any,
  ) {
    if (
      currentUser?.id === id &&
      updateUserDto.status === 'inactive'
    ) {
      throw new BadRequestException('Kendi hesabınızı pasife alamazsınız');
    }
    const data = await this.usersService.update(id, updateUserDto);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('user.delete')
  @ApiOperation({ summary: 'Kullanıcı arşivle' })
  async remove(@Param('id') id: string, @CurrentUser() currentUser: any) {
    const data = await this.usersService.archiveUser(id, currentUser?.id);
    return { success: true, data };
  }

  @Post(':id/reactivate')
  @RequirePermissions('user.update')
  @ApiOperation({ summary: 'Arşivlenmiş kullanıcıyı yeniden aktifleştir' })
  async reactivate(@Param('id') id: string, @CurrentUser() currentUser: any) {
    const data = await this.usersService.reactivateUser(id, currentUser?.id);
    return { success: true, data };
  }

  @Delete(':id/permanent')
  @RequirePermissions('user.delete')
  @ApiOperation({ summary: 'Arşivlenmiş kullanıcıyı kalıcı sil' })
  async permanentDelete(@Param('id') id: string, @CurrentUser() currentUser: any) {
    const roleCode = String(currentUser?.role?.code ?? currentUser?.roleCode ?? '').toUpperCase();
    if (roleCode !== 'ADMIN') {
      throw new BadRequestException('Kalıcı silme yalnızca admin kullanıcılar tarafından yapılabilir');
    }
    const data = await this.usersService.permanentDelete(id, currentUser?.id);
    return { success: true, data };
  }

  @Post('bulk-delete')
  @RequirePermissions('user.delete')
  @ApiOperation({ summary: 'Toplu kullanıcı sil' })
  async bulkDelete(
    @Body() dto: BulkDeleteUsersDto,
    @CurrentUser() currentUser: any,
  ) {
    const roleCode = String(currentUser?.role?.code ?? currentUser?.roleCode ?? '').toUpperCase();
    if (roleCode !== 'ADMIN') {
      throw new BadRequestException('Bu işlem yalnızca admin kullanıcılar tarafından yapılabilir');
    }
    const data = await this.usersService.bulkDelete(dto.ids, currentUser?.id);
    return { success: true, data };
  }

  @Put(':id')
  @RequirePermissions('user.update')
  @ApiOperation({ summary: 'Kullanıcı güncelle (PUT)' })
  async updatePut(
    @Param('id') id: string,
    @Body() updateUserDto: any,
    @CurrentUser() currentUser: any,
  ) {
    if (
      currentUser?.id === id &&
      updateUserDto.status === 'inactive'
    ) {
      throw new BadRequestException('Kendi hesabınızı pasife alamazsınız');
    }
    const data = await this.usersService.update(id, updateUserDto);
    return { success: true, data };
  }

  @Post(':id/temporary-password')
  @RequirePermissions('user.update')
  @ApiOperation({ summary: 'Mevcut kullanıcı için geçici şifre üret' })
  async issueTemporaryPassword(
    @Param('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    const roleCode = String(currentUser?.roleCode ?? currentUser?.role?.code ?? '').toUpperCase();
    if (roleCode !== 'ADMIN') {
      throw new ForbiddenException('Geçici şifre yalnızca admin kullanıcı tarafından üretilebilir');
    }
    if ((currentUser?.id ?? currentUser?.userId) === id) {
      throw new BadRequestException('Kendi hesabınız için geçici şifre üretemezsiniz');
    }
    const data = await this.usersService.issueTemporaryPassword(id, currentUser);
    return { success: true, data };
  }

  @Post('me/expo-push-token')
  @ApiOperation({ summary: 'Expo push token kaydet' })
  async saveExpoPushToken(
    @Body('token') token: string,
    @CurrentUser() user: any,
  ) {
    const data = await this.usersService.saveExpoPushToken(user.id, token);
    return { success: true, data };
  }

  @Get(':id/service-areas')
  @RequirePermissions('user.view')
  @ApiOperation({ summary: 'Kullanıcı hizmet bölgelerini getir' })
  async getServiceAreas(@Param('id') id: string) {
    const data = await this.usersService.getServiceAreas(id);
    return { success: true, data };
  }

  @Patch(':id/service-areas')
  @RequirePermissions('user.update')
  @ApiOperation({ summary: 'Kullanıcı hizmet bölgelerini güncelle' })
  async updateServiceAreas(
    @Param('id') id: string,
    @Body() dto: { serviceAreas: Array<{ provinceId: string; districtId?: string }> },
  ) {
    const data = await this.usersService.updateServiceAreas(id, dto.serviceAreas);
    return { success: true, data };
  }

  // ── Ekran İzinleri ─────────────────────────────────────────────────────────

  @Get('me/permissions')
  @ApiOperation({ summary: 'Mevcut kullanıcının ekran izinlerini getir' })
  async getMyPermissions(@CurrentUser() user: any) {
    const roleCode = user?.role?.code ?? user?.roleCode ?? '';
    const data = await this.usersService.getMyPermissions(user.id, roleCode);
    return { success: true, data };
  }

  @Get(':id/screen-permissions')
  @RequirePermissions('user.view')
  @ApiOperation({ summary: 'Kullanıcı ekran izin matrisini getir (admin)' })
  async getScreenPermissions(@Param('id') id: string, @Query('roleCode') roleCode: string) {
    const data = await this.usersService.getScreenPermissionsForUser(id, roleCode ?? '');
    return { success: true, data };
  }

  @Put(':id/screen-permissions')
  @RequirePermissions('user.update')
  @ApiOperation({ summary: 'Kullanıcı ekran izinlerini güncelle (admin)' })
  async upsertScreenPermissions(
    @Param('id') id: string,
    @Body() dto: UpdateScreenPermissionsDto,
  ) {
    const payloadScreens = dto.normalizedScreens ?? dto.screens ?? dto.screenPermissions ?? [];
    const normalizedScreens: NormalizedScreenPermission[] = payloadScreens
      .map((screen) => ({
        code: screen.code ?? screen.screenCode ?? '',
        canView: screen.canView,
        canEdit: screen.canEdit,
      }))
      .filter((screen) => screen.code.length > 0);
    const data = await this.usersService.upsertScreenPermissions(id, normalizedScreens);
    return { success: true, data };
  }

  @Put(':id/insurance-company-scopes')
  @RequirePermissions('user.update')
  @ApiOperation({ summary: 'Kullanıcı sigorta şirketi kapsamlarını güncelle (admin)' })
  async updateInsuranceCompanyScopes(
    @Param('id') id: string,
    @Body() dto: UpdateInsuranceCompanyScopesDto,
  ) {
    const data = await this.usersService.updateInsuranceCompanyScopes(id, dto.insuranceCompanyIds ?? []);
    return { success: true, data };
  }
}
