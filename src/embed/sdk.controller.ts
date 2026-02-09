import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

const SDK_JS = `
(function(w){
  var BASE='https://api.genieportal.de/v1/embed';
  var cfg={apiKey:''};

  function createIframe(container,src){
    var el=typeof container==='string'?document.querySelector(container):container;
    if(!el)return console.error('Genie: Container not found');
    var iframe=document.createElement('iframe');
    iframe.src=src;
    iframe.style.cssText='width:100%;border:none;overflow:hidden;';
    iframe.setAttribute('loading','lazy');
    el.innerHTML='';
    el.appendChild(iframe);
    w.addEventListener('message',function(e){
      if(e.data&&e.data.type==='genie-resize'&&e.source===iframe.contentWindow){
        iframe.style.height=e.data.height+'px';
      }
    });
    return iframe;
  }

  w.Genie={
    init:function(opts){cfg=Object.assign(cfg,opts);},
    jobs:function(container,opts){
      opts=opts||{};
      var params='key='+encodeURIComponent(cfg.apiKey);
      if(opts.theme)params+='&theme='+opts.theme;
      if(opts.color)params+='&color='+encodeURIComponent(opts.color);
      if(opts.limit)params+='&limit='+opts.limit;
      return createIframe(container,BASE+'/jobs?'+params);
    },
    job:function(container,id,opts){
      opts=opts||{};
      var params='key='+encodeURIComponent(cfg.apiKey);
      if(opts.theme)params+='&theme='+opts.theme;
      if(opts.color)params+='&color='+encodeURIComponent(opts.color);
      return createIframe(container,BASE+'/job/'+id+'?'+params);
    },
    apply:function(container,id,opts){
      opts=opts||{};
      var params='key='+encodeURIComponent(cfg.apiKey);
      if(opts.theme)params+='&theme='+opts.theme;
      if(opts.color)params+='&color='+encodeURIComponent(opts.color);
      return createIframe(container,BASE+'/apply/'+id+'?'+params);
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
