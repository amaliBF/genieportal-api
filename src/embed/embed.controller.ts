import { Controller, Get, Param, Query, Res } from '@nestjs/common';
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
    @Query('layout') layout?: string,
    @Query('bereich') bereich?: string,
    @Query('showFilters') showFilters?: string,
    @Res() res?: any,
  ) {
    const html = await this.embedService.getJobListHtml(key, {
      theme, color,
      limit: limit ? parseInt(limit, 10) : undefined,
      layout: layout || 'list',
      bereich,
      showFilters: showFilters === 'true',
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
    @Query('showApply') showApply?: string,
    @Query('applyText') applyText?: string,
    @Res() res?: any,
  ) {
    const html = await this.embedService.getJobDetailHtml(key, id, {
      theme, color,
      showApply: showApply !== 'false',
      applyText,
    });
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
