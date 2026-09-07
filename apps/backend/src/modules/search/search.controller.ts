import { Controller, Get, Query, Req } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { SearchService } from './search.service';

class GlobalSearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query() query: GlobalSearchQueryDto, @Req() req: any) {
    const user = req.user;
    return this.searchService.globalSearch(query.q ?? '', user?.id ?? '', user?.roleCode ?? '');
  }
}
