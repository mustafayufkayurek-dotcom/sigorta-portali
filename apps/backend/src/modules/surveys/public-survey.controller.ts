import { Controller, Get, Post, Param, Body, Req } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { SurveysService } from './surveys.service';
import { SubmitSurveyDto } from './dto/submit-survey.dto';
import { Request } from 'express';

@Public()
@Controller('public/surveys')
export class PublicSurveyController {
  constructor(private readonly svc: SurveysService) {}

  @Get(':token')
  async view(@Param('token') token: string) {
    return { data: await this.svc.findByToken(token) };
  }

  @Post(':token/submit')
  async submit(
    @Param('token') token: string,
    @Body() dto: SubmitSurveyDto,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip;
    return { data: await this.svc.submitResponse(token, dto, ip) };
  }
}
