const toggle=document.querySelector('.menu-toggle'),nav=document.querySelector('.site-nav');
if(toggle)toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.querySelector('span').textContent=open?'×':'☰'});
document.querySelectorAll('[data-choice]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-choice]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));const target=document.querySelector('#choice-output');if(target)target.textContent=button.dataset.text||''}));
const search=document.querySelector('#page-search'),cards=[...document.querySelectorAll('[data-page-card]')],empty=document.querySelector('.directory-empty');let category='all';
function filter(){const q=(search?.value||'').toLowerCase().trim();let shown=0;cards.forEach(card=>{const match=(!q||card.textContent.toLowerCase().includes(q))&&(category==='all'||card.dataset.category===category);card.hidden=!match;if(match)shown++});if(empty)empty.style.display=shown?'none':'block'}
if(search)search.addEventListener('input',filter);
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(item=>item.classList.toggle('active',item===button));filter()}));
const form=document.querySelector('#quick-enquiry');
if(form)form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;const data=new FormData(form),subject=encodeURIComponent('Langma website enquiry: '+data.get('interest')),body=encodeURIComponent('Name: '+data.get('name')+'\nEmail: '+data.get('email')+'\nPhone: '+data.get('phone')+'\nInterest: '+data.get('interest')+'\n\n'+data.get('message'));document.querySelector('.form-status').textContent='Your email draft is ready. Review it and press Send to contact Langma.';location.href='mailto:info@langmainternational.com?subject='+subject+'&body='+body});
if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  document.documentElement.classList.add('rv-on');
  const RV_TEXT='h1,h2,h3,h4,p,.lead,.section-intro,.section-kicker,.eyebrow,.fine-print';
  const RV_BLOCK='.page-hero>*,.section-inner>*,.contact-inner>*,.interactive-panel>*,.directory-tools,.form,.accordion,.card-grid,.blog-grid,.contact-list,.feature-list';
  document.querySelectorAll(RV_TEXT).forEach(el=>{if(!el.closest('.site-head,.site-foot'))el.setAttribute('data-rv','fade')});
  let rvWide=0;
  document.querySelectorAll(RV_BLOCK).forEach(el=>{
    if(el.matches(RV_TEXT)||el.hasAttribute('data-rv'))return;
    const r=el.getBoundingClientRect();if(!r.width)return;
    const isWide=r.width>=document.documentElement.clientWidth*.82;
    const fromLeft=isWide?rvWide++%2===0:r.left+r.width/2<window.innerWidth/2;
    el.setAttribute('data-rv',fromLeft?'left':'right');
  });
  const rvIo=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('rv-in');rvIo.unobserve(e.target)}}),{threshold:.15,rootMargin:'0px 0px -6% 0px'});
  document.querySelectorAll('[data-rv]').forEach(el=>rvIo.observe(el));
  let rvLast=0;
  function rvReveal(){
    const vh=window.innerHeight||800;
    document.querySelectorAll('[data-rv]:not(.rv-in)').forEach(el=>{
      if(el.offsetParent===null)return;
      const b=el.getBoundingClientRect();
      if(b.bottom>0&&b.top<vh)el.classList.add('rv-in');
    });
  }
  window.addEventListener('scroll',()=>{const now=Date.now();if(now-rvLast<120)return;rvLast=now;rvReveal()},{passive:true});
  window.addEventListener('resize',rvReveal);
  rvReveal();
}
(function(){
  const SCV_ROUTE='M0 44 C 70 44 110 16 180 16 C 250 16 280 50 350 50 C 420 50 450 12 520 12 C 590 12 620 52 690 52 C 760 52 790 18 860 18 C 930 18 960 48 1030 48 C 1100 48 1140 30 1200 30';
  const SCV_SWOOSH='M3 11 C 48 3 96 2 141 7 C 176 11 208 12 237 4';
  const night=el=>!!el.closest('.page-index,.contact-strip');
  const svg=(d,vb)=>'<svg viewBox="'+vb+'" preserveAspectRatio="none" focusable="false"><path class="scv-guide" d="'+d+'"></path><path class="scv-line" d="'+d+'"></path></svg>';
  document.querySelectorAll('main > section').forEach(section=>{
    if(section.classList.contains('page-hero'))return;
    const rule=document.createElement('div');
    rule.className='scv-rule'+(night(section)?' scv-dark':'');
    rule.setAttribute('data-scv','rule');
    rule.setAttribute('aria-hidden','true');
    rule.innerHTML=svg(SCV_ROUTE,'0 0 1200 64')+'<span class="scv-node"></span>';
    section.insertBefore(rule,section.firstChild);
  });
  document.querySelectorAll('.section h2,.contact-inner h2').forEach(head=>{
    head.classList.add('scv-host');
    const arc=document.createElement('div');
    arc.className='scv-arc'+(night(head)?' scv-dark':'');
    arc.setAttribute('data-scv','arc');
    arc.setAttribute('aria-hidden','true');
    arc.innerHTML='<svg viewBox="0 0 240 16" preserveAspectRatio="none" focusable="false"><path class="scv-line" d="'+SCV_SWOOSH+'"></path></svg>';
    head.appendChild(arc);
  });
  const scvItems=[];
  document.querySelectorAll('[data-scv]').forEach(host=>{
    const line=host.querySelector('.scv-line'),svgEl=host.querySelector('svg');
    if(!line||!svgEl)return;
    const len=line.getTotalLength()||1;
    line.style.setProperty('--len',len.toFixed(1));
    scvItems.push({host,line,len,vb:svgEl.viewBox.baseVal,node:host.querySelector('.scv-node'),p:-1});
  });
  function scvFrame(){
    const vh=window.innerHeight||800;
    scvItems.forEach(o=>{
      const r=o.host.getBoundingClientRect();
      if(!r.width)return;
      let p=(vh*.86-r.top)/(r.height+vh*.5);
      p=p<0?0:p>1?1:p;
      if(p===o.p)return;
      o.p=p;
      o.host.style.setProperty('--sp',p.toFixed(3));
      if(!o.node)return;
      const pt=o.line.getPointAtLength(o.len*p);
      const x=Math.min(Math.max(pt.x/o.vb.width*r.width,5),r.width-5);
      o.node.style.transform='translate('+x.toFixed(1)+'px,'+(pt.y/o.vb.height*r.height).toFixed(1)+'px)';
    });
  }
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  let scvLast=0;
  window.addEventListener('scroll',()=>{const now=Date.now();if(now-scvLast<50)return;scvLast=now;scvFrame()},{passive:true});
  window.addEventListener('resize',()=>{scvItems.forEach(o=>{o.p=-1});scvFrame()});
  scvFrame();
})();
