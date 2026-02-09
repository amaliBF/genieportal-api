export function jobDetailTemplate(job: any, company: any, options: { theme: string; color: string }) {
  const bg = options.theme === 'dark' ? '#1a1a2e' : '#ffffff';
  const text = options.theme === 'dark' ? '#e0e0e0' : '#1f2937';
  const muted = options.theme === 'dark' ? '#999' : '#6b7280';
  const accent = options.color || '#6366f1';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}body{background:${bg};padding:20px;}</style>
</head><body>
<div style="max-width:600px;">
  <h1 style="font-size:22px;color:${text};margin-bottom:4px;">${escHtml(job.title)}</h1>
  <p style="font-size:14px;color:${muted};margin-bottom:16px;">${escHtml(company.name)}${job.city ? ` · ${escHtml(job.city)}` : ''}</p>
  ${job.description ? `<div style="font-size:14px;color:${text};line-height:1.6;margin-bottom:16px;white-space:pre-wrap;">${escHtml(job.description)}</div>` : ''}
  ${job.salaryYear1 ? `<p style="font-size:14px;color:${accent};font-weight:600;margin-bottom:8px;">Vergütung: ab ${job.salaryYear1}€/Monat</p>` : ''}
  ${job.requirements ? `<div style="margin-top:16px;"><h3 style="font-size:14px;color:${text};margin-bottom:8px;">Anforderungen</h3><p style="font-size:13px;color:${muted};line-height:1.5;">${escHtml(job.requirements)}</p></div>` : ''}
  ${job.benefits ? `<div style="margin-top:16px;"><h3 style="font-size:14px;color:${text};margin-bottom:8px;">Benefits</h3><p style="font-size:13px;color:${muted};line-height:1.5;">${escHtml(job.benefits)}</p></div>` : ''}
</div>
<script>
function resize(){parent.postMessage({type:'genie-resize',height:document.body.scrollHeight},'*');}
window.addEventListener('load',resize);new MutationObserver(resize).observe(document.body,{childList:true,subtree:true});
</script>
</body></html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
