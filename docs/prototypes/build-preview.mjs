// Protótipo descartável para validar o visual. Não é importado pela aplicação.
// Gerar: node --conditions=react-server --import ./tests/register.mjs docs/prototypes/build-preview.mjs
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {geoIdentity,geoPath} from 'd3-geo';
import {carregarApuracao,carregarReplay} from '../../src/lib/static-data.ts';
import {aplicarReplay} from '../../src/lib/replay.ts';
import {criarRoteiro,indiceNoTempo} from '../../src/lib/timelapse.ts';
import {UFS} from '../../src/lib/ufs.ts';
const root=new URL('./',import.meta.url);
await mkdir(new URL('assets/',root),{recursive:true});
const [final,replay]=await Promise.all([carregarApuracao(),carregarReplay()]);
const roteiro=criarRoteiro(replay);
const slim=r=>({pct:r?.pctTotalizado??0,c:(r?.candidatos??[]).map(c=>({n:c.numero,v:c.votos,p:c.pct}))});
const frames=Array.from({length:91},(_,t)=>{const r=aplicarReplay(final,replay,indiceNoTempo(roteiro,t*1000));return{t:r.nacional.isoDataHora,br:slim(r.nacional),ufs:Object.fromEntries(Object.entries(r.ufs).map(([uf,r])=>[uf,slim(r)]))}});
const geo=JSON.parse(await readFile('src/data/brasil-ufs.json','utf8'));
const projection=geoIdentity().reflectY(true).fitExtent([[270,70],[970,825]],geo),path=geoPath(projection);
const shapes=geo.features.map(f=>{const[x,y]=path.centroid(f),[[x0,y0],[x1,y1]]=path.bounds(f);return{uf:f.properties.uf,d:path(f),x,y,r:Math.hypot(x1-x0,y1-y0)+1}});
const map=`<svg class="map" viewBox="250 50 740 795" role="group" aria-label="Mapa proporcional da votação por estado"><defs>${shapes.map(s=>`<clipPath id="clip-${s.uf}"><path d="${s.d}"/></clipPath>`).join('')}</defs>${shapes.map(s=>`<g class="state" id="uf-${s.uf}" data-uf="${s.uf}" role="button" tabindex="0" aria-pressed="false" aria-label="${UFS[s.uf]}"><g clip-path="url(#clip-${s.uf})"><path class="base" d="${s.d}"/><path class="slice"/></g><path class="outline" d="${s.d}"/><circle class="pie-outline" cx="${s.x}" cy="${s.y}" r="11.5"/><circle class="dot-flavio" cx="${s.x}" cy="${s.y}" r="10"/><path class="dot-lula"/><text x="${s.x}" y="${s.y+27}" text-anchor="middle">${s.uf.toUpperCase()}</text></g>`).join('')}</svg>`;
const dataURI=async(path,mime)=>'data:'+mime+';base64,'+(await readFile(path)).toString('base64');
let html=await readFile(new URL('lideranca.template.html',root),'utf8');
for(const[key,value]of Object.entries({__FONT__:await dataURI('src/app/fonts/inter-latin.woff2','font/woff2'),__LULA_PHOTO__:await dataURI('public/fotos/6258/280002542548.jpeg','image/jpeg'),__FLAVIO_PHOTO__:await dataURI('public/fotos/6258/280002551544.jpeg','image/jpeg'),__LULA_CUTOUT__:await dataURI('public/imagens/lula.png','image/png'),__OPTIONS__:Object.entries(UFS).map(([uf,n])=>`<option value="${uf}">${n}</option>`).join(''),__MAP__:map,__DATA__:JSON.stringify(frames),__NAMES__:JSON.stringify(UFS),__SHAPES__:JSON.stringify(shapes.map(({uf,x,y,r})=>({uf,x,y,r})))}))html=html.replaceAll(key,value);
await writeFile(new URL('lideranca.html',root),html);
for(const[src,name]of[['public/sons/lula-vitoria.mp3','lula-vitoria.mp3'],['public/lottie/confete.json','confete.json'],['node_modules/lottie-web/build/player/lottie_light.min.js','lottie_light.min.js']])await copyFile(src,new URL('assets/'+name,root));
console.log(JSON.stringify({html:'docs/prototypes/lideranca.html',frames:frames.length,estados:shapes.length,bytes:Buffer.byteLength(html),base:'2705a75'}));
