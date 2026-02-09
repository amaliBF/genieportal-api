import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

const SDK_JS = `
(function(w){
  var BASE='https://api.genieportal.de';
  var EMBED=BASE+'/v1/embed';
  var API=BASE+'/v1/api';
  var cfg={apiKey:'',theme:'light',locale:'de'};

  function createIframe(container,src,extraStyle){
    var el=typeof container==='string'?document.querySelector(container):container;
    if(!el)return console.error('Genie: Container not found');
    var iframe=document.createElement('iframe');
    iframe.src=src;
    iframe.style.cssText='width:100%;border:none;overflow:hidden;'+(extraStyle||'');
    iframe.setAttribute('loading','lazy');
    iframe.setAttribute('title','Genie Widget');
    el.innerHTML='';
    el.appendChild(iframe);
    w.addEventListener('message',function(e){
      if(e.data&&e.data.type==='genie-resize'&&e.source===iframe.contentWindow){
        iframe.style.height=e.data.height+'px';
      }
      if(e.data&&e.data.type==='genie-job-click'&&e.source===iframe.contentWindow){
        if(iframe._onJobClick)iframe._onJobClick(e.data.job);
      }
      if(e.data&&e.data.type==='genie-apply-click'&&e.source===iframe.contentWindow){
        if(iframe._onApplyClick)iframe._onApplyClick(e.data.job);
      }
      if(e.data&&e.data.type==='genie-submit-success'&&e.source===iframe.contentWindow){
        if(iframe._onSubmit)iframe._onSubmit(e.data.application);
      }
      if(e.data&&e.data.type==='genie-submit-error'&&e.source===iframe.contentWindow){
        if(iframe._onError)iframe._onError(e.data.error);
      }
    });
    return iframe;
  }

  function buildParams(opts){
    var params='key='+encodeURIComponent(cfg.apiKey);
    if(opts.theme||cfg.theme)params+='&theme='+(opts.theme||cfg.theme);
    if(opts.color)params+='&color='+encodeURIComponent(opts.color);
    return params;
  }

  function apiFetch(path,opts){
    opts=opts||{};
    return fetch(API+path,{
      headers:{'Authorization':'Bearer '+cfg.apiKey,'Accept':'application/json'},
    }).then(function(r){
      if(!r.ok)return r.json().then(function(d){throw d;});
      return r.json();
    });
  }

  w.Genie={
    init:function(opts){cfg=Object.assign(cfg,opts);},

    // ─── Basic iFrame methods (backwards-compatible) ────────────────
    jobs:function(container,opts){
      opts=opts||{};
      var params=buildParams(opts);
      if(opts.limit)params+='&limit='+opts.limit;
      return createIframe(container,EMBED+'/jobs?'+params);
    },
    job:function(container,id,opts){
      opts=opts||{};
      var params=buildParams(opts);
      return createIframe(container,EMBED+'/job/'+id+'?'+params);
    },
    apply:function(container,id,opts){
      opts=opts||{};
      var params=buildParams(opts);
      return createIframe(container,EMBED+'/apply/'+id+'?'+params);
    },

    // ─── Advanced render methods ────────────────────────────────────

    renderJobs:function(opts){
      opts=opts||{};
      var params=buildParams(opts);
      if(opts.limit)params+='&limit='+opts.limit;
      if(opts.bereich)params+='&bereich='+encodeURIComponent(opts.bereich);
      if(opts.layout)params+='&layout='+opts.layout;
      if(opts.showFilters)params+='&showFilters=true';
      var iframe=createIframe(opts.container,EMBED+'/jobs?'+params);
      if(iframe&&opts.onJobClick)iframe._onJobClick=opts.onJobClick;
      return iframe;
    },

    renderJob:function(opts){
      opts=opts||{};
      var params=buildParams(opts);
      if(opts.showApplyButton!==undefined)params+='&showApply='+(opts.showApplyButton?'true':'false');
      if(opts.applyButtonText)params+='&applyText='+encodeURIComponent(opts.applyButtonText);
      var iframe=createIframe(opts.container,EMBED+'/job/'+opts.jobId+'?'+params);
      if(iframe&&opts.onApplyClick)iframe._onApplyClick=opts.onApplyClick;
      return iframe;
    },

    renderApplyForm:function(opts){
      opts=opts||{};
      var params=buildParams(opts);
      var iframe=createIframe(opts.container,EMBED+'/apply/'+opts.jobId+'?'+params);
      if(iframe){
        if(opts.onSubmit)iframe._onSubmit=opts.onSubmit;
        if(opts.onError)iframe._onError=opts.onError;
      }
      return iframe;
    },

    // ─── Programmatic API (no UI) ───────────────────────────────────

    getJobs:function(opts){
      opts=opts||{};
      var q='?limit='+(opts.limit||20)+'&page='+(opts.page||1);
      if(opts.bereich)q+='&bereich='+encodeURIComponent(opts.bereich);
      if(opts.status)q+='&status='+encodeURIComponent(opts.status);
      return apiFetch('/jobs'+q);
    },

    getJob:function(id){
      return apiFetch('/jobs/'+id);
    },

    // ─── Modal helper ───────────────────────────────────────────────

    openApplyModal:function(jobId,opts){
      opts=opts||{};
      var overlay=document.createElement('div');
      overlay.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
      var modal=document.createElement('div');
      modal.style.cssText='background:#fff;border-radius:16px;width:90%;max-width:520px;max-height:90vh;overflow:auto;padding:0;position:relative;';
      var close=document.createElement('button');
      close.textContent='\\u00D7';
      close.style.cssText='position:absolute;top:8px;right:12px;border:none;background:none;font-size:24px;cursor:pointer;z-index:1;color:#666;';
      close.onclick=function(){document.body.removeChild(overlay);};
      overlay.onclick=function(e){if(e.target===overlay)document.body.removeChild(overlay);};
      var container=document.createElement('div');
      modal.appendChild(close);
      modal.appendChild(container);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      var params=buildParams(opts);
      var iframe=createIframe(container,EMBED+'/apply/'+jobId+'?'+params);
      if(iframe){
        if(opts.onSubmit)iframe._onSubmit=opts.onSubmit;
        if(opts.onError)iframe._onError=opts.onError;
      }
    }
  };
})(window);
`.trim();

@ApiTags('Embed SDK')
@SkipThrottle()
@Controller('embed')
export class SdkController {
  @Get('genie.min.js')
  @ApiOperation({ summary: 'JavaScript SDK ausliefern' })
  getSDK(@Res() res: any) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(SDK_JS);
  }
}
