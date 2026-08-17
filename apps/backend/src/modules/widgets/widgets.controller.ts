import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { WeatherService } from './weather.service';
import { ExchangeRateService } from './exchange-rate.service';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('widgets')
@ApiBearerAuth()
@Controller()
export class WidgetsController {
  constructor(
    private readonly weatherService: WeatherService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  @Get('widgets/weather')
  @Public()
  @ApiOperation({ summary: 'Hava durumu widget verisi (wttr.in proxy)' })
  @ApiQuery({ name: 'city', required: false, description: 'Şehir adı (default: Istanbul)' })
  async getWeather(@Query('city') city: string = 'Istanbul') {
    const data = await this.weatherService.getWeather(city);
    return { success: true, data };
  }

  @Get('widgets/exchange-rates')
  @Public()
  @ApiOperation({ summary: 'Günlük döviz kurları (TCMB proxy)' })
  async getExchangeRates() {
    const data = await this.exchangeRateService.getExchangeRates();
    return { success: true, data };
  }
}
