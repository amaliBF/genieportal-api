import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { CouponService } from './coupon.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../admin/guards/admin-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RedeemCouponDto } from './dto/redeem-coupon.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD ROUTES (Firmen-Benutzer)
// ═══════════════════════════════════════════════════════════════════════════

@ApiTags('Dashboard - Gutscheine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('company')
export class CouponDashboardController {
  constructor(private couponService: CouponService) {}

  @Post('redeem-coupon')
  @ApiOperation({ summary: 'Gutschein einlösen' })
  async redeemCoupon(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: RedeemCouponDto,
    @Req() req: any,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';
    return this.couponService.redeemCoupon(companyId, dto.code, ip);
  }

  @Get('coupons')
  @ApiOperation({ summary: 'Meine eingelösten Gutscheine' })
  async getMyRedemptions(
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.couponService.getCompanyRedemptions(companyId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════

@ApiTags('Admin - Gutscheine')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin/coupons')
export class CouponAdminController {
  constructor(private couponService: CouponService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Gutscheine auflisten' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: String })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.couponService.findAll(page, limit, search, isActive);
  }

  @Post()
  @ApiOperation({ summary: 'Neuen Gutschein erstellen' })
  async create(@Body() dto: CreateCouponDto) {
    return this.couponService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Gutschein-Details mit Einlösungen' })
  async findOne(@Param('id') id: string) {
    return this.couponService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Gutschein bearbeiten' })
  async update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.couponService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Gutschein deaktivieren' })
  async remove(@Param('id') id: string) {
    return this.couponService.remove(id);
  }
}
