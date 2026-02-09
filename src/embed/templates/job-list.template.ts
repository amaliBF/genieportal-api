export function jobListTemplate(jobs: any[], options: {
  theme: string; color: string; apiUrl: string;
  layout?: string; showFilters?: boolean; bereich?: string;
}) {
  const bg = options.theme === 'dark' ? '#1a1a2e' : '#ffffff';
  const text = options.theme === 'dark' ? '#e0e0e0' : '#1f2937';
  const muted = options.theme === 'dark' ? '#999' : '#6b7280';
  const border = options.theme === 'dark' ? '#333' : '#e5e7eb';
  const inputBg = options.theme === 'dark' ? '#2a2a3e' : '#fff';
  const accent = options.color || '#6366f1';
  const layout = options.layout || 'list';

  const filterHtml = options.showFilters ? `
    <div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap;">
      <input type="text" id="genie-search" placeholder="Suche..." style="flex:1;min-width:180px;padding:8px 12px;border:1px solid ${border};border-radius:8px;font-size:14px;background:${inputBg};color:${text};" />
      <select id="genie-sort" style="padding:8px 12px;border:1px solid ${border};border-radius:8px;font-size:14px;background:${inputBg};color:${text};">
        <option value="newest">Neueste zuerst</option>
        <option value="salary">Gehalt absteigend</option>
        <option value="title">Alphabetisch</option>
      </select>
    </div>` : '';

  const gridStyle = layout === 'grid'
    ? 'display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;'
    : layout === 'cards'
    ? 'display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;'
    : '';

  const cardStyle = layout === 'cards'
    ? `border:1px solid ${border};border-radius:16px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.08);cursor:pointer;transition:box-shadow 0.2s;`
    : `border:1px solid ${border};border-radius:12px;padding:16px;margin-bottom:${layout === 'grid' ? '0' : '12px'};cursor:pointer;transition:box-shadow 0.2s;`;

  const jobCards = jobs.map((j, i) => `
    <div class="genie-job-card" data-idx="${i}" style="${cardStyle}" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow='none'" onclick="jobClick(${i})">
      <h3 style="margin:0 0 4px;font-size:16px;color:${text};">${escHtml(j.title)}</h3>
      <p style="margin:0 0 8px;font-size:13px;color:${muted};">
        ${j.city ? escHtml(j.city) : ''}${j.postalCode ? ` (${escHtml(j.postalCode)})` : ''}
      </p>
      ${j.salaryYear1 ? `<p style="margin:0;font-size:13px;color:${accent};font-weight:600;">ab ${j.salaryYear1}&euro;/Monat</p>` : ''}
    </div>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:var(--genie-font-family,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif);}
body{background:var(--genie-background,${bg});padding:16px;color:var(--genie-text-color,${text});}
.genie-job-card{border-radius:var(--genie-border-radius,12px);}
</style>
</head><body>
${filterHtml}
<div id="genie-list" style="${gridStyle}">
${jobCards || `<p style="color:${text};text-align:center;padding:32px;">Keine Stellen vorhanden</p>`}
</div>
<script>
var jobs=${JSON.stringify(jobs.map(j => ({ id: j.id, title: j.title, city: j.city, slug: j.slug || '' })))};
function jobClick(idx){
  parent.postMessage({type:'genie-job-click',job:jobs[idx]},'*');
}
${options.showFilters ? `
document.getElementById('genie-search').addEventListener('input',function(){
  var q=this.value.toLowerCase();
  var cards=document.querySelectorAll('.genie-job-card');
  cards.forEach(function(c,i){
    var match=jobs[i].title.toLowerCase().indexOf(q)>-1||(jobs[i].city||'').toLowerCase().indexOf(q)>-1;
    c.style.display=match?'':'none';
  });
  resize();
});
` : ''}
function resize(){parent.postMessage({type:'genie-resize',height:document.body.scrollHeight},'*');}
window.addEventListener('load',resize);new MutationObserver(resize).observe(document.body,{childList:true,subtree:true});
</script>
</body></html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
