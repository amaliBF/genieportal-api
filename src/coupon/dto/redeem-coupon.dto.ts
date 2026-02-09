import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RedeemCouponDto {
  @ApiProperty({ example: 'GENIE-START-2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;
}
