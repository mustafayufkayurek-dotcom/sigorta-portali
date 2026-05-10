import { Controller, Get, Query, Req } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query('q') q: string, @Req() req: any) {
    const user = req.user;
    return this.searchService.globalSearch(q ?? '', user?.id ?? '', user?.roleCode ?? '');
  }
}
