export function jobDetailTemplate(job: any, company: any, options: {
  theme: string; color: string; showApply?: boolean; applyText?: string;
}) {
  const bg = options.theme === 'dark' ? '#1a1a2e' : '#ffffff';
  const text = options.theme === 'dark' ? '#e0e0e0' : '#1f2937';
  const muted = options.theme === 'dark' ? '#999' : '#6b7280';
  const accent = options.color || '#6366f1';
  const showApply = options.showApply !== false;
  const applyText = options.applyText || 'Jetzt bewerben';

  const requirementsHtml = job.requirements
    ? (Array.isArray(job.requirements)
        ? job.requirements.filter(Boolean).map((r: string) => `<li style="margin-bottom:4px;">${escHtml(r)}</li>`).join('')
        : `<li>${escHtml(job.requirements)}</li>`)
    : '';

  const benefitsHtml = job.benefits
    ? (Array.isArray(job.benefits)
        ? job.benefits.filter(Boolean).map((b: string) => `<li style="margin-bottom:4px;">${escHtml(b)}</li>`).join('')
        : `<li>${escHtml(job.benefits)}</li>`)
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:var(--genie-font-family,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif);}
body{background:var(--genie-background,${bg});padding:20px;color:var(--genie-text-color,${text});}
</style>
</head><body>
<div style="max-width:600px;">
  <h1 style="font-size:22px;color:${text};margin-bottom:4px;">${escHtml(job.title)}</h1>
  <p style="font-size:14px;color:${muted};margin-bottom:16px;">${escHtml(company.name)}${job.city ? ` &middot; ${escHtml(job.city)}` : ''}</p>
  ${job.description ? `<div style="font-size:14px;color:${text};line-height:1.6;margin-bottom:16px;white-space:pre-wrap;">${escHtml(job.description)}</div>` : ''}
  ${job.salaryYear1 ? `<p style="font-size:14px;color:${accent};font-weight:600;margin-bottom:8px;">Verg&uuml;tung: ab ${job.salaryYear1}&euro;/Monat</p>` : ''}
  ${requirementsHtml ? `<div style="margin-top:16px;"><h3 style="font-size:14px;color:${text};margin-bottom:8px;">Anforderungen</h3><ul style="font-size:13px;color:${muted};line-height:1.5;padding-left:20px;">${requirementsHtml}</ul></div>` : ''}
  ${benefitsHtml ? `<div style="margin-top:16px;"><h3 style="font-size:14px;color:${text};margin-bottom:8px;">Benefits</h3><ul style="font-size:13px;color:${muted};line-height:1.5;padding-left:20px;">${benefitsHtml}</ul></div>` : ''}
  ${showApply ? `
  <div style="margin-top:24px;">
    <button id="apply-btn" onclick="applyClick()" style="padding:12px 24px;background:${accent};color:#fff;border:none;border-radius:var(--genie-border-radius,8px);font-size:15px;font-weight:600;cursor:pointer;">
      ${escHtml(applyText)}
    </button>
  </div>` : ''}
</div>
<script>
var jobData=${JSON.stringify({ id: job.id, title: job.title, city: job.city, slug: job.slug || '' })};
function applyClick(){
  parent.postMessage({type:'genie-apply-click',job:jobData},'*');
}
function resize(){parent.postMessage({type:'genie-resize',height:document.body.scrollHeight},'*');}
window.addEventListener('load',resize);new MutationObserver(resize).observe(document.body,{childList:true,subtree:true});
</script>
</body></html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
