/**
 * Rendert alle Email-Templates als HTML-Preview-Dateien.
 * Aufruf: npx ts-node scripts/render-email-previews.ts
 * Dateien landen in: /var/www/vhosts/genieportal.de/api.genieportal.de/email-previews/
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  baseTemplate,
  ctaButton,
  fallbackLink,
} from '../src/email/templates/base.template';

const OUTPUT_DIR = path.join(__dirname, '..', 'email-previews');
const FRONTEND_URL = 'https://genieportal.de';
const DASHBOARD_URL = 'https://dashboard.genieportal.de';

// ─── HELPERS (gleich wie in EmailService) ────────────────────────────────────

function heading(text: string): string {
  return `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1F2937;line-height:32px;">${text}</h1>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#4B5563;">${text}</p>`;
}

function greeting(name: string): string {
  return paragraph(`Hallo ${name},`);
}

function signature(): string {
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

function infoBox(text: string): string {
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

function wrap(content: string, previewText?: string): string {
  return baseTemplate({ content, previewText, frontendUrl: FRONTEND_URL });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── TEMPLATE RENDERERS ─────────────────────────────────────────────────────

const templates: Record<string, () => string> = {

  // 1. Email-Verifizierung
  '01-email-verification': () => {
    const verifyUrl = `${FRONTEND_URL}/verify-email?token=abc123-demo-token`;
    return wrap(
      [
        heading('E-Mail-Adresse best&auml;tigen'),
        greeting('Max'),
        paragraph(
          'Vielen Dank f&uuml;r deine Registrierung bei Genie! ' +
          'Bitte best&auml;tige deine E-Mail-Adresse, damit du alle Funktionen nutzen kannst.',
        ),
        ctaButton('E-Mail best&auml;tigen', verifyUrl),
        fallbackLink(verifyUrl),
        infoBox(
          'Dieser Link ist aus Sicherheitsgr&uuml;nden <strong>24 Stunden</strong> g&uuml;ltig. ' +
          'Falls du dich nicht bei Genie registriert hast, kannst du diese E-Mail ignorieren.',
        ),
        signature(),
      ].join('\n'),
      'Bitte bestaetige deine E-Mail-Adresse fuer Genie',
    );
  },

  // 2. Willkommen
  '02-welcome': () => {
    const dashboardUrl = `${FRONTEND_URL}/dashboard`;
    return wrap(
      [
        heading('Willkommen bei Genie! &#127881;'),
        greeting('Max'),
        paragraph(
          'Deine E-Mail wurde erfolgreich best&auml;tigt. ' +
          'Wir freuen uns, dass du dabei bist!',
        ),
        paragraph('Hier sind deine n&auml;chsten Schritte:'),
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
        signature(),
      ].join('\n'),
      'Willkommen bei Genie – dein Account ist bereit!',
    );
  },

  // 3. Passwort zurücksetzen
  '03-password-reset': () => {
    const resetUrl = `${FRONTEND_URL}/reset-password?token=reset-demo-token-xyz`;
    return wrap(
      [
        heading('Passwort zur&uuml;cksetzen'),
        greeting('Max'),
        paragraph(
          'Du hast angefordert, dein Passwort zur&uuml;ckzusetzen. ' +
          'Klicke auf den Button, um ein neues Passwort zu vergeben:',
        ),
        ctaButton('Neues Passwort vergeben', resetUrl),
        fallbackLink(resetUrl),
        infoBox(
          'Dieser Link ist aus Sicherheitsgr&uuml;nden <strong>1 Stunde</strong> g&uuml;ltig. ' +
          'Falls du kein neues Passwort angefordert hast, ignoriere diese E-Mail &ndash; ' +
          'dein Passwort bleibt unver&auml;ndert.',
        ),
        signature(),
      ].join('\n'),
      'Setze dein Passwort fuer Genie zurueck',
    );
  },

  // 4. Neuer Match
  '04-new-match': () => {
    const matchesUrl = `${FRONTEND_URL}/matches`;
    return wrap(
      [
        heading('Neuer Match! &#127881;'),
        greeting('Max'),
        paragraph(
          'Gro&szlig;artige Neuigkeiten! <strong>TEST - M&uuml;ller Elektrotechnik GmbH</strong> ' +
          'und du habt ein Match! Das bedeutet, dass das Unternehmen ebenfalls Interesse an dir zeigt.',
        ),
        paragraph(
          'Ihr k&ouml;nnt jetzt &uuml;ber den Chat miteinander in Kontakt treten. ' +
          'Nutze die Gelegenheit und starte das Gespr&auml;ch!',
        ),
        ctaButton('Match ansehen', matchesUrl, '#EC4899'),
        signature(),
      ].join('\n'),
      'Du hast ein Match mit TEST - Müller Elektrotechnik GmbH!',
    );
  },

  // 5. Neue Nachricht
  '05-new-message': () => {
    const chatUrl = `${FRONTEND_URL}/chat`;
    return wrap(
      [
        heading('Neue Nachricht'),
        greeting('Max'),
        paragraph(
          '<strong>Thomas M&uuml;ller</strong> hat dir eine neue Nachricht geschrieben.',
        ),
        paragraph(
          '&Ouml;ffne den Chat, um die Nachricht zu lesen und zu antworten.',
        ),
        ctaButton('Chat &ouml;ffnen', chatUrl),
        signature(),
      ].join('\n'),
      'Neue Nachricht von Thomas Müller',
    );
  },

  // 6. Neuer Kandidat (für Firmen)
  '06-new-candidate': () => {
    const candidatesUrl = `${FRONTEND_URL}/company/candidates`;
    return wrap(
      [
        heading('Neuer Kandidat interessiert!'),
        greeting('TEST - M&uuml;ller Elektrotechnik GmbH'),
        paragraph(
          '<strong>Max Mustermann</strong> hat Interesse an eurem ' +
          'Unternehmen gezeigt. Schaut euch das Profil an und entscheidet, ' +
          'ob ihr ebenfalls interessiert seid!',
        ),
        paragraph(
          'Wenn ihr auch Interesse zeigt, entsteht ein Match und ihr k&ouml;nnt &uuml;ber den Chat in Kontakt treten.',
        ),
        ctaButton('Kandidat ansehen', candidatesUrl),
        signature(),
      ].join('\n'),
      'Max Mustermann hat Interesse an eurem Unternehmen!',
    );
  },

  // 7. Team-Einladung
  '07-team-invite': () => {
    const inviteUrl = `${FRONTEND_URL}/invite?token=invite-demo-token`;
    return wrap(
      [
        heading('Team-Einladung'),
        paragraph('Hallo,'),
        paragraph(
          '<strong>Thomas M&uuml;ller</strong> hat dich eingeladen, dem Team von ' +
          '<strong>TEST - M&uuml;ller Elektrotechnik GmbH</strong> auf Genie beizutreten.',
        ),
        paragraph(
          'Klicke auf den Button, um die Einladung anzunehmen und dein Konto einzurichten:',
        ),
        ctaButton('Einladung annehmen', inviteUrl),
        fallbackLink(inviteUrl),
        infoBox(
          'Diese Einladung ist <strong>7 Tage</strong> g&uuml;ltig. ' +
          'Falls du diese Einladung nicht erwartet hast, kannst du diese E-Mail einfach ignorieren.',
        ),
        signature(),
      ].join('\n'),
      'Thomas Müller lädt dich zum Team von TEST - Müller Elektrotechnik GmbH ein',
    );
  },

  // 8. Zahlung erfolgreich
  '08-payment-success': () => {
    return wrap(
      [
        heading('Zahlung erfolgreich &#9989;'),
        greeting('TEST - M&uuml;ller Elektrotechnik GmbH'),
        paragraph(
          'Vielen Dank f&uuml;r Ihr Abonnement! Ihre Zahlung f&uuml;r den ' +
          '<strong>PRO</strong>-Plan (149,00 EUR/Monat) ' +
          'wurde erfolgreich verarbeitet.',
        ),
        paragraph(
          'Ihr Plan ist ab sofort aktiv. Sie k&ouml;nnen jetzt alle Funktionen Ihres Plans nutzen.',
        ),
        ctaButton('Zum Dashboard', DASHBOARD_URL),
        infoBox(
          'Sie k&ouml;nnen Ihr Abonnement jederzeit in den Einstellungen verwalten oder k&uuml;ndigen.',
        ),
        signature(),
      ].join('\n'),
      'Zahlungsbestaetigung fuer PRO-Plan',
    );
  },

  // 9. Zahlung fehlgeschlagen
  '09-payment-failed': () => {
    return wrap(
      [
        heading('Zahlung fehlgeschlagen'),
        greeting('TEST - M&uuml;ller Elektrotechnik GmbH'),
        paragraph(
          'Die Zahlung f&uuml;r Ihren <strong>PRO</strong>-Plan ' +
          'konnte leider nicht verarbeitet werden.',
        ),
        paragraph(
          'Bitte &uuml;berpr&uuml;fen Sie Ihre Zahlungsmethode in den Einstellungen. ' +
          'Falls das Problem weiterhin besteht, kontaktieren Sie uns unter ' +
          '<a href="mailto:kontakt@genieportal.de" style="color:#6366F1;">kontakt@genieportal.de</a>.',
        ),
        ctaButton('Zahlungsmethode pr&uuml;fen', `${DASHBOARD_URL}/settings`),
        infoBox(
          'Ihr Zugang bleibt vorerst bestehen. Bitte aktualisieren Sie Ihre Zahlungsmethode innerhalb von 7 Tagen.',
        ),
        signature(),
      ].join('\n'),
      'Zahlung fehlgeschlagen – bitte Zahlungsmethode pruefen',
    );
  },

  // 10. Admin: Neue Registrierung
  '10-admin-new-registration': () => {
    return wrap(
      [
        heading('Neue Betriebe-Registrierung'),
        paragraph('Hallo Admin,'),
        paragraph('Es gibt eine neue Registrierung auf Genie:'),
        `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
               style="margin:0 0 24px;background-color:#F9FAFB;border-radius:12px;border:1px solid #E5E7EB;">
          <tr>
            <td style="padding:20px;">
              <p style="margin:0 0 8px;font-size:14px;color:#6B7280;">Firmenname</p>
              <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#1F2937;">TEST - Digital Solutions GmbH</p>
              <p style="margin:0 0 8px;font-size:14px;color:#6B7280;">E-Mail</p>
              <p style="margin:0 0 16px;font-size:16px;color:#1F2937;">test-digital@genieportal.de</p>
              <p style="margin:0 0 8px;font-size:14px;color:#6B7280;">Stadt</p>
              <p style="margin:0 0 16px;font-size:16px;color:#1F2937;">Berlin</p>
              <p style="margin:0 0 8px;font-size:14px;color:#6B7280;">Gew&auml;hlter Plan</p>
              <p style="margin:0;font-size:16px;font-weight:600;color:#6366F1;">PRO</p>
            </td>
          </tr>
        </table>`,
        ctaButton('Im Admin-Panel ansehen', 'https://admin.genieportal.de'),
        signature(),
      ].join('\n'),
      'Neue Registrierung: TEST - Digital Solutions GmbH',
    );
  },

  // 11. Passwort geändert
  '11-password-changed': () => {
    return wrap(
      [
        heading('Passwort ge&auml;ndert'),
        greeting('Max'),
        paragraph('Dein Passwort wurde erfolgreich ge&auml;ndert.'),
        infoBox(
          'Falls du diese &Auml;nderung nicht selbst vorgenommen hast, kontaktiere uns bitte sofort unter ' +
          '<a href="mailto:kontakt@genieportal.de" style="color:#4338CA;">kontakt@genieportal.de</a>.',
        ),
        signature(),
      ].join('\n'),
      'Dein Passwort wurde geaendert',
    );
  },

  // 12. Abonnement bestätigt
  '12-subscription-confirmed': () => {
    return wrap(
      [
        heading('Abonnement best&auml;tigt &#9989;'),
        greeting('TEST - M&uuml;ller Elektrotechnik GmbH'),
        paragraph(
          'Ihr <strong>PRO</strong>-Abonnement (149,00 EUR/Monat) ' +
          'ist ab sofort aktiv.',
        ),
        paragraph('Laufzeit: <strong>08.02.2026 &ndash; 08.03.2026</strong>'),
        paragraph('Sie k&ouml;nnen jetzt alle Funktionen Ihres Plans nutzen.'),
        ctaButton('Zum Dashboard', DASHBOARD_URL),
        signature(),
      ].join('\n'),
      'Abonnement PRO bestaetigt',
    );
  },

  // 13. Abonnement läuft ab
  '13-subscription-expiring': () => {
    return wrap(
      [
        heading('Abonnement l&auml;uft bald ab'),
        greeting('TEST - M&uuml;ller Elektrotechnik GmbH'),
        paragraph(
          'Ihr <strong>PRO</strong>-Abonnement l&auml;uft am ' +
          '<strong>08.03.2026</strong> ab.',
        ),
        paragraph(
          'Um weiterhin alle Funktionen nutzen zu k&ouml;nnen, verl&auml;ngern Sie Ihr Abonnement.',
        ),
        ctaButton('Abonnement verl&auml;ngern', `${DASHBOARD_URL}/settings`),
        signature(),
      ].join('\n'),
      'Abonnement PRO laeuft bald ab',
    );
  },

  // 14. Stelle veröffentlicht
  '14-job-published': () => {
    return wrap(
      [
        heading('Stelle ver&ouml;ffentlicht &#127881;'),
        greeting('TEST - M&uuml;ller Elektrotechnik GmbH'),
        paragraph(
          'Ihre Stelle <strong>TEST - Ausbildung Elektroniker/in (m/w/d)</strong> ist jetzt live und ' +
          'f&uuml;r Bewerber sichtbar.',
        ),
        ctaButton('Stelle ansehen', `${DASHBOARD_URL}/jobs`),
        infoBox('Tipp: Laden Sie ein Video hoch, um mehr Bewerber anzuziehen!'),
        signature(),
      ].join('\n'),
      'Stelle TEST - Ausbildung Elektroniker/in ist jetzt live',
    );
  },

  // 15. Stelle läuft ab
  '15-job-expiring': () => {
    return wrap(
      [
        heading('Stelle l&auml;uft bald ab'),
        greeting('TEST - M&uuml;ller Elektrotechnik GmbH'),
        paragraph(
          'Ihre Stelle <strong>TEST - Ausbildung Elektroniker/in (m/w/d)</strong> l&auml;uft am ' +
          '<strong>08.04.2026</strong> ab.',
        ),
        paragraph(
          'Verl&auml;ngern Sie die Stelle, um weiterhin Bewerber zu erreichen.',
        ),
        ctaButton('Stelle verwalten', `${DASHBOARD_URL}/jobs`),
        signature(),
      ].join('\n'),
      'Stelle TEST - Ausbildung Elektroniker/in laeuft bald ab',
    );
  },

  // 16. Admin: Video-Moderation
  '16-admin-video-moderation': () => {
    return wrap(
      [
        heading('Video wartet auf Moderation'),
        paragraph('Hallo Admin,'),
        paragraph(
          '<strong>TEST - M&uuml;ller Elektrotechnik GmbH</strong> hat ein neues Video hochgeladen:',
        ),
        paragraph('<strong>Unsere Werkstatt &ndash; Ein Tag als Elektroniker-Azubi</strong>'),
        ctaButton('Video moderieren', 'https://admin.genieportal.de/videos'),
        signature(),
      ].join('\n'),
      'Video von TEST - Müller Elektrotechnik GmbH wartet auf Moderation',
    );
  },
};

// ─── INDEX-SEITE ─────────────────────────────────────────────────────────────

function generateIndex(templateNames: string[]): string {
  const links = templateNames
    .map((name) => {
      const label = name.replace(/^\d+-/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      return `<li style="margin:8px 0;"><a href="${name}.html" style="color:#6366F1;font-size:16px;text-decoration:none;font-weight:500;">${name}.html</a> &mdash; ${label}</li>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Genie Email-Template Previews</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F3F4F6; margin: 0; padding: 40px 20px; }
    .container { max-width: 700px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 40px 48px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    h1 { color: #1F2937; font-size: 28px; margin: 0 0 8px; }
    .subtitle { color: #6B7280; font-size: 15px; margin: 0 0 32px; }
    ul { padding-left: 20px; }
    li { line-height: 1.6; }
    .badge { display: inline-block; background: #EEF2FF; color: #6366F1; font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 6px; margin-bottom: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">${templateNames.length} Templates</div>
    <h1>Genie Email-Template Previews</h1>
    <p class="subtitle">Klicke auf ein Template, um die HTML-Vorschau zu &ouml;ffnen.</p>
    <ul>
      ${links}
    </ul>
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:32px 0 16px;">
    <p style="color:#9CA3AF;font-size:13px;">Generiert am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE')}</p>
  </div>
</body>
</html>`;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  // Ordner erstellen
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const templateNames = Object.keys(templates).sort();

  console.log(`\n📧 Rendere ${templateNames.length} Email-Templates...\n`);

  for (const name of templateNames) {
    const html = templates[name]();
    const filePath = path.join(OUTPUT_DIR, `${name}.html`);
    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`  ✅ ${name}.html`);
  }

  // Index-Seite
  const indexHtml = generateIndex(templateNames);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), indexHtml, 'utf8');
  console.log(`  ✅ index.html (Übersicht)`);

  console.log(`\n📂 Alle Dateien in: ${OUTPUT_DIR}/`);
  console.log(`🔗 Im Browser öffnen: file://${OUTPUT_DIR}/index.html\n`);
}

main().catch((e) => {
  console.error('Fehler:', e);
  process.exit(1);
});
