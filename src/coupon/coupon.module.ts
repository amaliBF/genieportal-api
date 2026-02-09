import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CouponService } from './coupon.service';
import { CouponDashboardController, CouponAdminController } from './coupon.controller';

@Module({
  imports: [
    JwtModule.register({}),
  ],
  controllers: [CouponDashboardController, CouponAdminController],
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponModule {}
