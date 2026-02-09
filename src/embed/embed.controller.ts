import { Controller, Get, Param, Query, Res, Header } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { EmbedService } from './embed.service';

@ApiTags('Embed Widgets')
@SkipThrottle()
@Controller('embed')
export class EmbedController {
  constructor(private embedService: EmbedService) {}

  @Get('jobs')
  @ApiOperation({ summary: 'Stellenliste Widget (HTML)' })
  async jobList(
    @Query('key') key: string,
    @Query('theme') theme?: string,
    @Query('color') color?: string,
    @Query('limit') limit?: string,
    @Res() res?: any,
  ) {
    const html = await this.embedService.getJobListHtml(key, {
      theme, color, limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(html);
  }

  @Get('job/:id')
  @ApiOperation({ summary: 'Einzelne Stelle Widget (HTML)' })
  async jobDetail(
    @Param('id') id: string,
    @Query('key') key: string,
    @Query('theme') theme?: string,
    @Query('color') color?: string,
    @Res() res?: any,
  ) {
    const html = await this.embedService.getJobDetailHtml(key, id, { theme, color });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(html);
  }

  @Get('apply/:id')
  @ApiOperation({ summary: 'Bewerbungsformular Widget (HTML)' })
  async applyForm(
    @Param('id') id: string,
    @Query('key') key: string,
    @Query('theme') theme?: string,
    @Query('color') color?: string,
    @Res() res?: any,
  ) {
    const html = await this.embedService.getApplyFormHtml(key, id, { theme, color });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(html);
  }
}
