/* DriveCircle V4 browser -> Apps Script POST transport.
   Uses a hidden form + iframe because Apps Script doesn't expose configurable CORS headers.
   Browser protections or Google iframe policies may block the response in some environments.
   The app will show a diagnostic instead of hanging indefinitely. */
(function(){
 const API=window.DRIVECIRCLE_API_URL;
 let counter=0;
 const pending=new Map();
 function okUrl(){return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(API||'')}
 window.addEventListener('message',function(ev){
   const d=ev.data;
   if(!d||d.kind!=='DriveCircleV4Response'||typeof d.rid!=='string'||!pending.has(d.rid))return;
   // Browser iframe redirects through googleusercontent.com; validate source by pending iframe or nested frames.
   const p=pending.get(d.rid);
   if(!(ev.origin==='https://script.google.com'||ev.origin.endsWith('.googleusercontent.com')||ev.origin==='https://script.googleusercontent.com'))return;
   p.finish(null,d.result);
 });
 window.postApi=function(payload){
   return new Promise(function(resolve,reject){
     if(!okUrl()){reject(Error('config.js: invalid Apps Script /exec URL'));return}
     const rid='dc_'+Date.now().toString(36)+'_'+(++counter).toString(36);
     const frame=document.createElement('iframe');frame.name='dc_transport_'+rid;frame.style.display='none';
     frame.setAttribute('aria-hidden','true');
     const form=document.createElement('form');form.method='POST';form.action=API;form.target=frame.name;form.style.display='none';
     const append=(key,value)=>{let i=document.createElement('input');i.type='hidden';i.name=key;i.value=value;form.appendChild(i)};
     append('rid',rid);append('payload',JSON.stringify(payload));
     let ended=false;
     const finish=(err,res)=>{if(ended)return;ended=true;clearTimeout(timer);pending.delete(rid);form.remove();frame.remove();if(err)reject(err);else resolve(res)};
     const timer=setTimeout(()=>finish(Error('Server response not received (45 sec). Check Apps Script deployment permissions, browser iframe restrictions, or network. Use System Check.')),45000);
     pending.set(rid,{finish,frame});
     document.body.appendChild(frame);document.body.appendChild(form);
     try{form.submit()}catch(e){finish(e)}
   });
 };
 window.publicGet=function(action,args){
   return new Promise(function(resolve,reject){
     if(!okUrl()){reject(Error('config.js: invalid Apps Script /exec URL'));return}
     const cb='dcCallback_'+Date.now().toString(36)+'_'+(++counter);
     const url=new URL(API);url.searchParams.set('action',action);url.searchParams.set('callback',cb);
     if(action==='centerBySlug')url.searchParams.set('slug',args.slug||'');
     let done=false,script=document.createElement('script');
     const finish=(error,res)=>{if(done)return;done=true;clearTimeout(timer);delete window[cb];script.remove();if(error)reject(error);else if(res&&res.ok)resolve(res.result);else reject(Error(res&&res.error||'Server error'))};
     const timer=setTimeout(()=>finish(Error('Health check timed out. Check deployment URL and Anyone access.')),15000);
     window[cb]=r=>finish(null,r);
     script.onerror=()=>finish(Error('Cannot load Apps Script API. Check deployment and browser restrictions.'));
     script.src=url.toString();document.head.appendChild(script);
   });
 };
})();
