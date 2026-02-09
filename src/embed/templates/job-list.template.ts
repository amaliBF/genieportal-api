export function jobListTemplate(jobs: any[], options: { theme: string; color: string; apiUrl: string }) {
  const bg = options.theme === 'dark' ? '#1a1a2e' : '#ffffff';
  const text = options.theme === 'dark' ? '#e0e0e0' : '#1f2937';
  const accent = options.color || '#6366f1';

  const jobCards = jobs.map(j => `
    <div style="border:1px solid ${options.theme === 'dark' ? '#333' : '#e5e7eb'};border-radius:12px;padding:16px;margin-bottom:12px;">
      <h3 style="margin:0 0 4px;font-size:16px;color:${text};">${escHtml(j.title)}</h3>
      <p style="margin:0 0 8px;font-size:13px;color:${options.theme === 'dark' ? '#999' : '#6b7280'};">
        ${j.city ? escHtml(j.city) : ''}${j.postalCode ? ` (${escHtml(j.postalCode)})` : ''}
      </p>
      ${j.salaryYear1 ? `<p style="margin:0;font-size:13px;color:${accent};font-weight:600;">ab ${j.salaryYear1}€/Monat</p>` : ''}
    </div>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}body{background:${bg};padding:16px;}</style>
</head><body>
${jobCards || `<p style="color:${text};text-align:center;padding:32px;">Keine Stellen vorhanden</p>`}
<script>
function resize(){parent.postMessage({type:'genie-resize',height:document.body.scrollHeight},'*');}
window.addEventListener('load',resize);new MutationObserver(resize).observe(document.body,{childList:true,subtree:true});
</script>
</body></html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
