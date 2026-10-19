/**
 * Galeria estática publicada no GitHub Pages (docs/index.html): grid de todos
 * os logos com busca por nome/COMPE/ISPB e cópia da URL de CDN por logo.
 * Auto-contida — os únicos recursos externos são os próprios logos, servidos
 * do jsDelivr, então a página também é uma demonstração do consumo via CDN.
 * Determinística (sem timestamps) para o writeIfChanged não gerar diff vazio.
 * A busca fica na URL (?q=...), então dá para compartilhar o link de uma busca.
 */

import { CDN_BASE } from './dataset';
import type { Dataset, PixDataset } from './types';

/**
 * [ispb, compe|null, nome, ispbDoAsset|null, temSvg 0|1, marca, displayName]
 * `marca` é o token do sistema cooperativo quando o logo é compartilhado
 * (SICOOB/SICREDI/…) — a página agrupa essas afiliadas num card por sistema
 * para o grid não repetir o mesmo arquivo centenas de vezes; a busca continua
 * encontrando cada afiliada individualmente. `displayName` é o nome popular
 * curado ("Nubank"), usado na tela e na busca. Campos vazios viajam como ''.
 */
type Row = [string, string | null, string, string | null, number, string, string];

function assetIspb(png: string): string | null {
  const match = png.match(/(\d{8})\.png$/);
  return match?.[1] ?? null;
}

/** 1080 → '1.080'. Feito à mão para não depender do ICU do Node (página determinística). */
function milhar(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function buildGalleryHtml(dataset: Dataset, pixDataset: PixDataset): string {
  const rows: Row[] = [...dataset.banks, ...pixDataset.institutions].map((inst) => [
    inst.ispb,
    inst.compe,
    inst.name,
    inst.logo ? assetIspb(inst.logo.png) : null,
    inst.logo?.svg ? 1 : 0,
    inst.logo?.source.type === 'brand' ? (inst.logo.source.brand ?? '') : '',
    inst.displayName ?? '',
  ]);
  // Ordena pelo rótulo que aparece na tela (popular quando existe).
  const rotulo = (r: Row) => r[6] || r[2];
  rows.sort((a, b) => rotulo(a).localeCompare(rotulo(b), 'pt-BR') || a[0].localeCompare(b[0]));
  const total = rows.length;
  const comLogo = rows.filter((r) => r[3]).length;
  const json = JSON.stringify(rows).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Logos de bancos brasileiros em PNG e SVG · logos-bancos-br</title>
<meta name="description" content="Logos de ${milhar(comLogo)} bancos, fintechs, instituições de pagamento e cooperativas do Brasil em PNG e SVG. Busque por nome, COMPE ou ISPB e copie a URL de CDN. Lista do Banco Central, logos do Open Finance e dos sites oficiais, atualizados toda semana.">
<link rel="canonical" href="https://rzmt.github.io/logos-bancos-br/">
<meta property="og:title" content="Logos de bancos brasileiros em PNG e SVG · logos-bancos-br">
<meta property="og:description" content="Logos de ${milhar(comLogo)} bancos, fintechs e cooperativas do Brasil em PNG e SVG. Busque por nome, COMPE ou ISPB e copie a URL de CDN.">
<meta property="og:image" content="https://rzmt.github.io/logos-bancos-br/og.png">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="640">
<meta property="og:image:alt" content="Logos de Banco do Brasil, Caixa, Itaú, Bradesco, Santander, Nubank e outras instituições do Brasil">
<meta name="twitter:card" content="summary_large_image">
<style>
:root{color-scheme:light dark;--bg:#f6f7f9;--fg:#1a2330;--muted:#5b6b7f;--card:#fff;--border:#dde3ea;--accent:#0b5fff}
@media(prefers-color-scheme:dark){:root{--bg:#10151c;--fg:#e8edf3;--muted:#93a3b5;--card:#171e27;--border:#2a3441;--accent:#5b93ff}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
header,main,footer{max-width:1100px;margin:0 auto;padding:0 20px}
header{padding-top:36px}
h1{margin:0;font-size:26px}
.sub{color:var(--muted);margin:6px 0 0;max-width:70ch}
.links{margin:10px 0 0;font-size:14px}
.links a{color:var(--accent);text-decoration:none;margin-right:14px}
.links a:hover{text-decoration:underline}
.links a.gh{display:inline-block;padding:2px 12px;border:1px solid var(--accent);border-radius:999px;font-weight:600}
.links a.gh:hover{text-decoration:none;background:var(--accent);color:var(--card)}
.controls{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:22px 0 6px}
#q{flex:1;min-width:240px;padding:10px 14px;font-size:15px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--fg)}
#q:focus{outline:2px solid var(--accent);outline-offset:-1px}
.chk{display:flex;gap:6px;align-items:center;color:var(--muted);font-size:14px;user-select:none}
#count{color:var(--muted);font-size:13px;margin:0 0 14px}
#grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:12px;padding:0 0 40px}
.card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px}
.chip{width:76px;height:76px;border-radius:12px;background:#fff;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;overflow:hidden}
.chip img{width:64px;height:64px;object-fit:contain}
.chip.nada{color:var(--muted);font-size:11px;background:transparent}
.nome{font-size:12.5px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.6em}
.meta{font-size:11px;color:var(--muted)}
.acts{display:flex;gap:6px;min-height:26px}
.acts button{font-size:11px;padding:3px 10px;border:1px solid var(--border);border-radius:999px;background:transparent;color:var(--accent);cursor:pointer}
.acts button:hover{border-color:var(--accent)}
.acts a{font-size:11px;color:var(--muted)}
footer{border-top:1px solid var(--border);padding-top:18px;padding-bottom:44px;font-size:13px;color:var(--muted)}
footer a{color:var(--accent);text-decoration:none}
footer a:hover{text-decoration:underline}
</style>
</head>
<body>
<header>
  <h1>logos-bancos-br</h1>
  <p class="sub">Logos de ${milhar(comLogo)} bancos, fintechs, instituições de pagamento e
  cooperativas do Brasil (${milhar(total)} instituições no dataset). Lista do Banco Central, logos
  do Open Finance e dos sites oficiais, atualizados toda semana. Clique para copiar a URL de CDN.</p>
  <p class="links">
    <a class="gh" href="https://github.com/rzmt/logos-bancos-br"><span aria-hidden="true">★</span> Código e dados no GitHub</a>
    <a href="https://www.npmjs.com/package/logos-bancos-br">npm</a>
    <a href="https://github.com/rzmt/logos-bancos-br/blob/main/CONTRIBUTING.md">Contribuir</a>
  </p>
  <div class="controls">
    <input id="q" type="search" placeholder="Buscar por nome, COMPE ou ISPB…" autocomplete="off">
    <label class="chk"><input id="semlogo" type="checkbox"> mostrar instituições sem logo</label>
  </div>
  <p id="count"></p>
</header>
<main id="grid"></main>
<footer>
  <p>Falta o logo de alguma instituição? <a href="https://github.com/rzmt/logos-bancos-br/blob/main/CONTRIBUTING.md">Veja como contribuir</a>.
  Só é preciso achar a URI oficial; o pipeline faz o resto.</p>
  <p>Os logos e as marcas pertencem às respectivas instituições e são distribuídos apenas para
  identificação (<a href="https://github.com/rzmt/logos-bancos-br/blob/main/DISCLAIMER.md">aviso legal</a>).
  Dados: <a href="https://github.com/rzmt/logos-bancos-br#as-fontes-para-confer%C3%AAncia">fontes oficiais</a>. Licença MIT.</p>
</footer>
<script id="data" type="application/json">${json}</script>
<script>
var CDN='${CDN_BASE}';
var DATA=JSON.parse(document.getElementById('data').textContent);
var grid=document.getElementById('grid');
var q=document.getElementById('q');
var semlogo=document.getElementById('semlogo');
var count=document.getElementById('count');
function norm(s){return s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'')}
function copiar(btn,url){navigator.clipboard.writeText(url).then(function(){var t=btn.textContent;btn.textContent='copiado!';setTimeout(function(){btn.textContent=t},900)})}
function card(r){
  var ispb=r[0],compe=r[1],nome=r[2],asset=r[3],temSvg=r[4];
  var el=document.createElement('div');el.className='card';
  var chip=document.createElement('div');
  if(asset){
    chip.className='chip';
    var img=document.createElement('img');
    img.loading='lazy';img.alt=r[6]||nome;img.src=CDN+'/logos/png/'+asset+'.png';
    chip.appendChild(img);
  }else{
    chip.className='chip nada';chip.textContent='sem logo';
  }
  el.appendChild(chip);
  var n=document.createElement('div');n.className='nome';
  // rótulo = nome popular quando curado; o oficial fica no tooltip
  n.textContent=r[6]||nome;n.title=nome;el.appendChild(n);
  var m=document.createElement('div');m.className='meta';
  m.textContent=(compe?'COMPE '+compe+' · ':'')+'ISPB '+ispb;el.appendChild(m);
  var acts=document.createElement('div');acts.className='acts';
  if(asset){
    var bp=document.createElement('button');bp.textContent='PNG';
    bp.onclick=function(){copiar(bp,CDN+'/logos/png/'+asset+'.png')};acts.appendChild(bp);
    if(temSvg){
      var bs=document.createElement('button');bs.textContent='SVG';
      bs.onclick=function(){copiar(bs,CDN+'/logos/svg/'+asset+'.svg')};acts.appendChild(bs);
    }
  }else{
    var a=document.createElement('a');a.href='https://github.com/rzmt/logos-bancos-br/blob/main/CONTRIBUTING.md';
    a.textContent='contribuir';acts.appendChild(a);
  }
  el.appendChild(acts);
  return el;
}
var BRAND_NAMES={SICOOB:'Sicoob',SICREDI:'Sicredi',CRESOL:'Cresol',UNICRED:'Unicred'};
function brandLabel(t){return BRAND_NAMES[t]||t.charAt(0)+t.slice(1).toLowerCase()}
function brandCard(token,info){
  var el=document.createElement('div');el.className='card';
  var chip=document.createElement('div');chip.className='chip';
  var img=document.createElement('img');img.loading='lazy';img.alt=brandLabel(token);
  img.src=CDN+'/logos/png/'+info.asset+'.png';chip.appendChild(img);
  el.appendChild(chip);
  var n=document.createElement('div');n.className='nome';
  n.textContent=brandLabel(token)+' (sistema cooperativo)';n.title=n.textContent;el.appendChild(n);
  var m=document.createElement('div');m.className='meta';
  m.textContent=info.count+' cooperativas afiliadas · logo compartilhado';el.appendChild(m);
  var acts=document.createElement('div');acts.className='acts';
  var bp=document.createElement('button');bp.textContent='PNG';
  bp.onclick=function(){copiar(bp,CDN+'/logos/png/'+info.asset+'.png')};acts.appendChild(bp);
  if(info.svg){
    var bs=document.createElement('button');bs.textContent='SVG';
    bs.onclick=function(){copiar(bs,CDN+'/logos/svg/'+info.asset+'.svg')};acts.appendChild(bs);
  }
  var a=document.createElement('a');a.href='#';a.textContent='listar';
  a.onclick=function(e){e.preventDefault();q.value=brandLabel(token);buscar();q.focus()};
  acts.appendChild(a);
  el.appendChild(acts);
  return el;
}
function combina(r,termo){
  return norm(r[2]).indexOf(termo)>=0||r[0].indexOf(termo)>=0||(!!r[1]&&r[1].indexOf(termo)>=0)||(!!r[6]&&norm(r[6]).indexOf(termo)>=0)
}
function render(){
  var termo=norm(q.value.trim());
  var todos=semlogo.checked;
  grid.textContent='';
  var vis=0;
  var marcas={},ordem=[],afiliadas=0;
  var frag=document.createDocumentFragment();
  for(var i=0;i<DATA.length;i++){
    var r=DATA[i];
    if(!termo&&r[5]){
      var b=marcas[r[5]];
      if(!b){b=marcas[r[5]]={asset:r[3],svg:r[4],count:0};ordem.push(r[5])}
      b.count++;afiliadas++;continue;
    }
    if(!todos&&!r[3])continue;
    if(termo&&!combina(r,termo))continue;
    frag.appendChild(card(r));vis++;
  }
  if(!termo){
    ordem.sort();
    for(var j=0;j<ordem.length;j++)grid.appendChild(brandCard(ordem[j],marcas[ordem[j]]));
  }
  grid.appendChild(frag);
  if(termo){
    count.textContent=vis+(vis===1?' resultado':' resultados');
  }else{
    count.textContent=vis+' instituições'+(todos?'':' com logo próprio')+
      (ordem.length?' + '+ordem.length+' sistemas cooperativos ('+afiliadas+' afiliadas agrupadas; cada uma aparece na busca)':'');
  }
}
// A busca vai para a URL (?q=...) para o link poder ser compartilhado.
// O valor entra no campo por .value, nunca como HTML.
function lerBusca(){try{return new URLSearchParams(location.search).get('q')||''}catch(e){return ''}}
function gravarBusca(){
  try{
    var p=new URLSearchParams(location.search);
    var v=q.value.trim();
    if(v)p.set('q',v);else p.delete('q');
    var s=p.toString();
    history.replaceState(null,'',location.pathname+(s?'?'+s:'')+location.hash);
  }catch(e){}
}
// Grava só quando a digitação para: o Safari lança SecurityError depois de
// ~100 replaceState em 30 s, e a URL ficaria com uma busca antiga.
var gravarDepois;
function buscar(){render();clearTimeout(gravarDepois);gravarDepois=setTimeout(gravarBusca,300)}
q.addEventListener('input',buscar);
semlogo.addEventListener('change',render);
var inicial=lerBusca();
if(inicial)q.value=inicial;
render();
</script>
</body>
</html>
`;
}
