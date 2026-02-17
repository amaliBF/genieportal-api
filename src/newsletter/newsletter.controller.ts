import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { NewsletterService } from './newsletter.service';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';

@ApiTags('Public - Newsletter')
@Controller('api/public/newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('subscribe')
  @ApiOperation({ summary: 'Newsletter abonnieren (Double-Opt-In)' })
  subscribe(@Body() dto: SubscribeNewsletterDto) {
    return this.newsletterService.subscribe(dto);
  }

  @Get('verify')
  @ApiOperation({ summary: 'Newsletter E-Mail bestaetigen' })
  @ApiQuery({ name: 'token', required: true })
  verify(@Query('token') token: string) {
    return this.newsletterService.verify(token);
  }

  @Get('unsubscribe')
  @ApiOperation({ summary: 'Newsletter abbestellen' })
  @ApiQuery({ name: 'token', required: true })
  unsubscribe(@Query('token') token: string) {
    return this.newsletterService.unsubscribe(token);
  }
}
