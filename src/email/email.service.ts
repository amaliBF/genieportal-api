import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  baseTemplate,
  ctaButton,
  fallbackLink,
} from './templates/base.template';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly brevoApiKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly replyTo: string;
  private readonly adminEmail: string;
  private readonly appUrl: string;
  private readonly frontendUrl: string;
  private readonly dashboardUrl: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.brevoApiKey = this.configService.get('BREVO_API_KEY') || '';
    this.fromEmail = this.configService.get('EMAIL_FROM') || 'noreply@genieportal.de';
    this.fromName = this.configService.get('EMAIL_FROM_NAME') || 'Genieportal';
    this.replyTo = this.configService.get('EMAIL_REPLY_TO') || 'support@genieportal.de';
    this.adminEmail = this.configService.get('ADMIN_NOTIFICATION_EMAIL') || 'amali+genieportal@butterflies-it.de';
    this.appUrl = this.configService.get('APP_URL') || 'https://api.genieportal.de';
    this.frontendUrl = this.configService.get('FRONTEND_URL') || 'https://genieportal.de';
    this.dashboardUrl = this.configService.get('DASHBOARD_URL') || 'https://dashboard.genieportal.de';

    if (!this.brevoApiKey) {
      this.logger.warn('BREVO_API_KEY ist nicht konfiguriert – E-Mails werden nicht versendet.');
    } else {
      this.logger.log('Brevo API konfiguriert – E-Mail-Versand aktiv');
    }
  }

  // ─── CORE SEND METHOD (Brevo HTTP API) ────────────────────────────────────

  private async send(
    to: string,
    subject: string,
    html: string,
    template = 'unknown',
  ): Promise<boolean> {
    if (!this.brevoApiKey) {
      this.logger.warn(
        `E-Mail an ${to} konnte nicht versendet werden (Brevo API Key fehlt): ${subject}`,
      );
      this.logEmail(to, template, subject, 'FAILED', undefined, 'Brevo API Key nicht konfiguriert').catch(() => {});
      return false;
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': this.brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: this.fromName, email: this.fromEmail },
          to: [{ email: to }],
          replyTo: { email: this.replyTo },
          subject,
          htmlContent: html,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Brevo API ${response.status}: ${errorBody}`);
      }

      const result = await response.json();
      const messageId = result.messageId || result.messageIds?.[0] || undefined;

      this.logger.log(`E-Mail versendet an ${to}: ${subject}`);
      this.logEmail(to, template, subject, 'SENT', messageId).catch(() => {});
      return true;
    } catch (error) {
      this.logger.error(
        `E-Mail-Versand an ${to} fehlgeschlagen: ${error.message}`,
        error.stack,
      );
      this.logEmail(to, template, subject, 'FAILED', undefined, error.message).catch(() => {});
      return false;
    }
  }

  private async logEmail(
    to: string,
    template: string,
    subject: string,
    status: 'SENT' | 'FAILED',
    messageId?: string,
    error?: string,
  ) {
    try {
      await this.prisma.emailLog.create({
        data: { to, template, subject, status, messageId, error },
      });
    } catch (e) {
      this.logger.warn(`EmailLog konnte nicht gespeichert werden: ${(e as Error).message}`);
    }
  }

  // ─── STYLE HELPERS ──────────────────────────────────────────────────────────

  private heading(text: string): string {
    return `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1F2937;line-height:32px;">${text}</h1>`;
  }

  private paragraph(text: string): string {
    return `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#4B5563;">${text}</p>`;
  }

  private greeting(name: string): string {
    return this.paragraph(`Hallo ${name},`);
  }

  private signature(): string {
    return `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td style="padding-top:16px;border-top:1px solid #F3F4F6;">
            <p style="margin:0;font-size:14px;line-height:22px;color:#9CA3AF;">
              Viele Gr&uuml;&szlig;e<br/>
              Dein <span style="color:#6366F1;font-weight:600;">Genieportal</span>-Team
            </p>
          </td>
        </tr>
      </table>`;
  }

  private infoBox(text: string): string {
    return `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
             style="margin:0 0 24px;background-color:#EEF2FF;border-radius:12px;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0;font-size:14px;line-height:22px;color:#4338CA;">${text}</p>
          </td>
        </tr>
      </table>`;
  }

  private wrap(content: string, previewText?: string): string {
    return baseTemplate({
      content,
      previewText,
      frontendUrl: this.frontendUrl,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC EMAIL METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── VERIFICATION EMAIL ─────────────────────────────────────────────────────

  async sendVerificationEmail(
    to: string,
    name: string,
    token: string,
  ): Promise<boolean> {
    const verifyUrl = `${this.frontendUrl}/verify-email?token=${token}`;

    const html = this.wrap(
      [
        this.heading('E-Mail-Adresse best&auml;tigen'),
        this.greeting(name),
        this.paragraph(
          'Vielen Dank f&uuml;r deine Registrierung bei Genie! ' +
          'Bitte best&auml;tige deine E-Mail-Adresse, damit du alle Funktionen nutzen kannst.',
        ),
        ctaButton('E-Mail best&auml;tigen', verifyUrl),
        fallbackLink(verifyUrl),
        this.infoBox(
          'Dieser Link ist aus Sicherheitsgr&uuml;nden <strong>24 Stunden</strong> g&uuml;ltig. ' +
          'Falls du dich nicht bei Genie registriert hast, kannst du diese E-Mail ignorieren.',
        ),
        this.signature(),
      ].join('\n'),
      'Bitte bestaetige deine E-Mail-Adresse fuer Genie',
    );

    return this.send(to, 'Bitte bestaetige deine E-Mail-Adresse', html, 'email-verification');
  }

  // ─── WELCOME EMAIL ──────────────────────────────────────────────────────────

  async sendWelcomeEmail(to: string, name: string): Promise<boolean> {
    const dashboardUrl = `${this.frontendUrl}/dashboard`;

    const html = this.wrap(
      [
        this.heading('Willkommen bei Genie! &#127881;'),
        this.greeting(name),
        this.paragraph(
          'Deine E-Mail wurde erfolgreich best&auml;tigt. ' +
          'Wir freuen uns, dass du dabei bist!',
        ),
        this.paragraph(
          'Hier sind deine n&auml;chsten Schritte:',
        ),
        `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 24px;">
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #F3F4F6;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width:36px;height:36px;border-radius:50%;background-color:#EEF2FF;text-align:center;vertical-align:middle;">
                    <span style="color:#6366F1;font-weight:700;font-size:14px;">1</span>
                  </td>
                  <td style="padding-left:14px;">
                    <p style="margin:0;font-size:15px;line-height:22px;color:#1F2937;font-weight:600;">Profil vervollst&auml;ndigen</p>
                    <p style="margin:2px 0 0;font-size:13px;line-height:20px;color:#6B7280;">Erz&auml;hle uns mehr &uuml;ber dich und deine Interessen.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #F3F4F6;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width:36px;height:36px;border-radius:50%;background-color:#EEF2FF;text-align:center;vertical-align:middle;">
                    <span style="color:#6366F1;font-weight:700;font-size:14px;">2</span>
                  </td>
                  <td style="padding-left:14px;">
                    <p style="margin:0;font-size:15px;line-height:22px;color:#1F2937;font-weight:600;">Video aufnehmen</p>
                    <p style="margin:2px 0 0;font-size:13px;line-height:20px;color:#6B7280;">Stelle dich mit einem kurzen Video vor &ndash; so f&auml;llst du auf!</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width:36px;height:36px;border-radius:50%;background-color:#EEF2FF;text-align:center;vertical-align:middle;">
                    <span style="color:#6366F1;font-weight:700;font-size:14px;">3</span>
                  </td>
                  <td style="padding-left:14px;">
                    <p style="margin:0;font-size:15px;line-height:22px;color:#1F2937;font-weight:600;">Unternehmen entdecken</p>
                    <p style="margin:2px 0 0;font-size:13px;line-height:20px;color:#6B7280;">Swipe durch Ausbildungspl&auml;tze und finde deinen Match.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>`,
        ctaButton('Zum Dashboard', dashboardUrl),
        this.signature(),
      ].join('\n'),
      'Willkommen bei Genie – dein Account ist bereit!',
    );

    return this.send(to, 'Willkommen bei Genie!', html, 'welcome');
  }

  // ─── PASSWORD RESET EMAIL ──────────────────────────────────────────────────

  async sendPasswordResetEmail(
    to: string,
    name: string,
    token: string,
  ): Promise<boolean> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;

    const html = this.wrap(
      [
        this.heading('Passwort zur&uuml;cksetzen'),
        this.greeting(name),
        this.paragraph(
          'Du hast angefordert, dein Passwort zur&uuml;ckzusetzen. ' +
          'Klicke auf den Button, um ein neues Passwort zu vergeben:',
        ),
        ctaButton('Neues Passwort vergeben', resetUrl),
        fallbackLink(resetUrl),
        this.infoBox(
          'Dieser Link ist aus Sicherheitsgr&uuml;nden <strong>1 Stunde</strong> g&uuml;ltig. ' +
          'Falls du kein neues Passwort angefordert hast, ignoriere diese E-Mail &ndash; ' +
          'dein Passwort bleibt unver&auml;ndert.',
        ),
        this.signature(),
      ].join('\n'),
      'Setze dein Passwort fuer Genie zurueck',
    );

    return this.send(to, 'Passwort zuruecksetzen', html, 'password-reset');
  }

  // ─── NEW MATCH NOTIFICATION ─────────────────────────────────────────────────

  async sendNewMatchNotification(
    to: string,
    userName: string,
    companyName: string,
  ): Promise<boolean> {
    const matchesUrl = `${this.frontendUrl}/matches`;

    const html = this.wrap(
      [
        this.heading('Neuer Match! &#127881;'),
        this.greeting(userName),
        this.paragraph(
          `Gro&szlig;artige Neuigkeiten! <strong>${this.escapeHtml(companyName)}</strong> ` +
          'und du habt ein Match! Das bedeutet, dass das Unternehmen ebenfalls Interesse an dir zeigt.',
        ),
        this.paragraph(
          'Ihr k&ouml;nnt jetzt &uuml;ber den Chat miteinander in Kontakt treten. ' +
          'Nutze die Gelegenheit und starte das Gespr&auml;ch!',
        ),
        ctaButton('Match ansehen', matchesUrl, '#EC4899'),
        this.signature(),
      ].join('\n'),
      `Du hast ein Match mit ${companyName}!`,
    );

    return this.send(to, `Neuer Match mit ${companyName}!`, html, 'new-match');
  }

  // ─── NEW MESSAGE NOTIFICATION ───────────────────────────────────────────────

  async sendNewMessageNotification(
    to: string,
    name: string,
    senderName: string,
  ): Promise<boolean> {
    const chatUrl = `${this.frontendUrl}/chat`;

    const html = this.wrap(
      [
        this.heading('Neue Nachricht'),
        this.greeting(name),
        this.paragraph(
          `<strong>${this.escapeHtml(senderName)}</strong> hat dir eine neue Nachricht geschrieben.`,
        ),
        this.paragraph(
          '&Ouml;ffne den Chat, um die Nachricht zu lesen und zu antworten.',
        ),
        ctaButton('Chat &ouml;ffnen', chatUrl),
        this.signature(),
      ].join('\n'),
      `Neue Nachricht von ${senderName}`,
    );

    return this.send(to, `Neue Nachricht von ${senderName}`, html, 'new-message');
  }

  // ─── COMPANY: NEW CANDIDATE NOTIFICATION ────────────────────────────────────

  async sendCompanyNewCandidateEmail(
    to: string,
    companyName: string,
    candidateName: string,
  ): Promise<boolean> {
    const candidatesUrl = `${this.frontendUrl}/company/candidates`;

    const html = this.wrap(
      [
        this.heading('Neuer Kandidat interessiert!'),
        this.greeting(companyName),
        this.paragraph(
          `<strong>${this.escapeHtml(candidateName)}</strong> hat Interesse an eurem ` +
          'Unternehmen gezeigt. Schaut euch das Profil an und entscheidet, ' +
          'ob ihr ebenfalls interessiert seid!',
        ),
        this.paragraph(
          'Wenn ihr auch Interesse zeigt, entsteht ein Match und ihr k&ouml;nnt &uuml;ber den Chat in Kontakt treten.',
        ),
        ctaButton('Kandidat ansehen', candidatesUrl),
        this.signature(),
      ].join('\n'),
      `${candidateName} hat Interesse an eurem Unternehmen!`,
    );

    return this.send(
      to,
      `Neuer Kandidat: ${candidateName} interessiert sich fuer euch!`,
      html,
      'new-candidate',
    );
  }

  // ─── TEAM INVITE EMAIL ──────────────────────────────────────────────────────

  async sendTeamInviteEmail(
    to: string,
    companyName: string,
    inviterName: string,
    inviteToken: string,
  ): Promise<boolean> {
    const inviteUrl = `${this.frontendUrl}/invite?token=${inviteToken}`;

    const html = this.wrap(
      [
        this.heading('Team-Einladung'),
        this.paragraph(`Hallo,`),
        this.paragraph(
          `<strong>${this.escapeHtml(inviterName)}</strong> hat dich eingeladen, dem Team von ` +
          `<strong>${this.escapeHtml(companyName)}</strong> auf Genie beizutreten.`,
        ),
        this.paragraph(
          'Klicke auf den Button, um die Einladung anzunehmen und dein Konto einzurichten:',
        ),
        ctaButton('Einladung annehmen', inviteUrl),
        fallbackLink(inviteUrl),
        this.infoBox(
          'Diese Einladung ist <strong>7 Tage</strong> g&uuml;ltig. ' +
          'Falls du diese Einladung nicht erwartet hast, kannst du diese E-Mail einfach ignorieren.',
        ),
        this.signature(),
      ].join('\n'),
      `${inviterName} laedt dich zum Team von ${companyName} ein`,
    );

    return this.send(
      to,
      `Einladung: Tritt dem Team von ${companyName} bei`,
      html,
      'team-invite',
    );
  }

  // ─── PAYMENT SUCCESS EMAIL ──────────────────────────────────────────────────

  async sendPaymentSuccessEmail(
    to: string,
    companyName: string,
    planName: string,
    price: string,
  ): Promise<boolean> {
    const html = this.wrap(
      [
        this.heading('Zahlung erfolgreich &#9989;'),
        this.greeting(companyName),
        this.paragraph(
          `Vielen Dank f&uuml;r Ihr Abonnement! Ihre Zahlung f&uuml;r den ` +
          `<strong>${this.escapeHtml(planName)}</strong>-Plan (${this.escapeHtml(price)} EUR/Monat) ` +
          `wurde erfolgreich verarbeitet.`,
        ),
        this.paragraph(
          'Ihr Plan ist ab sofort aktiv. Sie k&ouml;nnen jetzt alle Funktionen Ihres Plans nutzen.',
        ),
        ctaButton('Zum Dashboard', this.dashboardUrl),
        this.infoBox(
          'Sie k&ouml;nnen Ihr Abonnement jederzeit in den Einstellungen verwalten oder k&uuml;ndigen.',
        ),
        this.signature(),
      ].join('\n'),
      `Zahlungsbestaetigung fuer ${planName}-Plan`,
    );

    return this.send(to, `Zahlungsbestaetigung: ${planName}-Plan aktiviert`, html, 'payment-success');
  }

  // ─── PAYMENT FAILED EMAIL ────────────────────────────────────────────────────

  async sendPaymentFailedEmail(
    to: string,
    companyName: string,
    planName: string,
  ): Promise<boolean> {
    const html = this.wrap(
      [
        this.heading('Zahlung fehlgeschlagen'),
        this.greeting(companyName),
        this.paragraph(
          `Die Zahlung f&uuml;r Ihren <strong>${this.escapeHtml(planName)}</strong>-Plan ` +
          `konnte leider nicht verarbeitet werden.`,
        ),
        this.paragraph(
          'Bitte &uuml;berpr&uuml;fen Sie Ihre Zahlungsmethode in den Einstellungen. ' +
          'Falls das Problem weiterhin besteht, kontaktieren Sie uns unter ' +
          `<a href="mailto:${this.replyTo}" style="color:#6366F1;">${this.replyTo}</a>.`,
        ),
        ctaButton('Zahlungsmethode pr&uuml;fen', `${this.dashboardUrl}/settings`),
        this.infoBox(
          'Ihr Zugang bleibt vorerst bestehen. Bitte aktualisieren Sie Ihre Zahlungsmethode innerhalb von 7 Tagen.',
        ),
        this.signature(),
      ].join('\n'),
      'Zahlung fehlgeschlagen – bitte Zahlungsmethode pruefen',
    );

    return this.send(to, 'Zahlung fehlgeschlagen – Aktion erforderlich', html, 'payment-failed');
  }

  // ─── ADMIN NEW REGISTRATION EMAIL ────────────────────────────────────────────

  async sendAdminNewRegistrationEmail(
    companyName: string,
    companyEmail: string,
    city: string,
    plan: string,
  ): Promise<boolean> {
    const html = this.wrap(
      [
        this.heading('Neue Betriebe-Registrierung'),
        this.paragraph(`Hallo Admin,`),
        this.paragraph(
          'Es gibt eine neue Registrierung auf Genie:',
        ),
        `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
               style="margin:0 0 24px;background-color:#F9FAFB;border-radius:12px;border:1px solid #E5E7EB;">
          <tr>
            <td style="padding:20px;">
              <p style="margin:0 0 8px;font-size:14px;color:#6B7280;">Firmenname</p>
              <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#1F2937;">${this.escapeHtml(companyName)}</p>
              <p style="margin:0 0 8px;font-size:14px;color:#6B7280;">E-Mail</p>
              <p style="margin:0 0 16px;font-size:16px;color:#1F2937;">${this.escapeHtml(companyEmail)}</p>
              <p style="margin:0 0 8px;font-size:14px;color:#6B7280;">Stadt</p>
              <p style="margin:0 0 16px;font-size:16px;color:#1F2937;">${this.escapeHtml(city || 'Nicht angegeben')}</p>
              <p style="margin:0 0 8px;font-size:14px;color:#6B7280;">Gew&auml;hlter Plan</p>
              <p style="margin:0;font-size:16px;font-weight:600;color:#6366F1;">${this.escapeHtml(plan)}</p>
            </td>
          </tr>
        </table>`,
        ctaButton('Im Admin-Panel ansehen', 'https://admin.genieportal.de'),
        this.signature(),
      ].join('\n'),
      `Neue Registrierung: ${companyName}`,
    );

    return this.send(this.adminEmail, `Neue Registrierung: ${companyName}`, html, 'admin-new-registration');
  }

  // ─── PASSWORD CHANGED EMAIL ─────────────────────────────────────────────────

  async sendPasswordChangedEmail(
    to: string,
    name: string,
  ): Promise<boolean> {
    const html = this.wrap(
      [
        this.heading('Passwort ge&auml;ndert'),
        this.greeting(name),
        this.paragraph(
          'Dein Passwort wurde erfolgreich ge&auml;ndert.',
        ),
        this.infoBox(
          'Falls du diese &Auml;nderung nicht selbst vorgenommen hast, kontaktiere uns bitte sofort unter ' +
          `<a href="mailto:${this.replyTo}" style="color:#4338CA;">${this.replyTo}</a>.`,
        ),
        this.signature(),
      ].join('\n'),
      'Dein Passwort wurde geaendert',
    );

    return this.send(to, 'Dein Passwort wurde geaendert', html, 'password-changed');
  }

  // ─── SUBSCRIPTION CONFIRMED EMAIL ─────────────────────────────────────────

  async sendSubscriptionConfirmedEmail(
    to: string,
    companyName: string,
    planName: string,
    price: string,
    period: string,
  ): Promise<boolean> {
    const html = this.wrap(
      [
        this.heading('Abonnement best&auml;tigt &#9989;'),
        this.greeting(companyName),
        this.paragraph(
          `Ihr <strong>${this.escapeHtml(planName)}</strong>-Abonnement (${this.escapeHtml(price)} EUR/Monat) ` +
          `ist ab sofort aktiv.`,
        ),
        this.paragraph(
          `Laufzeit: <strong>${this.escapeHtml(period)}</strong>`,
        ),
        this.paragraph(
          'Sie k&ouml;nnen jetzt alle Funktionen Ihres Plans nutzen.',
        ),
        ctaButton('Zum Dashboard', this.dashboardUrl),
        this.signature(),
      ].join('\n'),
      `Abonnement ${planName} bestaetigt`,
    );

    return this.send(to, `Abonnement ${planName} bestaetigt`, html, 'subscription-confirmed');
  }

  // ─── SUBSCRIPTION EXPIRING EMAIL ──────────────────────────────────────────

  async sendSubscriptionExpiringEmail(
    to: string,
    companyName: string,
    planName: string,
    expiresAt: string,
  ): Promise<boolean> {
    const html = this.wrap(
      [
        this.heading('Abonnement l&auml;uft bald ab'),
        this.greeting(companyName),
        this.paragraph(
          `Ihr <strong>${this.escapeHtml(planName)}</strong>-Abonnement l&auml;uft am ` +
          `<strong>${this.escapeHtml(expiresAt)}</strong> ab.`,
        ),
        this.paragraph(
          'Um weiterhin alle Funktionen nutzen zu k&ouml;nnen, verl&auml;ngern Sie Ihr Abonnement.',
        ),
        ctaButton('Abonnement verl&auml;ngern', `${this.dashboardUrl}/settings`),
        this.signature(),
      ].join('\n'),
      `Abonnement ${planName} laeuft bald ab`,
    );

    return this.send(to, `Ihr Abonnement laeuft am ${expiresAt} ab`, html, 'subscription-expiring');
  }

  // ─── JOB PUBLISHED EMAIL ──────────────────────────────────────────────────

  async sendJobPublishedEmail(
    to: string,
    companyName: string,
    jobTitle: string,
    jobUrl: string,
  ): Promise<boolean> {
    const html = this.wrap(
      [
        this.heading('Stelle ver&ouml;ffentlicht &#127881;'),
        this.greeting(companyName),
        this.paragraph(
          `Ihre Stelle <strong>${this.escapeHtml(jobTitle)}</strong> ist jetzt live und ` +
          'f&uuml;r Bewerber sichtbar.',
        ),
        ctaButton('Stelle ansehen', jobUrl),
        this.infoBox(
          'Tipp: Laden Sie ein Video hoch, um mehr Bewerber anzuziehen!',
        ),
        this.signature(),
      ].join('\n'),
      `Stelle ${jobTitle} ist jetzt live`,
    );

    return this.send(to, `Stelle veroeffentlicht: ${jobTitle}`, html, 'job-published');
  }

  // ─── JOB EXPIRING EMAIL ───────────────────────────────────────────────────

  async sendJobExpiringEmail(
    to: string,
    companyName: string,
    jobTitle: string,
    expiresAt: string,
  ): Promise<boolean> {
    const html = this.wrap(
      [
        this.heading('Stelle l&auml;uft bald ab'),
        this.greeting(companyName),
        this.paragraph(
          `Ihre Stelle <strong>${this.escapeHtml(jobTitle)}</strong> l&auml;uft am ` +
          `<strong>${this.escapeHtml(expiresAt)}</strong> ab.`,
        ),
        this.paragraph(
          'Verl&auml;ngern Sie die Stelle, um weiterhin Bewerber zu erreichen.',
        ),
        ctaButton('Stelle verwalten', `${this.dashboardUrl}/jobs`),
        this.signature(),
      ].join('\n'),
      `Stelle ${jobTitle} laeuft bald ab`,
    );

    return this.send(to, `Stelle laeuft ab: ${jobTitle}`, html, 'job-expiring');
  }

  // ─── ADMIN: VIDEO MODERATION EMAIL ────────────────────────────────────────

  async sendAdminVideoModerationEmail(
    companyName: string,
    videoTitle: string,
  ): Promise<boolean> {
    const html = this.wrap(
      [
        this.heading('Video wartet auf Moderation'),
        this.paragraph('Hallo Admin,'),
        this.paragraph(
          `<strong>${this.escapeHtml(companyName)}</strong> hat ein neues Video hochgeladen:`,
        ),
        this.paragraph(
          `<strong>${this.escapeHtml(videoTitle || 'Ohne Titel')}</strong>`,
        ),
        ctaButton('Video moderieren', 'https://admin.genieportal.de/videos'),
        this.signature(),
      ].join('\n'),
      `Video von ${companyName} wartet auf Moderation`,
    );

    return this.send(this.adminEmail, `Video-Moderation: ${companyName}`, html, 'admin-video-moderation');
  }

  // ─── CONTACT FORM EMAIL ───────────────────────────────────────────────────

  async sendContactFormEmail(
    senderName: string,
    senderEmail: string,
    subject: string,
    message: string,
    portal?: string,
  ): Promise<boolean> {
    const html = this.wrap(
      [
        this.heading('Neue Kontaktanfrage'),
        this.paragraph('Hallo Admin,'),
        this.paragraph(
          'Es ist eine neue Kontaktanfrage eingegangen:',
        ),
        `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
               style="margin:0 0 24px;background-color:#F9FAFB;border-radius:12px;border:1px solid #E5E7EB;">
          <tr>
            <td style="padding:20px;">
              <p style="margin:0 0 8px;font-size:14px;color:#6B7280;">Name</p>
              <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#1F2937;">${this.escapeHtml(senderName)}</p>
              <p style="margin:0 0 8px;font-size:14px;color:#6B7280;">E-Mail</p>
              <p style="margin:0 0 16px;font-size:16px;color:#1F2937;">
                <a href="mailto:${this.escapeHtml(senderEmail)}" style="color:#6366F1;">${this.escapeHtml(senderEmail)}</a>
              </p>
              ${portal ? `<p style="margin:0 0 8px;font-size:14px;color:#6B7280;">Portal</p>
              <p style="margin:0 0 16px;font-size:16px;color:#1F2937;">${this.escapeHtml(portal)}</p>` : ''}
              <p style="margin:0 0 8px;font-size:14px;color:#6B7280;">Betreff</p>
              <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#1F2937;">${this.escapeHtml(subject)}</p>
              <p style="margin:0 0 8px;font-size:14px;color:#6B7280;">Nachricht</p>
              <p style="margin:0;font-size:15px;line-height:24px;color:#1F2937;white-space:pre-wrap;">${this.escapeHtml(message)}</p>
            </td>
          </tr>
        </table>`,
        this.signature(),
      ].join('\n'),
      `Kontaktanfrage von ${senderName}`,
    );

    return this.send(this.adminEmail, `Kontaktanfrage: ${subject}`, html, 'contact-form');
  }

  // ─── PLAN EXPIRED EMAIL ──────────────────────────────────────────────────

  async sendPlanExpiredEmail(
    to: string,
    companyName: string,
  ): Promise<boolean> {
    const html = this.wrap(
      [
        this.heading('Ihr Premium-Plan ist abgelaufen'),
        this.greeting(companyName),
        this.paragraph(
          'Ihr Premium-Plan bei Genie ist abgelaufen. Ihr Konto wurde auf den kostenlosen Plan zur&uuml;ckgestuft.',
        ),
        this.paragraph(
          'Um weiterhin alle Premium-Funktionen nutzen zu k&ouml;nnen, verl&auml;ngern Sie Ihr Abonnement oder l&ouml;sen Sie einen neuen Gutschein-Code ein.',
        ),
        ctaButton('Plan erneuern', `${this.dashboardUrl}/settings`),
        this.infoBox(
          'Ihre Stellen und Daten bleiben erhalten. Einige Funktionen sind im kostenlosen Plan jedoch eingeschr&auml;nkt.',
        ),
        this.signature(),
      ].join('\n'),
      'Ihr Premium-Plan ist abgelaufen',
    );

    return this.send(to, 'Ihr Premium-Plan ist abgelaufen', html, 'plan-expired');
  }

  // ─── PLAN EXPIRING EMAIL ────────────────────────────────────────────────────

  async sendPlanExpiringEmail(
    to: string,
    companyName: string,
    expiresAt: string,
  ): Promise<boolean> {
    const html = this.wrap(
      [
        this.heading('Ihr Plan l&auml;uft bald ab'),
        this.greeting(companyName),
        this.paragraph(
          `Ihr Premium-Plan bei Genie l&auml;uft am <strong>${this.escapeHtml(expiresAt)}</strong> ab.`,
        ),
        this.paragraph(
          'Verl&auml;ngern Sie Ihr Abonnement oder l&ouml;sen Sie einen neuen Gutschein ein, ' +
          'um weiterhin alle Premium-Funktionen zu nutzen.',
        ),
        ctaButton('Plan verl&auml;ngern', `${this.dashboardUrl}/settings`),
        this.signature(),
      ].join('\n'),
      'Ihr Premium-Plan laeuft bald ab',
    );

    return this.send(to, `Ihr Plan laeuft am ${expiresAt} ab`, html, 'plan-expiring');
  }

  // ─── APPLICATION CONFIRMATION (an Bewerber) ────────────────────────────────

  async sendApplicationConfirmation(
    to: string,
    bewerberName: string,
    jobTitle: string,
    companyName: string,
  ): Promise<boolean> {
    const html = this.wrap(
      [
        this.heading('Bewerbung eingegangen &#9989;'),
        this.greeting(bewerberName),
        this.paragraph(
          `Vielen Dank f&uuml;r deine Bewerbung auf die Stelle <strong>${this.escapeHtml(jobTitle)}</strong> ` +
          `bei <strong>${this.escapeHtml(companyName)}</strong>.`,
        ),
        this.paragraph(
          'Deine Bewerbung wurde erfolgreich &uuml;bermittelt. Das Unternehmen wird sich in K&uuml;rze bei dir melden.',
        ),
        this.infoBox(
          'Tipp: Lade die Genie-App und erhalte Push-Benachrichtigungen zu deiner Bewerbung!',
        ),
        this.signature(),
      ].join('\n'),
      `Bewerbung bei ${companyName} eingegangen`,
    );

    return this.send(to, `Bewerbung eingegangen: ${jobTitle}`, html, 'application-confirmation');
  }

  // ─── NEW APPLICATION NOTIFICATION (an Firma) ──────────────────────────────

  async sendNewApplicationNotification(
    to: string,
    companyName: string,
    bewerberName: string,
    jobTitle: string,
    dashboardUrl: string,
  ): Promise<boolean> {
    const html = this.wrap(
      [
        this.heading('Neue Bewerbung! &#128233;'),
        this.greeting(companyName),
        this.paragraph(
          `<strong>${this.escapeHtml(bewerberName)}</strong> hat sich auf die Stelle ` +
          `<strong>${this.escapeHtml(jobTitle)}</strong> beworben.`,
        ),
        this.paragraph(
          'Schauen Sie sich die Bewerbung im Dashboard an und nehmen Sie Kontakt auf.',
        ),
        ctaButton('Bewerbung ansehen', dashboardUrl),
        this.signature(),
      ].join('\n'),
      `Neue Bewerbung von ${bewerberName}`,
    );

    return this.send(to, `Neue Bewerbung: ${bewerberName} für ${jobTitle}`, html, 'new-application');
  }

  // ─── UTILITIES ──────────────────────────────────────────────────────────────

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
