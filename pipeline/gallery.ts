/**
 * Galeria estática publicada no GitHub Pages (docs/index.html): grid de todos
 * os logos com busca por nome/COMPE/ISPB e cópia da URL de CDN por logo.
 * Auto-contida — os únicos recursos externos são os próprios logos, servidos
 * do jsDelivr, então a página também é uma demonstração do consumo via CDN.
 * Determinística (sem timestamps) para o writeIfChanged não gerar diff vazio.
 */

import { CDN_BASE } from './dataset';
import type { Dataset, PixDataset } from './types';

/**
 * [ispb, compe|null, nome, ispbDoAsset|null, temSvg 0|1, marca, apelidos]
 * `marca` é o token do sistema cooperativo quando o logo é compartilhado
 * (SICOOB/SICREDI/…) — a página agrupa essas afiliadas num card por sistema
 * para o grid não repetir o mesmo arquivo centenas de vezes; a busca continua
 * encontrando cada afiliada individualmente. Campos vazios viajam como ''.
 */
type Row = [string, string | null, string, string | null, number, string, string];

/**
 * Apelidos populares cujo nome oficial não contém o termo que as pessoas
 * digitam (ex.: "nubank" → NU PAGAMENTOS). Entram só na busca, não na tela.
 */
const APELIDOS: Record<string, string> = {
  '18236120': 'nubank',
  '08561701': 'pagbank',
  '18189547': 'infinitepay',
  '10573521': 'mercadopago',
};

function assetIspb(png: string): string | null {
  const match = png.match(/(\d{8})\.png$/);
  return match?.[1] ?? null;
}

export function buildGalleryHtml(dataset: Dataset, pixDataset: PixDataset): string {
  const rows: Row[] = [...dataset.banks, ...pixDataset.institutions].map((inst) => [
    inst.ispb,
    inst.compe,
    inst.name,
    inst.logo ? assetIspb(inst.logo.png) : null,
    inst.logo?.svg ? 1 : 0,
    inst.logo?.source.type === 'brand' ? (inst.logo.source.brand ?? '') : '',
    APELIDOS[inst.ispb] ?? '',
  ]);
  rows.sort((a, b) => a[2].localeCompare(b[2], 'pt-BR') || a[0].localeCompare(b[0]));
  const total = rows.length;
  const comLogo = rows.filter((r) => r[3]).length;
  const json = JSON.stringify(rows).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>logos-bancos-br — logos oficiais das instituições financeiras do Brasil</title>
<meta name="description" content="Galeria de ${comLogo} logos oficiais de bancos, fintechs, instituições de pagamento e cooperativas do Brasil. Busque por nome, COMPE ou ISPB e copie a URL de CDN. Fontes 100% oficiais (Banco Central e Open Finance), atualização semanal.">
<link rel="canonical" href="https://rzmt.github.io/logos-bancos-br/">
<meta property="og:title" content="logos-bancos-br — logos oficiais dos bancos do Brasil">
<meta property="og:description" content="${comLogo} logos oficiais com proveniência, via CDN. Busque por nome, COMPE ou ISPB.">
<meta property="og:image" content="https://rzmt.github.io/logos-bancos-br/banner-logos.png">
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
  <p class="sub">${comLogo} logos oficiais de bancos, fintechs, instituições de pagamento e
  cooperativas do Brasil (${total} instituições no dataset) — derivados só de fontes oficiais
  (listas do STR e do Pix do Banco Central e diretório do Open Finance Brasil), com proveniência
  por logo e atualização semanal. Clique para copiar a URL de CDN.</p>
  <p class="links">
    <a href="https://github.com/rzmt/logos-bancos-br">GitHub</a>
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
  <p>Falta o logo de alguma instituição? <a href="https://github.com/rzmt/logos-bancos-br/blob/main/CONTRIBUTING.md">Veja como contribuir</a> —
  só é preciso achar a URI oficial; o pipeline faz o resto.</p>
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
    img.loading='lazy';img.alt='';img.src=CDN+'/logos/png/'+asset+'.png';
    chip.appendChild(img);
  }else{
    chip.className='chip nada';chip.textContent='sem logo';
  }
  el.appendChild(chip);
  var n=document.createElement('div');n.className='nome';n.textContent=nome;n.title=nome;el.appendChild(n);
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
  var img=document.createElement('img');img.loading='lazy';img.alt='';
  img.src=CDN+'/logos/png/'+info.asset+'.png';chip.appendChild(img);
  el.appendChild(chip);
  var n=document.createElement('div');n.className='nome';
  n.textContent=brandLabel(token)+' — sistema cooperativo';n.title=n.textContent;el.appendChild(n);
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
  a.onclick=function(e){e.preventDefault();q.value=brandLabel(token);render();q.focus()};
  acts.appendChild(a);
  el.appendChild(acts);
  return el;
}
function combina(r,termo){
  return norm(r[2]).indexOf(termo)>=0||r[0].indexOf(termo)>=0||(!!r[1]&&r[1].indexOf(termo)>=0)||(!!r[6]&&r[6].indexOf(termo)>=0)
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
      (ordem.length?' + '+ordem.length+' sistemas cooperativos ('+afiliadas+' afiliadas agrupadas — cada uma aparece na busca)':'');
  }
}
q.addEventListener('input',render);
semlogo.addEventListener('change',render);
render();
</script>
</body>
</html>
`;
}
