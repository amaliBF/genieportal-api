import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { EmailService } from '../email/email.service';
import { ContactFormDto } from './dto/contact-form.dto';

@ApiTags('Public - Kontakt')
@Controller('api/public/contact')
export class ContactController {
  constructor(private readonly emailService: EmailService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Kontaktformular absenden' })
  @Throttle({ short: { limit: 3, ttl: 60000 }, medium: { limit: 5, ttl: 900000 } })
  async submitContactForm(@Body() dto: ContactFormDto) {
    // Send notification to admin
    await this.emailService.sendContactFormEmail(
      dto.name,
      dto.email,
      dto.subject,
      dto.message,
      dto.domain,
    );

    // Send confirmation to sender
    await this.emailService.sendContactConfirmation(
      dto.email,
      dto.name,
      dto.subject,
      dto.domain,
    );

    return {
      success: true,
      message: 'Ihre Nachricht wurde erfolgreich gesendet. Sie erhalten in Kuerze eine Bestaetigung per E-Mail.',
    };
  }
}
