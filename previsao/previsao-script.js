/* ============================================================
   Open-Meteo — API meteorológica europeia, gratuita, sem chave
   Múltiplas coordenadas em uma única requisição.

   Estrutura padrão do portfólio: markup em previsao.html, estilo em
   previsao-styles.css e este módulo ESM sobre src/core (App + i18n + tema +
   dock global). O app deixou de ser autocontido com i18n e tema próprios.

   Velocidade do vento em m/s em TODOS os idiomas: pedimos
   wind_speed_unit=ms à Open-Meteo, então os valores já chegam convertidos.
   ============================================================ */

import { App, i18n } from '../src/core/app.js';

// 4 slots persistentes no localStorage. Os quatro têm defaults (Milano, Curitiba,
// Gotemburgo e Balneário Camboriú) gravados no boot se o slot ainda não foi
// definido pelo usuário.
// Qualquer slot pode ser apagado com a lixeira e substituído por uma busca.
const N_SLOTS = 4;
const LS_SLOT    = i => `previsao_slot_${i}_v2`;   // v2: all-4-slots layout
const LS_CITY    = 'previsao_city_v1';
const LS_HISTMAX = 'previsao_histmax_v1';
const HISTMAX_TTL_DAYS = 7;

const SLOT_DEFAULTS = [
  { id:'milao',    name:'Milão',    nameIt:'Milano', lat: 45.4642, lon:  9.1900 },
  { id:'curitiba', name:'Curitiba', lat:-25.4284,    lon:-49.2733 },
  { id:'goteborg', name:'Gotemburgo', nameIt:'Göteborg', lat: 57.7089, lon: 11.9746 },
  { id:'balneario-camboriu', name:'Balneário Camboriú', lat:-26.9906, lon:-48.6348 }
];

function loadSlotCity(i){
  try { const r=JSON.parse(localStorage.getItem(LS_SLOT(i))); return (r&&r.id&&r.lat)?r:null; }
  catch(e){ return null; }
}
function saveSlotCity(i,city){ try{ localStorage.setItem(LS_SLOT(i),JSON.stringify({id:city.id,name:city.name,nameIt:city.nameIt||undefined,lat:city.lat,lon:city.lon})); }catch(e){} }
// Grava o sentinela 'null' (e não removeItem): assim o seedDefaults não
// re-semeia o default no próximo load e a exclusão do slot persiste.
function clearSlotCity(i){ try{ localStorage.setItem(LS_SLOT(i),'null'); }catch(e){} }

// Na primeira visita, grava os defaults nos slots que ainda não têm nada salvo.
(function seedDefaults(){
  for(let i=0;i<N_SLOTS;i++){
    if(!localStorage.getItem(LS_SLOT(i)) && SLOT_DEFAULTS[i]) saveSlotCity(i, SLOT_DEFAULTS[i]);
  }
})();

// slotCities[0..3] = city object ou null
let slotCities = Array.from({length:N_SLOTS}, (_,i) => loadSlotCity(i));

// CITIES = slots não-nulos em ordem (sem nulls)
function buildCities(){ return slotCities.filter(Boolean); }
let CITIES = buildCities();

// índice em CITIES para o slot si
function cityIdxForSlot(si){
  let n=0; for(let i=0;i<si;i++) if(slotCities[i]) n++; return n;
}
/* Traduções: vêm de src/i18n/previsao.json, carregadas pelo core (App) — este
   app deixou de ter i18n inline e segue a estrutura dos demais. */
const T = () => i18n.traducoes[i18n.obterIdiomaAtual()] || i18n.traducoes['it-IT'] || {};
// Espelho do idioma ativo do core. Ressincronizado a cada troca (ver o callback
// aoTrocarIdioma), para que os usos abaixo sigam lendo uma string simples.
let LANG = 'it-IT';

// Unidade de vento: m/s em TODOS os idiomas, por decisão de produto. É uma
// constante, e não uma chave de i18n, justamente para que não possa ser
// traduzida de volta para km/h em um idioma só.
const WIND_UNIT = 'm/s';
const cityName = c => (LANG.startsWith('it') && c.nameIt) ? c.nameIt : c.name;
// Escapa dados externos (geocoding/localStorage) antes de injetar em innerHTML.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Decimais no locale ativo (vírgula em pt/it) só na EXIBIÇÃO.
const fmt1 = v => Number(v).toLocaleString(LANG, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt2 = v => Number(v).toLocaleString(LANG, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* O tema deixou de ser local: src/core/theme.js aplica data-theme e o botão
   sol/lua vive no dock global. O CSS deste app tem o dark no :root e o claro em
   html[data-theme="light"], então continua correto sob o core. */

let cityData = [];              // dados de cada cidade (índices alinhados com CITIES)
let currentIdx = (() => { const i=CITIES.findIndex(c=>c.id===localStorage.getItem(LS_CITY)); return Math.max(0,i); })();

// Máx. horário de chuva (mm) dos últimos 365 dias, por cidade — usado como teto
// FIXO da escala das barras. Carrega do cache (mesmo se vencido) para uso imediato.
let histMaxByCity = (() => {
  try { const raw = JSON.parse(localStorage.getItem(LS_HISTMAX) || 'null'); return (raw && raw.values) || {}; }
  catch (e) { return {}; }
})();

/* ──── Boot pelo core (App): tema, i18n, dock global e botão home ──── */
const appPrevisao = new App({
  appName: 'previsao',
  callbacks: {
    aoInicializar: async () => {
      LANG = i18n.obterIdiomaAtual();
      applyLangStatic();  // textos fixos (loading/erro/rodapé) no idioma atual
      wireSearch();       // campo de busca de cidade (lupa)
      wireTip();          // tooltip por hora (temperatura, vento, chuva)

      buildCityButtonShells();
      try {
        await loadAll();
        ensureHistMax();     // em background: atualiza o teto da escala e re-renderiza
        scrollPastTopbar();  // abre já rolado com o gráfico no topo
      }
      catch (err) { showError(err.message); }
    },
    // O dock global troca o idioma; aqui só ressincronizamos e re-renderizamos.
    aoTrocarIdioma: () => {
      LANG = i18n.obterIdiomaAtual();
      applyLangStatic();
      if (cityData.length) { renderCityButtons(); renderDays(); }
    }
  }
});
appPrevisao.inicializar();

/* ──── Idioma (o tema é do core; o seletor, do dock global) ──── */
function applyLangStatic(){
  const t = T();
  document.documentElement.lang = LANG;
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('loadingMsg', t.loading);
  set('errMsg', t.error);
  set('retryBtn', t.retry);
  set('footerBrand', t.footer);
  set('sourceLbl', t.source + ': ');
  const home = document.querySelector('.home-button-fixed');
  if (home) { home.title = t.home; home.setAttribute('aria-label', t.home); }
  const si = document.getElementById('searchInput'); if (si) si.placeholder = t.searchPh;
}

function scrollPastTopbar(){
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  requestAnimationFrame(() => {
    const screen = document.querySelector('.screen');
    if (screen) screen.scrollIntoView({ block: 'start' });  // alinha o gráfico ao topo, escondendo a barra
  });
}

/* ──── Constrói botões vazios (antes dos dados chegarem) ──── */
function buildCityButtonShells(){
  const wrap = document.getElementById('cityBtns');
  wrap.innerHTML = '';
  for(let si=0; si<N_SLOTS; si++) wrap.appendChild(makeSlotBtn(si, false));
}

/* Cria o botão de um slot — vazio (lupa) ou com cidade (dados + lixeira). */
function makeSlotBtn(si, withData){
  const city = slotCities[si];
  const btn  = document.createElement('button');
  btn.type   = 'button';
  btn.dataset.slot = si;
  if(!city){
    btn.className = 'city-btn search-btn';
    btn.title = T().search;
    btn.innerHTML = '<span class="lupa">🔍</span>';
    btn.addEventListener('click', () => openSearch(si));
    return btn;
  }
  const ci = cityIdxForSlot(si);
  btn.className = 'city-btn' + (!withData ? ' loading' : '') + (ci === currentIdx ? ' active' : '');
  if(withData && cityData[ci]){
    const cur = cityData[ci].current, [emo,desc] = wmo(cur.weather_code);
    btn.innerHTML = `<span class="cb-name">${esc(cityName(city))}</span><span class="cb-row1"><span class="cb-emoji" title="${desc}">${emo}</span><span class="cb-temp" title="${T().tempLabel}">${Math.round(cur.temperature_2m)}°</span></span><span class="cb-meta" title="🌡 ${T().feelsLabel} · 💨 ${T().windLabel} (${WIND_UNIT})">🌡${Math.round(cur.apparent_temperature)}° · 💨${Math.round(cur.wind_speed_10m)} ${WIND_UNIT}</span><button type="button" class="slot-clear" title="${T().search}">🗑️</button>`;
  } else {
    btn.innerHTML = `<span class="cb-name">${esc(cityName(city))}</span><span class="cb-row1"><span class="cb-emoji">—</span><span class="cb-temp">—°</span></span><span class="cb-meta">— · —</span><button type="button" class="slot-clear" title="${T().search}">🗑️</button>`;
  }
  btn.addEventListener('click', (e) => { if(!e.target.closest('.slot-clear')) selectCity(ci); });
  btn.querySelector('.slot-clear').addEventListener('click', (e) => { e.stopPropagation(); clearSlot(si); });
  return btn;
}

/* ──── Fetch (todas as cidades em uma requisição) ──── */
async function loadAll(){
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude:  CITIES.map(c => c.lat).join(','),
    longitude: CITIES.map(c => c.lon).join(','),
    hourly:    'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
    current:   'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
    daily:     'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max',
    // Vento em m/s para todos os idiomas: a conversão é feita pela própria
    // Open-Meteo, então nenhum ponto do código precisa dividir por 3,6.
    wind_speed_unit: 'ms',
    timezone:  'auto',
    forecast_days: 7
  });

  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const arr = await res.json();
  // Sempre array com múltiplas coords
  const list = Array.isArray(arr) ? arr : [arr];

  cityData = CITIES.map((c, i) => {
    const d = list[i];
    const hourlyByDay = {};
    d.hourly.time.forEach((iso, k) => {
      const day = iso.slice(0,10);
      (hourlyByDay[day] = hourlyByDay[day] || []).push({
        hour: +iso.slice(11,13),
        temp: d.hourly.temperature_2m[k],
        pop:  d.hourly.precipitation_probability[k] ?? 0,
        mm:   d.hourly.precipitation[k] ?? 0,
        code: d.hourly.weather_code[k],
        wind:    d.hourly.wind_speed_10m    ? (d.hourly.wind_speed_10m[k]    ?? 0) : 0,
        windDir: d.hourly.wind_direction_10m ? (d.hourly.wind_direction_10m[k] ?? 0) : 0
      });
    });
    const daily = d.daily.time.map((iso, k) => ({
      date: iso,
      tMax: d.daily.temperature_2m_max[k],
      tMin: d.daily.temperature_2m_min[k],
      mmSum: d.daily.precipitation_sum[k],
      popMax: d.daily.precipitation_probability_max[k] ?? 0,
      code: d.daily.weather_code[k]
    }));
    return { city:c, current:d.current, hourlyByDay, daily };
  });

  document.getElementById('loading').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  renderCityButtons();
  renderDays();
}

/* ──── Botões (já com dados) ──── */
function renderCityButtons(){
  const wrap = document.getElementById('cityBtns');
  wrap.innerHTML = '';
  for(let si=0; si<N_SLOTS; si++) wrap.appendChild(makeSlotBtn(si, true));
}

/* ──── Busca de cidade (geocoding Open-Meteo) — salva no slot no localStorage ──── */
let searchTimer = null;
let currentSearchSlot = 0;
function openSearch(si){
  currentSearchSlot = si;
  const inp = document.getElementById('searchInput');
  document.getElementById('searchResults').innerHTML = '';
  inp.value = '';
  document.getElementById('search').style.display = 'flex';
  setTimeout(() => inp.focus(), 30);
}
function closeSearch(){ document.getElementById('search').style.display = 'none'; }

async function geocode(name){
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  const idiomaGeo = { 'pt-BR': 'pt', 'it-IT': 'it', 'sv-SE': 'sv' }[LANG] || 'it';
  url.search = new URLSearchParams({ name, count: '6', language: idiomaGeo, format: 'json' });
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return (await res.json()).results || [];
}
function renderSearchResults(results){
  const box = document.getElementById('searchResults');
  if (!results.length) { box.innerHTML = `<div class="search-empty">${T().noResults}</div>`; return; }
  box.innerHTML = results.map((r, i) => {
    const sub = [r.admin1, r.country].filter(Boolean).join(' · ');
    return `<button type="button" class="search-item" data-i="${i}"><span class="si-name">${esc(r.name)}</span><span class="si-sub">${esc(sub)}</span></button>`;
  }).join('');
  box.querySelectorAll('.search-item').forEach(el =>
    el.addEventListener('click', () => addCityFromResult(results[+el.dataset.i])));
}
async function addCityFromResult(r){
  const id   = 'q_' + r.latitude.toFixed(3) + '_' + r.longitude.toFixed(3);
  const city = { id, name: r.name, lat: r.latitude, lon: r.longitude };
  slotCities[currentSearchSlot] = city;
  saveSlotCity(currentSearchSlot, city);
  CITIES     = buildCities();
  currentIdx = cityIdxForSlot(currentSearchSlot);
  try { localStorage.setItem(LS_CITY, id); } catch(e){}
  closeSearch();
  document.getElementById('loading').style.display = 'flex';
  document.getElementById('app').style.display    = 'none';
  try { await loadAll(); ensureHistMax(); }
  catch(e){ showError(e.message); }
}

/* Limpa o slot, remove do localStorage. Se estava activo ou se não há mais
   cidades, volta para o primeiro slot preenchido (ou mostra só lupas). */
async function clearSlot(si){
  const wasActive = slotCities[si] && currentIdx === cityIdxForSlot(si);
  slotCities[si] = null;
  clearSlotCity(si);
  CITIES = buildCities();
  if(CITIES.length === 0){
    // Todos os slots vazios — só mostra as lupas, sem fetch
    cityData = [];
    currentIdx = 0;
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').style.display     = 'flex';
    renderCityButtons();
    document.getElementById('days').innerHTML = '';
    return;
  }
  if(wasActive || currentIdx >= CITIES.length){
    currentIdx = 0;
    try{ localStorage.setItem(LS_CITY, CITIES[0].id); }catch(e){}
  }
  document.getElementById('loading').style.display = 'flex';
  document.getElementById('app').style.display    = 'none';
  try { await loadAll(); ensureHistMax(); }
  catch(e){ showError(e.message); }
}
function wireSearch(){
  const inp = document.getElementById('searchInput');
  const box = document.getElementById('searchResults');
  const run = async () => {
    const q = inp.value.trim();
    if (q.length < 2) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="search-empty">${T().searching}</div>`;
    try { renderSearchResults(await geocode(q)); }
    // Falha de rede não é "nenhuma cidade encontrada" — mostra o erro traduzido.
    catch (e) { box.innerHTML = `<div class="search-empty">${T().error}</div>`; }
  };
  inp.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(run, 350); });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { clearTimeout(searchTimer); run(); }
    if (e.key === 'Escape') closeSearch();
  });
  document.getElementById('searchClose').addEventListener('click', closeSearch);
  document.getElementById('search').addEventListener('click', (e) => { if (e.target.id === 'search') closeSearch(); });
}

/* ──── Tooltip por hora ──── */
function windDirLabel(deg){
  const d = Math.round(+deg/45)%8;
  // Rosa dos ventos por idioma. Em sueco, O = Ost (leste) e V = Väst (oeste),
  // o oposto da intuição de quem lê em português.
  const dirs = {
    'pt-BR': ['N','NE','L','SE','S','SO','O','NO'],
    'it-IT': ['N','NE','E','SE','S','SO','O','NO'],
    'sv-SE': ['N','NO','O','SO','S','SV','V','NV']
  };
  return (dirs[LANG] || dirs['it-IT'])[d];
}
let tipOpen = false;
function showTip(cx, cy, el){
  const hr  = el.dataset.h;
  const t   = el.dataset.t;
  const w   = el.dataset.w;
  const wd  = el.dataset.wd;
  const pop = el.dataset.pop;
  const mm  = el.dataset.mm;
  const tt  = T();
  const dir = windDirLabel(wd);
  const tip = document.getElementById('hourTip');
  tip.innerHTML =
    `<b>${String(hr).padStart(2,'0')}h</b>` +
    `<div class="tip-row">🌡️ <span>${t}°C</span></div>` +
    `<div class="tip-row">💨 <span>${w} ${WIND_UNIT} ${dir}</span></div>` +
    `<div class="tip-row">🌧️ <span>${pop}% · ${fmt1(mm)} mm</span></div>`;
  tip.style.display = 'block';
  tipOpen = true;
  marcarHoraSelecionada(el);

  // Área REALMENTE visível. Com pinch-zoom o visualViewport é um recorte do
  // layout viewport, e window.innerWidth continua reportando o layout inteiro
  // — posicionar por ele jogava o quadro para fora do que se está vendo.
  const vv = window.visualViewport;
  const vx = vv ? vv.offsetLeft : 0;
  const vy = vv ? vv.offsetTop  : 0;
  const vw = vv ? vv.width  : window.innerWidth;
  const vh = vv ? vv.height : window.innerHeight;
  const M  = 8; // margem mínima até a borda

  // Nunca mais largo que a área visível, senão nenhum clamp consegue encaixá-lo.
  tip.style.maxWidth = Math.max(120, vw - 2 * M) + 'px';

  const tw = tip.offsetWidth  || 160;
  const th = tip.offsetHeight || 90;

  // Preferência: à direita do toque; se não couber, à esquerda.
  let lx = cx + 14;
  if (lx + tw > vx + vw - M) lx = cx - tw - 14;
  let ly = cy - th / 2;

  // Clamp nos DOIS sentidos. Faltava o limite esquerdo: ao virar para a
  // esquerda perto da borda, lx ficava negativo e o quadro saía da tela.
  lx = Math.min(Math.max(lx, vx + M), vx + vw - tw - M);
  ly = Math.min(Math.max(ly, vy + M), vy + vh - th - M);

  tip.style.left = lx + 'px';
  tip.style.top  = ly + 'px';
}

/* ──── Realce da coluna da hora aberta no quadro de detalhes ────
   Sem isto o quadro aparece solto: dá o valor mas não diz de qual hora veio.
   Marca a barra vertical daquela hora, o número e o rótulo do eixo. */
function marcarHoraSelecionada(el){
  limparHoraSelecionada();

  const chart = el.closest('.c-chart');
  if (!chart) return;

  const hora = el.dataset.h;
  const left = el.style.left; // mesma escala horizontal em toda a coluna

  const barra = document.createElement('div');
  barra.className = 'hora-sel';
  barra.style.left = left;
  chart.appendChild(barra);

  el.classList.add('is-hora-sel');

  // O rótulo do eixo é posicionado pelo mesmo left%, então casa por posição.
  const alvo = [...chart.querySelectorAll('.hour-axis span:not(.axis-ico)')]
    .find(sp => parseInt(sp.textContent, 10) === parseInt(hora, 10));
  if (alvo) alvo.classList.add('is-hora-sel');
}

function limparHoraSelecionada(){
  document.querySelectorAll('.hora-sel').forEach(n => n.remove());
  document.querySelectorAll('.is-hora-sel').forEach(n => n.classList.remove('is-hora-sel'));
}
function closeTip(){ document.getElementById('hourTip').style.display = 'none'; tipOpen = false; limparHoraSelecionada(); }
function wireTip(){
  // Fase de captura: interceta qualquer clique antes de todos os outros handlers.
  // Se tooltip aberto, fecha e consome o evento — nada mais abre.
  document.addEventListener('click', e => {
    if (tipOpen) { closeTip(); e.stopPropagation(); return; }
  }, true);

  document.getElementById('days').addEventListener('click', e => {
    // Clique direto num valor: usa os dados do próprio elemento.
    const el = e.target.closest('.t-num,.t-ball');
    if (el) { showTip(e.clientX, e.clientY, el); e.stopPropagation(); return; }

    // Clique em qualquer área do gráfico: encontra a hora mais próxima pelo x%.
    const chartArea = e.target.closest('.c-chart');
    if (!chartArea) { closeTip(); return; }
    const row = chartArea.closest('.row');
    const refEl = chartArea.querySelector('.wind-wrap') || chartArea.querySelector('.spark-wrap');
    if (!refEl) { closeTip(); return; }
    const rect = refEl.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width * 100;
    const axisSpans = [...(chartArea.querySelector('.hour-axis') || document.createElement('div'))
      .querySelectorAll('span:not(.axis-ico)')];
    let best = null, bd = Infinity;
    axisSpans.forEach(s => {
      const d = Math.abs(parseFloat(s.style.left) - xPct);
      if (d < bd) { bd = d; best = s; }
    });
    if (!best) { closeTip(); return; }
    const h = parseInt(best.textContent, 10);
    const dataEl = row.querySelector(`.t-ball[data-h="${h}"],.t-num[data-h="${h}"]`);
    if (dataEl) { showTip(e.clientX, e.clientY, dataEl); e.stopPropagation(); }
    else closeTip();
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#hourTip,.c-chart')) closeTip();
  });
}

function selectCity(i){
  if (i === currentIdx) return;
  currentIdx = i;
  try{ localStorage.setItem(LS_CITY, CITIES[i].id); }catch(e){}
  renderCityButtons();
  renderDays();
}

/* ──── Histórico: maior chuva horária (mm) dos últimos 365 dias por cidade ──── */
function histCacheFresh(){
  try {
    const raw = JSON.parse(localStorage.getItem(LS_HISTMAX) || 'null');
    if (!raw || !raw.date || !raw.values) return false;
    if (!CITIES.every(c => typeof raw.values[c.id] === 'number')) return false;
    // Compara por timestamp quando disponível (raw.ts); o fallback por data
    // misturava dia UTC com meia-noite local e podia invalidar o cache à toa.
    const base = typeof raw.ts === 'number' ? raw.ts : new Date(raw.date + 'T00:00:00').getTime();
    const ageDays = (Date.now() - base) / 86400000;
    return ageDays >= 0 && ageDays < HISTMAX_TTL_DAYS;
  } catch (e) { return false; }
}

async function fetchHistMax(){
  // API de arquivo histórico do Open-Meteo (latência de alguns dias → end = hoje-5).
  const end = new Date();   end.setDate(end.getDate() - 5);
  const start = new Date(end); start.setDate(start.getDate() - 364);
  const fmt = d => d.toISOString().slice(0, 10);

  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.search = new URLSearchParams({
    latitude:  CITIES.map(c => c.lat).join(','),
    longitude: CITIES.map(c => c.lon).join(','),
    start_date: fmt(start),
    end_date:   fmt(end),
    hourly:    'precipitation',
    timezone:  'auto'
  });

  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const arr = await res.json();
  const list = Array.isArray(arr) ? arr : [arr];

  const out = {};
  CITIES.forEach((c, i) => {
    const p = (list[i] && list[i].hourly && list[i].hourly.precipitation) || [];
    let m = 0;
    for (const v of p) { if (v != null && v > m) m = v; }
    out[c.id] = m;
  });
  return out;
}

async function ensureHistMax(){
  if (histCacheFresh()) return;            // cache ainda válido → não refaz a requisição pesada
  try {
    const vals = await fetchHistMax();
    histMaxByCity = vals;
    localStorage.setItem(LS_HISTMAX, JSON.stringify({ date: new Date().toISOString().slice(0,10), ts: Date.now(), values: vals }));
    if (cityData.length) renderDays();      // re-renderiza com o teto histórico
  } catch (e) { /* mantém o fallback (semana) */ }
}

/* ──── WMO codes ──── */
function wmo(code){
  // Seletor de variação ️ (U+FE0F) força a apresentação COLORIDA do emoji; sem
  // ele, vários destes glifos viram texto monocromático (preto no tema claro).
  // Descrições vêm do I18N (wmoDesc) para acompanhar o idioma ativo.
  const d = T().wmoDesc;
  if (code === 0)              return ['☀️', d.clear];
  if (code === 1)              return ['🌤️', d.quasiClear];
  if (code === 2)              return ['⛅', d.partCloudy];
  if (code === 3)              return ['☁️', d.cloudy];
  if (code === 45 || code===48)return ['🌫️', d.fog];
  if (code >= 51 && code <= 57)return ['🌦️', d.drizzle];
  if (code === 61)             return ['🌧️', d.rainLight];
  if (code === 63)             return ['🌧️', d.rain];
  if (code === 65)             return ['🌧️', d.rainHeavy];
  if (code >= 66 && code <= 67)return ['🌧️', d.freezing];
  if (code >= 71 && code <= 77)return ['❄️', d.snow];
  if (code >= 80 && code <= 82)return ['🌦️', d.showers];
  if (code === 85 || code===86)return ['🌨️', d.snowShowers];
  if (code === 95)             return ['⛈️', d.thunder];
  if (code >= 96 && code <= 99)return ['⛈️', d.thunderHail];
  return ['🌡️','—'];
}

/* ──── Render days table ──── */
function renderDays(){
  const wrap = document.getElementById('days');
  const cd = cityData[currentIdx];
  wrap.innerHTML = '';
  const todayISO = cd.daily[0] ? cd.daily[0].date : new Date().toISOString().slice(0,10);

  // Teto FIXO da escala das barras de chuva = maior chuva horária dos últimos
  // 365 dias para esta cidade (histMaxByCity). Assim a mesma quantidade tem a
  // mesma altura em todos os dias e dá para comparar os dias entre si. Enquanto
  // o histórico não chega, usa o pico da semana como fallback.
  let weekMaxMM = 0;
  cd.daily.forEach(day => {
    (cd.hourlyByDay[day.date] || []).forEach(h => { if (h.mm > weekMaxMM) weekMaxMM = h.mm; });
  });
  const hist = histMaxByCity[cd.city.id];
  const scaleMax = (typeof hist === 'number' && hist > 0) ? hist : weekMaxMM;

  // Escala vertical de temperatura PADRONIZADA: mín/máx de toda a semana,
  // incluindo os alvos da estação (20/22/24) caso não sejam atingidos. Assim
  // todos os dias usam a mesma régua e ficam comparáveis entre si.
  let weekTMin = Infinity, weekTMax = -Infinity, setLo = Infinity, setHi = -Infinity;
  cd.daily.forEach(day => {
    (cd.hourlyByDay[day.date] || []).forEach(h => {
      if (h.temp < weekTMin) weekTMin = h.temp;
      if (h.temp > weekTMax) weekTMax = h.temp;
    });
    const sp = seasonSetpoint(day.date, cd.city.lat);
    if (sp < setLo) setLo = sp;
    if (sp > setHi) setHi = sp;
  });
  const yLowG  = Math.min(weekTMin, setLo);
  const yHighG = Math.max(weekTMax, setHi);

  // Hora atual no fuso da cidade — vem do campo current.time da API ("2024-01-15T14:00"),
  // que já é horário local. Fallback para o dispositivo só se a API falhar.
  const nowH = cd.current ? parseInt(cd.current.time.slice(11, 13), 10) : new Date().getHours();

  cd.daily.forEach((day, di) => {
    let hours = cd.hourlyByDay[day.date] || [];
    const next = cd.daily[di + 1];               // 24h = 00h do dia seguinte
    if (next) {
      const nh = (cd.hourlyByDay[next.date] || [])[0];
      if (nh) hours = hours.concat([{ ...nh, hour: 24 }]);
    } else if (hours.length) {
      // Último dia não tem "dia seguinte": repete a 23h como 24h só para que
      // TODOS os dias tenham o mesmo número de horas (00–24).
      hours = hours.concat([{ ...hours[hours.length - 1], hour: 24 }]);
    }
    if (hours.length < 2) return;
    wrap.insertAdjacentHTML('beforeend', buildRow(day, hours, day.date === todayISO, nowH, scaleMax, cd.city.lat, yLowG, yHighG));
  });

  const c = cd.city;
  document.getElementById('footLoc').textContent =
    `📍 ${cityName(c)} · ${fmt2(c.lat)}° · ${fmt2(c.lon)}°`;
  document.title = `Previsão · ${cityName(c)}`;
}

/* ──── Build one row with SVG sparkline ──── */
function buildRow(day, hours, isToday, nowH, scaleMax, lat, yLowG, yHighG){
  // Temperatura-alvo de interior para a estação do dia (verão 24°, inverno 20°,
  // primavera/outono 22°), com hemisfério pela latitude (estações invertidas
  // no Brasil). Vale para a linha de referência e para o verde do gradiente.
  const setpoint = seasonSetpoint(day.date, lat);
  const dt = new Date(day.date + 'T12:00:00');
  const dow = isToday ? T().today : T().dow[dt.getDay()];
  const dnum = `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
  const [emo, emoDesc] = wmo(dominantDayCode(hours, day.code));   // clima prevalente 8h–20h (tempestade tem prioridade)

  const temps = hours.map(h => h.temp);
  const mms   = hours.map(h => h.mm);
  const n     = temps.length;

  const tMin = Math.min(...temps), tMax = Math.max(...temps);
  const iMin = temps.indexOf(tMin), iMax = temps.indexOf(tMax);

  const W = 240, H = 60, GUT = 14, VBW = W + GUT;
  const WIND_H = 12;                             // wind SVG viewBox height
  const padT = 6;
  const WIND_BASE = 2, WIND_SPAN = 8;
  const padB = 4;
  const ch = H - padT - padB;                   // temperature usable height (= 50)

  // Escala vertical PADRONIZADA da semana (mesma régua em todos os dias), já
  // incluindo os alvos da estação. Em dias frios a curva fica embaixo (linha-
  // alvo no alto, sem ser alcançada); em dias quentes, em cima; tudo comparável.
  const yLow  = yLowG;
  const yHigh = yHighG;
  const yRange = Math.max(0.5, yHigh - yLow);

  // Geometria horizontal: as horas ocupam TODA a largura, com margem de 0,5 passo
  // de cada lado (a 00h não fica cortada, a última hora chega à borda e as bolas
  // continuam tangentes). Sem mais o slot de ícones de série à esquerda.
  const stepX = (n === 1) ? 0 : VBW / n;
  const padXL = 0.5 * stepX;
  const xAt = i => (n === 1 ? VBW / 2 : padXL + i * stepX);
  const yAt = t => padT + ch * (1 - (t - yLow) / yRange);

  // Diâmetro das bolas e fonte da legenda de horas, em cqw (% da largura do
  // gráfico) para acompanhar a tela. Diâmetro da bola = passo entre horas
  // (tangentes); a fonte das horas usa o mesmo tamanho das bolas de temperatura.
  const dotPct = (n === 1) ? 20 : 100 / n;
  const ballPct = dotPct * 0.90;
  const fcqw   = (ballPct * 0.8).toFixed(2);   // fonte ampla — pode leve overflow do círculo

  // ── Única linha horizontal de referência: a temperatura-alvo da estação atual. ──
  const degLinesSvg = `<line x1="0" y1="${yAt(setpoint).toFixed(1)}" x2="${VBW}" y2="${yAt(setpoint).toFixed(1)}" stroke="#3fb950" stroke-opacity=".55" stroke-width="1" vector-effect="non-scaling-stroke"><title>${T().targetTitle}: ${setpoint}°</title></line>`;

  // ── Grade vertical por hora (3 em 3 h mais marcada; a hora ATUAL, só no
  //    dia de hoje, fica realçada). ──
  const hourGrid = hours.map((h, i) => {
    const x = xAt(i).toFixed(1);
    const isNow = isToday && h.hour === nowH;
    const cls = isNow ? 'g-now'
      : h.hour === 0    ? 'g-h3'
      : h.hour % 12 === 0 ? 'g-h12'
      : h.hour % 6  === 0 ? 'g-h6'
      : h.hour % 3  === 0 ? 'g-h3'
      : 'g-min';
    return `<line x1="${x}" y1="${padT}" x2="${x}" y2="${(padT+ch).toFixed(1)}" class="${cls}" stroke-width="${isNow ? '1.2' : '1'}" vector-effect="non-scaling-stroke"/>`;
  }).join('');

  // ── Força do vento por hora: barrinha na base, altura e opacidade ∝ velocidade ──
  const WIND_MAX = 10;                              // m/s ~ barra cheia (eram 35 km/h)
  const wBarW = stepX * 0.9;
  const windBars = hours.map((h, i) => {
    const frac = clamp((h.wind || 0) / WIND_MAX, 0, 1);
    if (frac < 0.04) return '';
    const hgt = WIND_BASE + WIND_SPAN * frac;       // 2..10 unidades
    const op  = (0.18 + 0.6 * frac).toFixed(2);
    const tip = `${T().windLabel} ${String(h.hour).padStart(2,'0')}h: ${Math.round(h.wind||0)} ${WIND_UNIT}`;
    return `<rect x="${(xAt(i) - wBarW/2).toFixed(1)}" y="${(WIND_H - hgt).toFixed(1)}" width="${wBarW.toFixed(1)}" height="${hgt.toFixed(1)}" fill="#9aa7d6" opacity="${op}"><title>${tip}</title></rect>`;
  }).join('');

  // Pico de vento do dia (a velocidade vai dentro da bolinha no ponto de leitura).
  let iWindMax = 0, windMax = 0;
  hours.forEach((h, i) => { const w = h.wind || 0; if (w > windMax) { windMax = w; iWindMax = i; } });
  const windFrac = clamp(windMax / WIND_MAX, 0, 1);
  const windTopY = WIND_H - (WIND_BASE + WIND_SPAN * windFrac);

  // ── Chuva: cada hora com chuva preenche a ALTURA TODA com hachura de linhas
  //    tracejadas inclinadas (simula chuva). Inclinação ∝ vento; densidade e
  //    espessura ∝ quantidade (relativa ao teto fixo de 365 dias); opacidade ∝
  //    probabilidade. ──
  const rainScaleMax = Math.max(scaleMax || 0, 0.1);
  const rBarW = stepX * 0.9;
  const rainDefs = [], rainRects = [];
  mms.forEach((m, i) => {
    if (m <= 0.05) return;
    const pop  = hours[i].pop  || 0;
    const wind = hours[i].wind || 0;
    const frac = clamp(m / rainScaleMax, 0, 1);
    const spacing = 5.2 - 3.2 * frac;               // mais chuva → linhas mais juntas (5,2→2,0)
    const thick   = (0.9 + 1.4 * frac).toFixed(2);  // mais chuva → linhas mais grossas (0,9→2,3)
    const angle   = clamp(wind * 1.1, 8, 60).toFixed(0); // mais vento → mais inclinada
    // Opacidade ∝ probabilidade, mas com piso visível para prob/intensidade
    // baixas (antes quase sumiam). A intensidade (frac) também eleva o piso, então
    // chuva FORTE continua nítida mesmo com probabilidade baixa. Mantém o degradê
    // fraca→média→forte (espessura/densidade ∝ intensidade).
    const op      = Math.max(0.3, frac * 0.45, (pop / 100) * 0.85).toFixed(2);
    const x = (xAt(i) - rBarW/2).toFixed(1);
    const pid = `rn${day.date.replace(/-/g,'')}_${currentIdx}_${i}`;
    rainDefs.push(`<pattern id="${pid}" patternUnits="userSpaceOnUse" width="${spacing.toFixed(2)}" height="${spacing.toFixed(2)}" patternTransform="rotate(${angle})"><line x1="0" y1="-0.5" x2="0" y2="${(spacing+0.5).toFixed(2)}" class="rain-hatch" stroke-width="${thick}" stroke-dasharray="${(spacing*0.5).toFixed(2)} ${(spacing*0.55).toFixed(2)}"/></pattern>`);
    const rainTip = `${T().rainLabel} ${String(hours[i].hour).padStart(2,'0')}h: ${fmt1(m)} mm · ${Math.round(pop)}% ${T().probLabel}`;
    rainRects.push(`<rect x="${x}" y="${padT}" width="${rBarW.toFixed(1)}" height="${ch}" fill="url(#${pid})" opacity="${op}"><title>${rainTip}</title></rect>`);
  });
  const rainDefsSvg = rainDefs.join('');
  const rainSvg = rainRects.join('');

  const pts = temps.map((t, i) => `${xAt(i).toFixed(1)},${yAt(t).toFixed(1)}`);
  const linePath = 'M' + pts.join(' L');

  const gid = 'g' + day.date.replace(/-/g,'') + '_' + currentIdx;

  // Gradiente da linha de temperatura: vermelho (quente) → verde (alvo) → azul (frio).
  const tgid = 't' + gid;
  const oSet = (1 - (setpoint - yLow) / yRange);
  let tempStops;
  if (oSet <= 0)      tempStops = '<stop offset="0%" stop-color="#3fb950"/><stop offset="100%" stop-color="#4aa8ff"/>';
  else if (oSet >= 1) tempStops = '<stop offset="0%" stop-color="#ff5b4a"/><stop offset="100%" stop-color="#3fb950"/>';
  else                tempStops = `<stop offset="0%" stop-color="#ff5b4a"/><stop offset="${(oSet*100).toFixed(1)}%" stop-color="#3fb950"/><stop offset="100%" stop-color="#4aa8ff"/>`;

  // Cores dos rótulos de máx/mín: se a máxima não alcança o alvo, fica verde (em
  // vez de vermelho); se a mínima fica acima do alvo, verde (em vez de azul).
  const maxCol = (tMax < setpoint) ? '#3fb950' : '#ff5b4a';
  const minCol = (tMin > setpoint) ? '#3fb950' : '#4aa8ff';

  // Há chuva relevante no dia? (prob >30% e >0,5mm) → aviso ao lado do dia.
  // (ignora a 24h, que é dado do dia seguinte)
  const needRainAction = hours.some(h => h.hour < 24 && h.pop > 30 && h.mm > 0.5);

  // Horas que recebem cor na legenda: máx/mín de temperatura (suas cores), pico
  // de vento (cor do vento) e horas de chuva (cor da chuva, se não forem máx/mín).
  // Conjuntos de horas com temperatura máxima e mínima (podem repetir-se).
  const maxHourSet = new Set(hours.filter(h => h.temp === tMax).map(h => h.hour));
  const minHourSet = new Set(hours.filter(h => h.temp === tMin).map(h => h.hour));
  const windHour = windMax > 0 ? hours[iWindMax].hour : -1;
  const rainHourSet = new Set(hours.filter(h => h.hour < 24 && h.pop > 30 && h.mm > 0.5).map(h => h.hour));
  const hourColor = (h) => {
    if (maxHourSet.has(h.hour)) return maxCol;
    if (minHourSet.has(h.hour)) return minCol;
    if (h.hour === windHour) return '#9aa7d6';
    if (rainHourSet.has(h.hour)) return 'var(--rain)';
    return '';
  };

  // Legenda com TODAS as horas (00–24), abaixo de cada dia; e também acima no
  // dia de hoje. As horas-chave (máx/mín/vento/chuva) saem coloridas.
  const hourAxisHTML = `
        <div class="hour-axis dense">
          ${hours.map((h, i) => {
            const pct = xAt(i) / VBW * 100;
            const base = `left:${pct.toFixed(1)}%;transform:translateX(-50%);font-size:clamp(7px,${fcqw}cqw,0.85rem)`;
            const col = hourColor(h);
            const isNow = isToday && h.hour === nowH;
            const extra = (col ? `;color:${col};font-weight:700` : '') + (isNow ? `;font-weight:800${col ? '' : ';color:var(--text)'}` : '');
            return `<span class="${isNow ? 'now' : ''}" style="${base}${extra}">${String(h.hour).padStart(2,'0')}</span>`;
          }).join('')}
        </div>`;

  // Uma bola POR HORA com a temperatura dentro, na cor do gradiente daquela
  // temperatura. O diâmetro = espaçamento entre horas (em cqw, relativo à
  // largura do gráfico) → as bolas ficam tangentes, escalando com a tela.
  const GRAPH = '#2b2f36';
  const tempBalls = hours.map((h, i) => {
    const hh  = String(h.hour).padStart(2,'0');
    const v   = Math.round(h.temp);
    const tip = `${T().tempLabel} ${hh}h: ${v}°`;
    const left = (xAt(i) / VBW * 100).toFixed(2);
    const top  = (yAt(h.temp) / H * 100).toFixed(1);
    const rgb  = tempColor(h.temp, setpoint, yLow, yHigh);
    // Bola cheia SÓ na máx/mín do dia (destaque). Nas demais horas, só o número
    // (cor da letra = gradiente da temperatura), com um halo que interrompe a
    // linha atrás dele para ler fácil — sem a poluição das bolas em toda hora.
    const da = `data-h="${h.hour}" data-t="${v}" data-w="${Math.round(h.wind||0)}" data-wd="${Math.round(h.windDir||0)}" data-pop="${Math.round(h.pop||0)}" data-mm="${(h.mm||0).toFixed(1)}"`;
    if (h.temp === tMax || h.temp === tMin) {
      // Máxima: vermelho se acima do alvo sazonal, verde se abaixo.
      // Mínima: azul se abaixo do alvo sazonal, verde se acima.
      const ballBg = (h.temp === tMax) ? maxCol : minCol;
      return `<span class="t-ball" ${da} style="left:${left}%;top:${top}%;width:min(${ballPct.toFixed(2)}cqw, 26cqh);font-size:${fcqw}cqw;background:${ballBg};color:${GRAPH}">${v}</span>`;
    }
    return `<span class="t-num" ${da} style="left:${left}%;top:${top}%;font-size:${fcqw}cqw;color:rgb(${rgb})">${v}</span>`;
  }).join('');

  // Bola do PICO de vento do dia (no topo da barra mais alta), com a velocidade.
  // Mesmo tamanho e estilo que os números de temperatura (t-num), na cor das barras.
  const windBall = windMax > 0
    ? `<span class="t-num" data-h="${hours[iWindMax].hour}" data-t="${Math.round(hours[iWindMax].temp)}" data-w="${Math.round(windMax)}" data-wd="${Math.round(hours[iWindMax].windDir||0)}" data-pop="${Math.round(hours[iWindMax].pop||0)}" data-mm="${(hours[iWindMax].mm||0).toFixed(1)}" title="${T().windPeak} ${Math.round(windMax)} ${WIND_UNIT} · ${String(hours[iWindMax].hour).padStart(2,'0')}h" style="left:${(xAt(iWindMax)/VBW*100).toFixed(2)}%;top:${(windTopY/WIND_H*100).toFixed(1)}%;font-size:${fcqw}cqw;color:#9aa7d6">${Math.round(windMax)}</span>`
    : '';


  // Resumo textual do dia para leitores de tela (os SVGs são decorativos).
  const ariaResumo = `${dow} ${dnum}: ${emoDesc} · ↑${Math.round(tMax)}° ↓${Math.round(tMin)}°`
    + (windMax > 0 ? ` · ${T().windPeak} ${Math.round(windMax)} ${WIND_UNIT}` : '')
    + (needRainAction ? ` · ${T().rainLabel}` : '');
  return `
    <div class="row${isToday ? ' today' : ''}" role="img" aria-label="${esc(ariaResumo)}">
      <div class="c-date">
        <span class="dow">${dow}</span>
        <span class="dnum">${dnum}</span>
        <span class="emo" title="${emoDesc}">${emo}</span>
        ${needRainAction ? `<span class="day-rain" title="${T().rainAction}">💧</span>` : ''}
      </div>
      <div class="c-chart">
        <div class="wind-wrap">
          <svg class="spark" viewBox="0 0 ${VBW} ${WIND_H}" preserveAspectRatio="none" aria-hidden="true">
            ${windBars}
          </svg>
          ${windBall}
        </div>
        ${hourAxisHTML}
        <div class="spark-wrap">
          <svg class="spark" viewBox="0 0 ${VBW} ${H}" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="${tgid}" gradientUnits="userSpaceOnUse" x1="0" y1="${padT}" x2="0" y2="${(padT+ch).toFixed(1)}">
                ${tempStops}
              </linearGradient>
              ${rainDefsSvg}
            </defs>
            ${hourGrid}
            ${rainSvg}
            <path d="${linePath}" fill="none" stroke="url(#${tgid})" stroke-width="3"
                  vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"><title>${T().tempLabel}</title></path>
          </svg>
          ${tempBalls}
        </div>
      </div>
    </div>
  `;
}

function formatHr(h){ return String(h).padStart(2,'0') + 'h'; }
function clamp(v, lo, hi){ return Math.min(hi, Math.max(lo, v)); }

/* Ícone do dia = clima prevalente entre 8h e 20h (sol, nuvem, nublado, chuva ou
   tempestade), pela maior frequência das categorias dos códigos WMO horários.
   Em empate, prevalece a categoria mais significativa (tempestade > chuva > …). */
function dominantDayCode(hours, dailyCode){
  const dayHrs = hours.filter(h => h.hour >= 8 && h.hour <= 20);
  const src = dayHrs.length ? dayHrs : hours;
  const cat = c => {
    if (c >= 95) return 'storm';
    if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
    if (c === 45 || c === 48) return 'fog';
    if (c === 3) return 'cloud';
    if (c === 2) return 'partly';
    return 'clear';                              // 0, 1
  };
  const counts = {};
  let maxMm = 0;
  src.forEach(h => { const k = cat(h.code); counts[k] = (counts[k] || 0) + 1; if ((h.mm||0) > maxMm) maxMm = h.mm; });
  // Tempestade tem prioridade: código diário de trovoada, qualquer hora de
  // trovoada no dia, ou chuva horária muito intensa (convectiva) → ⛈.
  if ((dailyCode != null && dailyCode >= 95) || (counts.storm || 0) >= 1 || maxMm >= 10) return 95;
  // senão, categoria mais frequente (empate → mais severa)
  const sev = ['clear','partly','cloud','fog','snow','rain'];
  let best = 'clear', bestN = 0;
  for (let i = sev.length - 1; i >= 0; i--) {
    const k = sev[i], c = counts[k] || 0;
    if (c > bestN) { bestN = c; best = k; }
  }
  const rep = { clear:0, partly:2, cloud:3, fog:45, rain:63, snow:73 };
  return rep[best];
}

/* Cor de uma temperatura na escala azul(frio)→verde(alvo)→vermelho(quente),
   coerente com o gradiente da linha. Retorna "r,g,b". */
function lerpRgb(a, b, t){
  return [Math.round(a[0]+(b[0]-a[0])*t), Math.round(a[1]+(b[1]-a[1])*t), Math.round(a[2]+(b[2]-a[2])*t)];
}
function tempColor(temp, setpoint, lo, hi){
  const COLD = [74,168,255], GREEN = [63,185,80], HOT = [255,91,74];
  let rgb;
  if (temp >= setpoint){
    const t = hi > setpoint ? clamp((temp - setpoint) / (hi - setpoint), 0, 1) : 0;
    rgb = lerpRgb(GREEN, HOT, t);
  } else {
    const t = setpoint > lo ? clamp((setpoint - temp) / (setpoint - lo), 0, 1) : 0;
    rgb = lerpRgb(GREEN, COLD, t);
  }
  return rgb.join(',');
}

/* Temperatura-alvo de interior conforme a estação ASTRONÔMICA da data (limites
   nos equinócios/solstícios ~20–21), com hemisfério pela latitude (negativa =
   Sul, estações invertidas): verão 24°, inverno 20°, primavera/outono 22°.
   Ex.: início de junho na Itália ainda é primavera (verão só a partir de ~21/06). */
function seasonSetpoint(dateISO, lat){
  const m = parseInt(dateISO.slice(5,7), 10);
  const d = parseInt(dateISO.slice(8,10), 10);
  const md = m * 100 + d;                        // ex.: 21/06 → 621
  let season;                                    // estação no Hemisfério Norte
  if      (md >= 320 && md <= 620) season = 'primavera';   // ~20/03 – 20/06
  else if (md >= 621 && md <= 922) season = 'verao';       // ~21/06 – 22/09
  else if (md >= 923 && md <= 1220) season = 'outono';     // ~23/09 – 20/12
  else                              season = 'inverno';    // ~21/12 – 19/03
  if (lat < 0) {                                 // Hemisfério Sul → inverte
    season = { inverno:'verao', verao:'inverno', primavera:'outono', outono:'primavera' }[season];
  }
  if (season === 'verao')   return 24;
  if (season === 'inverno') return 20;
  return 22;                                     // primavera e outono
}

function groupHours(hs){
  if (!hs.length) return '';
  const sorted = [...new Set(hs)].sort((a,b)=>a-b);
  const out = [];
  let s = sorted[0], p = sorted[0];
  for (let i = 1; i < sorted.length; i++){
    if (sorted[i] === p + 1) { p = sorted[i]; }
    else { out.push(s === p ? formatHr(s) : `${formatHr(s)}-${formatHr(p)}`); s = p = sorted[i]; }
  }
  out.push(s === p ? formatHr(s) : `${formatHr(s)}-${formatHr(p)}`);
  return out.join(' ');
}

function showError(msg){
  document.getElementById('loading').style.display = 'none';
  document.getElementById('app').style.display = 'none';
  // Mensagem traduzida primeiro; o detalhe técnico cru (ex.: "HTTP 429",
  // "Failed to fetch") fica entre parênteses para diagnóstico.
  document.getElementById('errMsg').textContent = msg ? `${T().error} (${msg})` : T().error;
  document.getElementById('error').style.display = 'flex';
}
