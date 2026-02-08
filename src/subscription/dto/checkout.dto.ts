import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum CheckoutPlan {
  STARTER = 'STARTER',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum PaymentProvider {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
}

export class CheckoutDto {
  @ApiProperty({
    description: 'Gewuenschter Abo-Plan',
    enum: CheckoutPlan,
    example: 'PRO',
  })
  @IsNotEmpty()
  @IsEnum(CheckoutPlan, {
    message: 'Plan muss STARTER, PRO oder ENTERPRISE sein',
  })
  plan: CheckoutPlan;

  @ApiPropertyOptional({
    description: 'Zahlungsanbieter (Standard: paypal)',
    enum: PaymentProvider,
    example: 'paypal',
  })
  @IsOptional()
  @IsEnum(PaymentProvider, {
    message: 'Provider muss stripe oder paypal sein',
  })
  provider?: PaymentProvider;
}

export class PayPalCaptureDto {
  @ApiProperty({ description: 'PayPal Subscription ID' })
  @IsNotEmpty()
  @IsString()
  subscriptionId: string;
}
