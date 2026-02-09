export function applyFormTemplate(job: any, company: any, config: any, options: { theme: string; color: string; apiUrl: string }) {
  const bg = options.theme === 'dark' ? '#1a1a2e' : '#ffffff';
  const text = options.theme === 'dark' ? '#e0e0e0' : '#1f2937';
  const muted = options.theme === 'dark' ? '#999' : '#6b7280';
  const border = options.theme === 'dark' ? '#444' : '#d1d5db';
  const inputBg = options.theme === 'dark' ? '#2a2a3e' : '#fff';
  const accent = options.color || '#6366f1';
  const activeFields = config?.activeFields || ['firstName', 'lastName', 'email', 'message'];
  const requiredFields = config?.requiredFields || ['firstName', 'lastName', 'email'];

  const field = (name: string, label: string, type = 'text') => {
    if (!activeFields.includes(name)) return '';
    const req = requiredFields.includes(name) ? 'required' : '';
    return `<div style="margin-bottom:12px;">
      <label style="display:block;font-size:13px;color:${muted};margin-bottom:4px;">${label}${req ? ' *' : ''}</label>
      ${type === 'textarea'
        ? `<textarea name="${name}" ${req} rows="4" style="width:100%;padding:8px 12px;border:1px solid ${border};border-radius:var(--genie-border-radius,8px);font-size:14px;background:${inputBg};color:${text};resize:vertical;"></textarea>`
        : `<input type="${type}" name="${name}" ${req} style="width:100%;padding:8px 12px;border:1px solid ${border};border-radius:var(--genie-border-radius,8px);font-size:14px;background:${inputBg};color:${text};" />`
      }
    </div>`;
  };

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:var(--genie-font-family,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif);}
body{background:var(--genie-background,${bg});padding:20px;color:var(--genie-text-color,${text});}
</style>
</head><body>
<div style="max-width:500px;">
  <h2 style="font-size:18px;color:${text};margin-bottom:4px;">Jetzt bewerben</h2>
  <p style="font-size:13px;color:${muted};margin-bottom:20px;">${escHtml(job.title)} bei ${escHtml(company.name)}</p>
  <form id="genie-form">
    ${field('firstName', 'Vorname')}
    ${field('lastName', 'Nachname')}
    ${field('email', 'E-Mail', 'email')}
    ${field('phone', 'Telefon', 'tel')}
    ${field('birthDate', 'Geburtsdatum', 'date')}
    ${field('postalCode', 'PLZ')}
    ${field('city', 'Stadt')}
    ${field('schulabschluss', 'Schulabschluss')}
    ${field('message', 'Nachricht', 'textarea')}
    <div style="margin-bottom:12px;">
      <label style="display:flex;align-items:start;gap:8px;font-size:13px;color:${muted};cursor:pointer;">
        <input type="checkbox" name="datenschutzAkzeptiert" required style="margin-top:2px;" />
        <span>Ich akzeptiere die Datenschutzerkl&auml;rung *</span>
      </label>
    </div>
    ${activeFields.includes('documents') ? `
    <div style="margin-bottom:12px;">
      <label style="display:block;font-size:13px;color:${muted};margin-bottom:4px;">Dokumente (PDF, max. 5MB)</label>
      <input type="file" name="documents" multiple accept=".pdf,.doc,.docx" style="font-size:13px;color:${text};" />
    </div>` : ''}
    <button type="submit" style="width:100%;padding:10px;background:var(--genie-primary-color,${accent});color:#fff;border:none;border-radius:var(--genie-border-radius,8px);font-size:15px;font-weight:600;cursor:pointer;">
      Bewerbung absenden
    </button>
    <div id="result" style="margin-top:12px;font-size:14px;text-align:center;"></div>
  </form>
</div>
<script>
document.getElementById('genie-form').addEventListener('submit',async function(e){
  e.preventDefault();
  var form=new FormData(this);
  form.set('datenschutzAkzeptiert','true');
  var btn=this.querySelector('button[type=submit]');
  btn.disabled=true;btn.textContent='Wird gesendet...';
  try{
    var res=await fetch('${options.apiUrl}/v1/public/jobs/${job.id}/apply',{method:'POST',body:form});
    var data=await res.json();
    if(res.ok){
      document.getElementById('result').innerHTML='<span style="color:#10b981;">\\u2713 Bewerbung erfolgreich gesendet!</span>';
      this.reset();
      parent.postMessage({type:'genie-submit-success',application:data},'*');
    } else {
      var msg=data.message||'Fehler beim Senden';
      document.getElementById('result').innerHTML='<span style="color:#ef4444;">'+msg+'</span>';
      parent.postMessage({type:'genie-submit-error',error:{message:msg}},'*');
    }
  }catch(err){
    document.getElementById('result').innerHTML='<span style="color:#ef4444;">Netzwerkfehler</span>';
    parent.postMessage({type:'genie-submit-error',error:{message:'Netzwerkfehler'}},'*');
  }
  btn.disabled=false;btn.textContent='Bewerbung absenden';
});
function resize(){parent.postMessage({type:'genie-resize',height:document.body.scrollHeight},'*');}
window.addEventListener('load',resize);new MutationObserver(resize).observe(document.body,{childList:true,subtree:true});
</script>
</body></html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
