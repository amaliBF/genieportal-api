// ─── BASE EMAIL TEMPLATE ─────────────────────────────────────────────────────
// Provides the branded HTML wrapper and reusable helpers for all transactional
// emails sent by Genie.
// ─────────────────────────────────────────────────────────────────────────────

const CDN_BASE = 'https://cdn.ausbildungsgenie.de/email-assets';

export interface EmailTemplateOptions {
  /** Main content HTML that goes inside the white card */
  content: string;
  /** Optional preview text (shown in inbox list, hidden in email body) */
  previewText?: string;
  /** Frontend base URL for footer links */
  frontendUrl: string;
}

/**
 * Generates a CTA button that renders consistently across email clients.
 * Uses the VML / mso trick so the button is fully clickable in Outlook too.
 */
export function ctaButton(text: string, href: string, color = '#6366F1'): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 32px auto;">
      <tr>
        <td style="border-radius: 8px; background-color: ${color};">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
            href="${href}" style="height:50px;v-text-anchor:middle;width:260px;" arcsize="16%" strokecolor="${color}" fillcolor="${color}">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:bold;">
              ${text}
            </center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${href}" target="_blank"
             style="display:inline-block;padding:14px 40px;color:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;background-color:${color};text-align:center;mso-padding-alt:0;">
            ${text}
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>`;
}

/**
 * Secondary / ghost style link (used beneath CTA buttons for fallback URLs).
 */
export function fallbackLink(href: string): string {
  return `
    <p style="margin:0 0 32px;font-size:13px;line-height:20px;color:#9CA3AF;word-break:break-all;text-align:center;">
      Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br/>
      <a href="${href}" style="color:#6366F1;text-decoration:underline;">${href}</a>
    </p>`;
}

/**
 * Renders a single portal row for the footer.
 */
function portalRow(
  name: string,
  domain: string,
  description: string,
  color1: string,
  color2: string,
  letter: string,
): string {
  return `
    <tr>
      <td style="padding:4px 0;">
        <a href="https://${domain}" target="_blank" style="text-decoration:none;display:block;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="width:30px;vertical-align:middle;">
                <img src="${CDN_BASE}/portal-${name}.svg" alt="${letter}" width="28" height="28" style="display:block;border:0;border-radius:7px;" />
              </td>
              <td style="padding-left:10px;vertical-align:middle;">
                <span style="font-size:13px;font-weight:600;color:#1F2937;text-decoration:none;">${name.charAt(0).toUpperCase() + name.slice(1)}</span><br/>
                <span style="font-size:11px;color:#9CA3AF;">${description}</span>
              </td>
            </tr>
          </table>
        </a>
      </td>
    </tr>`;
}

/**
 * Wraps email body content in the full branded layout.
 */
export function baseTemplate(options: EmailTemplateOptions): string {
  const { content, previewText, frontendUrl } = options;

  const previewBlock = previewText
    ? `<div style="display:none;font-size:1px;color:#f8f9fa;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
        ${previewText}
        ${'&zwnj;&nbsp;'.repeat(40)}
       </div>`
    : '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="de" xml:lang="de">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Genieportal</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    /* Reset */
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: #F3F4F6; }

    /* Responsive */
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .email-padding { padding-left: 20px !important; padding-right: 20px !important; }
      .footer-col { display: block !important; width: 100% !important; text-align: center !important; }
      .footer-col-right { padding-top: 24px !important; }
      .app-mockup { margin: 0 auto !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  ${previewBlock}

  <!-- Outer wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#F3F4F6;">
    <tr>
      <td style="padding:40px 16px;">

        <!-- Inner container -->
        <table role="presentation" class="email-container" cellspacing="0" cellpadding="0" border="0" align="center"
               style="max-width:580px;width:100%;margin:0 auto;">

          <!-- ============ HEADER ============ -->
          <tr>
            <td style="padding:0 0 24px;text-align:center;">
              <a href="https://genieportal.de" target="_blank" style="text-decoration:none;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                  <tr>
                    <td style="vertical-align:middle;padding-right:10px;">
                      <img src="${CDN_BASE}/genieportal-logo.svg" alt="Genieportal" width="40" height="40" style="display:block;border:0;border-radius:10px;" />
                    </td>
                    <td style="vertical-align:middle;">
                      <span style="font-size:22px;font-weight:800;color:#1F2937;letter-spacing:-0.5px;">
                        Genie<span style="color:#8B5CF6;">portal</span>
                      </span>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>

          <!-- ============ BODY CARD ============ -->
          <tr>
            <td>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                     style="background-color:#ffffff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
                <tr>
                  <td class="email-padding" style="padding:40px 48px;">
                    ${content}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ============ FOOTER: PORTALE + APP ============ -->
          <tr>
            <td style="padding:32px 0 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                     style="background-color:#ffffff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
                <tr>
                  <td style="padding:28px 32px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <!-- Left: Portal List -->
                        <td class="footer-col" style="vertical-align:top;width:60%;">
                          <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#1F2937;">
                            Die Genie-Portale
                          </p>
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            ${portalRow('ausbildungsgenie', 'ausbildungsgenie.de', 'Ausbildungspl&auml;tze finden', '#7c3aed', '#ec4899', 'A')}
                            ${portalRow('praktikumsgenie', 'praktikumsgenie.de', 'Praktika entdecken', '#e11d48', '#ec4899', 'P')}
                            ${portalRow('berufsgenie', 'berufsgenie.de', 'Karriere &amp; Festanstellung', '#f59e0b', '#ea580c', 'B')}
                            ${portalRow('minijobgenie', 'minijobgenie.de', '520&euro;-Jobs &amp; Nebenjobs', '#10b981', '#059669', 'M')}
                            ${portalRow('werkstudentengenie', 'werkstudentengenie.de', 'Werkstudentenjobs', '#06b6d4', '#14b8a6', 'W')}
                          </table>
                        </td>

                        <!-- Right: App Mockup -->
                        <td class="footer-col footer-col-right" style="vertical-align:top;width:40%;text-align:center;padding-left:16px;">
                          <a href="https://genieportal.de/app" target="_blank" style="text-decoration:none;">
                            <img src="${CDN_BASE}/app-mockup.svg" alt="Genie App" width="130" height="244" class="app-mockup"
                                 style="display:inline-block;border:0;" />
                          </a>
                          <p style="margin:10px 0 0;font-size:11px;color:#9CA3AF;text-align:center;">
                            Bald verf&uuml;gbar f&uuml;r<br/>iOS &amp; Android
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ============ FOOTER: LINKS + COPYRIGHT ============ -->
          <tr>
            <td style="padding:24px 16px 0;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;line-height:20px;color:#9CA3AF;">
                <a href="https://genieportal.de" style="color:#8B5CF6;text-decoration:none;font-weight:600;">Genieportal</a>
                &nbsp;&middot;&nbsp;
                <a href="${frontendUrl}/datenschutz" style="color:#9CA3AF;text-decoration:underline;">Datenschutz</a>
                &nbsp;&middot;&nbsp;
                <a href="${frontendUrl}/impressum" style="color:#9CA3AF;text-decoration:underline;">Impressum</a>
                &nbsp;&middot;&nbsp;
                <a href="${frontendUrl}/agb" style="color:#9CA3AF;text-decoration:underline;">AGB</a>
              </p>
              <p style="margin:0 0 8px;font-size:12px;line-height:18px;color:#D1D5DB;">
                Du erh&auml;ltst diese E-Mail, weil du ein Konto bei Genie hast.
              </p>
              <p style="margin:0;font-size:12px;line-height:18px;color:#D1D5DB;">
                &copy; ${new Date().getFullYear()} Genieportal &ndash; Butterflies IT UG (haftungsbeschr&auml;nkt). Alle Rechte vorbehalten.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Inner container -->

      </td>
    </tr>
  </table>
  <!-- /Outer wrapper -->
</body>
</html>`;
}
