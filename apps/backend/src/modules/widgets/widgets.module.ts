import { Module } from '@nestjs/common';
import { WeatherService } from './weather.service';
import { ExchangeRateService } from './exchange-rate.service';
import { WidgetsController } from './widgets.controller';

@Module({
  providers: [WeatherService, ExchangeRateService],
  controllers: [WidgetsController],
})
export class WidgetsModule {}
