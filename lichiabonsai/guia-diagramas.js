/**
 * guia-diagramas.js — DIAGRAMAS SVG do guia (line-art editorial, leigo-friendly).
 * Cada chave é um SVG inline auto-contido (viewBox, sem width/height — o CSS dimensiona).
 * Cores SÓ via currentColor e variáveis do tema (--leaf/--litchi/--ink/--hair/--frost…),
 * para funcionar em light/dark. Texto mínimo: símbolos (setas, ✓/✗, °C, %, gotas).
 */

export const DIAGRAMAS = {
  // ── PET 2 L: garrafa cortada, opaca, furos de drenagem, raiz pivotante reta ──
  pet: `<svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- garrafa cortada (boca em cima) -->
  <path d="M96 30 q-2 14 -14 20 q-10 8 -10 24 v66 q0 8 8 8 h60 q8 0 8 -8 V74 q0 -16 -10 -24 q-12 -6 -14 -20 z"/>
  <!-- borda de corte -->
  <path d="M96 30 h48" stroke="var(--litchi)"/>
  <!-- hachura = garrafa opaca -->
  <g stroke="var(--hair)" stroke-width="1.5" opacity="0.7">
    <path d="M76 86 l86 -22"/><path d="M74 104 l92 -24"/><path d="M74 122 l92 -24"/>
    <path d="M76 140 l88 -22"/><path d="M82 154 l78 -20"/>
  </g>
  <!-- raiz pivotante reta descendo -->
  <path d="M120 60 v74" stroke="var(--leaf)" stroke-width="2.5"/>
  <path d="M120 96 l-10 14 M120 112 l10 14" stroke="var(--leaf)" stroke-width="1.5"/>
  <!-- furos de drenagem no fundo -->
  <g fill="var(--ink)" stroke="none">
    <circle cx="92" cy="150" r="2.2"/><circle cx="108" cy="150" r="2.2"/>
    <circle cx="132" cy="150" r="2.2"/><circle cx="148" cy="150" r="2.2"/>
  </g>
  <!-- seta de profundidade -->
  <g stroke="var(--ink-mut)" stroke-width="1.5">
    <path d="M192 60 v74"/><path d="M192 60 l-5 7 M192 60 l5 7"/><path d="M192 134 l-5 -7 M192 134 l5 -7"/>
  </g>
</svg>`,

  // ── SUBSTRATO: corte do vaso, grãos granulares, gota drenando, pH ~6 ──
  substrato: `<svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- corte do vaso -->
  <path d="M52 48 h120 l-12 96 q-1 8 -9 8 H73 q-8 0 -9 -8 z"/>
  <!-- grãos granulares (tamanhos variados) -->
  <g stroke="var(--ink-mut)" stroke-width="1.5">
    <circle cx="74" cy="68" r="7"/><circle cx="96" cy="74" r="5"/><circle cx="116" cy="66" r="8"/>
    <circle cx="138" cy="72" r="6"/><circle cx="156" cy="68" r="4"/>
    <circle cx="80" cy="92" r="6"/><circle cx="102" cy="96" r="8"/><circle cx="124" cy="90" r="5"/>
    <circle cx="146" cy="94" r="7"/><circle cx="90" cy="116" r="7"/><circle cx="114" cy="118" r="6"/>
    <circle cx="136" cy="116" r="5"/><circle cx="100" cy="136" r="5"/><circle cx="124" cy="138" r="6"/>
  </g>
  <!-- gota escorrendo entre os grãos (drenagem) -->
  <path d="M118 78 q4 6 0 11 q-4 -5 0 -11 z" fill="var(--frost)" stroke="var(--frost)" stroke-width="1.5"/>
  <path d="M120 100 q4 6 0 11 q-4 -5 0 -11 z" fill="var(--frost)" stroke="var(--frost)" stroke-width="1.5"/>
  <path d="M118 124 q4 6 0 11 q-4 -5 0 -11 z" fill="var(--frost)" stroke="var(--frost)" stroke-width="1.5"/>
  <!-- gota saindo embaixo -->
  <path d="M116 156 q5 8 0 14 q-5 -6 0 -14 z" fill="var(--frost)" stroke="var(--frost)" stroke-width="1.5"/>
  <!-- símbolo de pH ~6 -->
  <text x="200" y="92" font-family="sans-serif" font-size="20" font-weight="600" fill="var(--litchi)" stroke="none" text-anchor="middle">pH</text>
  <text x="200" y="114" font-family="sans-serif" font-size="22" font-weight="700" fill="var(--ink)" stroke="none" text-anchor="middle">~6</text>
</svg>`,

  // ── REGA: teste do dedo + regador, água saindo (✓), pratinho parado (✗) ──
  rega: `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- vaso esquerdo: regar correto (✓) -->
  <path d="M30 70 h66 l-7 70 q-1 8 -9 8 H46 q-8 0 -9 -8 z"/>
  <path d="M30 70 h66" stroke="var(--leaf)"/>
  <!-- dedo tocando a superfície (~1 cm) -->
  <path d="M58 36 v22 q0 6 6 6 q6 0 6 -6 V40" stroke="var(--ink-mut)"/>
  <path d="M58 58 h12" stroke="var(--hair)" stroke-width="1.5"/>
  <!-- regador com gotas -->
  <path d="M96 24 h26 v14 h-26 z M122 26 l20 -6 M96 32 l-16 6 q-3 6 3 8" stroke="var(--ink)"/>
  <g stroke="var(--frost)" stroke-width="1.5">
    <path d="M70 56 v8 M78 58 v8 M86 56 v8"/>
  </g>
  <!-- água saindo pelos furos -->
  <g fill="var(--frost)" stroke="var(--frost)" stroke-width="1.5">
    <path d="M52 150 q4 7 0 12 q-4 -5 0 -12 z"/><path d="M72 150 q4 7 0 12 q-4 -5 0 -12 z"/>
  </g>
  <text x="63" y="20" font-family="sans-serif" font-size="22" font-weight="700" fill="var(--leaf)" stroke="none" text-anchor="middle">✓</text>
  <!-- pratinho com água parada (✗) -->
  <path d="M168 80 h60 l-6 50 q-1 8 -9 8 h-30 q-8 0 -9 -8 z"/>
  <!-- pratinho cheio de água parada -->
  <path d="M158 150 h80 q-4 12 -16 12 h-48 q-12 0 -16 -12 z" fill="var(--frost)" stroke="var(--frost)" stroke-width="1.5" opacity="0.6"/>
  <path d="M158 150 h80" stroke="var(--frost)"/>
  <text x="198" y="48" font-family="sans-serif" font-size="22" font-weight="700" fill="var(--litchi)" stroke="none" text-anchor="middle">✗</text>
</svg>`,

  // ── FLUXOS: folha bronze→verde firme; cortar só na verde (✓), não na bronze (✗) ──
  fluxos: `<svg viewBox="0 0 260 170" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- ramo -->
  <path d="M30 120 q60 -10 110 -28 q50 -18 92 -40" stroke="var(--ink-mut)" stroke-width="2.5"/>
  <!-- folha nova clara/bronze na ponta (direita) -->
  <g transform="translate(206 30)">
    <path d="M0 0 q22 -8 34 6 q-16 12 -34 -6 z" fill="var(--litchi)" stroke="var(--litchi)" stroke-width="1.5" opacity="0.45"/>
    <path d="M0 0 q22 -8 34 6" stroke="var(--litchi)"/>
  </g>
  <text x="232" y="20" font-family="sans-serif" font-size="20" font-weight="700" fill="var(--litchi)" stroke="none" text-anchor="middle">✗</text>
  <!-- folha intermediária -->
  <path d="M120 78 q20 -6 30 6 q-14 10 -30 -6 z" fill="var(--leaf)" stroke="var(--leaf)" stroke-width="1.5" opacity="0.35"/>
  <!-- folha verde firme (base, esquerda) -->
  <g transform="translate(44 96)">
    <path d="M0 0 q24 -8 36 6 q-16 12 -36 -6 z" fill="var(--leaf)" stroke="var(--leaf)" stroke-width="1.5" opacity="0.55"/>
    <path d="M0 0 q24 -8 36 6" stroke="var(--leaf)"/>
    <path d="M4 -1 l30 4" stroke="var(--leaf)" stroke-width="1.5"/>
  </g>
  <!-- tesoura cortando na verde (✓) -->
  <g transform="translate(70 122)" stroke="var(--ink)">
    <circle cx="0" cy="8" r="6"/><circle cx="0" cy="-8" r="6"/>
    <path d="M5 5 l28 -10 M5 -5 l28 10"/>
  </g>
  <path d="M86 116 v-12" stroke="var(--hair)" stroke-width="1.5" stroke-dasharray="3 3"/>
  <text x="42" y="138" font-family="sans-serif" font-size="20" font-weight="700" fill="var(--leaf)" stroke="none" text-anchor="middle">✓</text>
</svg>`,

  // ── SACRIFÍCIO: tronco fino + galho de sacrifício grosso engrossa a base ──
  sacrificio: `<svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- solo -->
  <path d="M40 158 h160" stroke="var(--ink-mut)"/>
  <!-- base engrossada → tronco fino acima -->
  <path d="M96 158 q-2 -40 4 -70 q3 -18 4 -40" stroke="var(--ink)" stroke-width="2.5"/>
  <path d="M124 158 q4 -36 0 -66 q-2 -22 -2 -44" stroke="var(--ink)" stroke-width="2.5"/>
  <!-- destaque da base grossa -->
  <path d="M96 158 q14 -6 28 0" stroke="var(--litchi)" stroke-width="2.5"/>
  <!-- galho de sacrifício grande/livre saindo baixo -->
  <path d="M118 116 q40 -6 64 -34" stroke="var(--leaf)" stroke-width="3"/>
  <g fill="var(--leaf)" stroke="var(--leaf)" stroke-width="1.5" opacity="0.5">
    <path d="M170 86 q16 -6 24 4 q-12 8 -24 -4 z"/>
    <path d="M150 96 q14 -5 22 3 q-11 7 -22 -3 z"/>
  </g>
  <!-- seta de engrossamento (na base) -->
  <g stroke="var(--litchi)" stroke-width="1.5">
    <path d="M70 150 h16 M70 150 l6 -5 M70 150 l6 5"/>
    <path d="M150 150 h-16 M150 150 l-6 -5 M150 150 l-6 5"/>
  </g>
  <!-- linha tracejada onde será cortado depois -->
  <path d="M128 108 l18 -2" stroke="var(--litchi)" stroke-width="1.5" stroke-dasharray="4 3"/>
  <text x="150" y="58" font-family="sans-serif" font-size="18" font-weight="700" fill="var(--leaf)" stroke="none" text-anchor="middle">↗</text>
</svg>`,

  // ── CLIP & GROW: cresce reto → corta → rebrota noutra direção (3 passos) ──
  clipgrow: `<svg viewBox="0 0 270 170" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- passo 1: cresce reto -->
  <g transform="translate(20 0)">
    <path d="M20 150 v-96" stroke="var(--ink)" stroke-width="2.5"/>
    <path d="M20 150 h-12 h24" stroke="var(--ink-mut)"/>
    <text x="20" y="166" font-family="sans-serif" font-size="14" font-weight="700" fill="var(--ink-mut)" stroke="none" text-anchor="middle">1</text>
  </g>
  <!-- seta -->
  <path d="M70 92 h18 M88 92 l-6 -5 M88 92 l-6 5" stroke="var(--ink-mut)" stroke-width="1.5"/>
  <!-- passo 2: corta -->
  <g transform="translate(96 0)">
    <path d="M20 150 v-58" stroke="var(--ink)" stroke-width="2.5"/>
    <path d="M20 92 v-38" stroke="var(--hair)" stroke-width="1.5" stroke-dasharray="4 3"/>
    <path d="M8 92 h24" stroke="var(--litchi)" stroke-width="1.5" stroke-dasharray="4 3"/>
    <path d="M20 150 h-12 h24" stroke="var(--ink-mut)"/>
    <text x="20" y="166" font-family="sans-serif" font-size="14" font-weight="700" fill="var(--ink-mut)" stroke="none" text-anchor="middle">2</text>
  </g>
  <!-- seta -->
  <path d="M146 92 h18 M164 92 l-6 -5 M164 92 l-6 5" stroke="var(--ink-mut)" stroke-width="1.5"/>
  <!-- passo 3: rebrota noutra direção (movimento + conicidade) -->
  <g transform="translate(172 0)">
    <path d="M20 150 v-58" stroke="var(--ink)" stroke-width="2.5"/>
    <path d="M20 92 q14 -18 36 -34" stroke="var(--leaf)" stroke-width="2.5"/>
    <path d="M56 58 q10 -4 16 2 q-9 6 -16 -2 z" fill="var(--leaf)" stroke="var(--leaf)" stroke-width="1.5" opacity="0.5"/>
    <path d="M20 150 h-12 h24" stroke="var(--ink-mut)"/>
    <text x="20" y="166" font-family="sans-serif" font-size="14" font-weight="700" fill="var(--ink-mut)" stroke="none" text-anchor="middle">3</text>
  </g>
</svg>`,

  // ── NEBARI: raízes abrindo radialmente (✓) vs raiz mergulhando/cruzando (✗) ──
  nebari: `<svg viewBox="0 0 260 170" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- linha do solo (esquerda ✓) -->
  <path d="M16 96 h104" stroke="var(--ink-mut)" stroke-width="1.5"/>
  <!-- tronco -->
  <path d="M58 96 q-3 -30 4 -52 M76 96 q4 -28 -2 -52" stroke="var(--ink)" stroke-width="2.5"/>
  <!-- raízes abrindo radialmente na superfície -->
  <g stroke="var(--leaf)" stroke-width="2.5">
    <path d="M60 94 q-22 4 -40 12"/>
    <path d="M62 94 q-14 8 -26 18"/>
    <path d="M74 94 q22 4 40 12"/>
    <path d="M72 94 q14 8 26 18"/>
  </g>
  <text x="67" y="150" font-family="sans-serif" font-size="22" font-weight="700" fill="var(--leaf)" stroke="none" text-anchor="middle">✓</text>
  <!-- divisor -->
  <path d="M130 24 v124" stroke="var(--hair)" stroke-width="1.5"/>
  <!-- direita (✗): solo -->
  <path d="M140 96 h104" stroke="var(--ink-mut)" stroke-width="1.5"/>
  <path d="M182 96 q-3 -30 4 -52 M200 96 q4 -28 -2 -52" stroke="var(--ink)" stroke-width="2.5"/>
  <!-- raiz mergulhando para baixo + cruzando -->
  <g stroke="var(--litchi)" stroke-width="2.5">
    <path d="M188 96 q4 24 -6 44"/>
    <path d="M192 96 q-6 22 8 42"/>
    <path d="M184 96 q-2 20 0 40"/>
  </g>
  <text x="192" y="150" font-family="sans-serif" font-size="22" font-weight="700" fill="var(--litchi)" stroke="none" text-anchor="middle">✗</text>
</svg>`,

  // ── CONICIDADE: tronco cilíndrico (✗) vs cônico base→ápice (✓) ──
  conicidade: `<svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- solo -->
  <path d="M24 150 h192" stroke="var(--ink-mut)" stroke-width="1.5"/>
  <!-- cilíndrico (✗): mesma largura em cima e embaixo -->
  <path d="M54 150 V40 M82 150 V40" stroke="var(--litchi)" stroke-width="2.5"/>
  <path d="M54 40 q14 -8 28 0" stroke="var(--litchi)" stroke-width="2.5"/>
  <!-- guias de largura -->
  <path d="M54 56 h28 M54 134 h28" stroke="var(--hair)" stroke-width="1.5" stroke-dasharray="3 3"/>
  <text x="68" y="172" font-family="sans-serif" font-size="20" font-weight="700" fill="var(--litchi)" stroke="none" text-anchor="middle">✗</text>
  <!-- cônico (✓): base grossa → ápice fino -->
  <path d="M142 150 q-2 -54 8 -102 M186 150 q1 -52 -10 -102" stroke="var(--leaf)" stroke-width="2.5"/>
  <path d="M150 48 q5 -6 12 0" stroke="var(--leaf)" stroke-width="2.5"/>
  <path d="M142 134 h44 M150 60 h12" stroke="var(--hair)" stroke-width="1.5" stroke-dasharray="3 3"/>
  <text x="164" y="172" font-family="sans-serif" font-size="20" font-weight="700" fill="var(--leaf)" stroke="none" text-anchor="middle">✓</text>
</svg>`,

  // ── ARAMAÇÃO: arame em espiral a ~45°, proteção de ráfia na curva, seta de dobra ──
  aramacao: `<svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- galho com curva -->
  <path d="M36 140 q40 -6 70 -40 q24 -28 64 -42" stroke="var(--ink)" stroke-width="3"/>
  <!-- arame em espiral a ~45° -->
  <g stroke="var(--ink-mut)" stroke-width="1.5">
    <path d="M40 134 q8 12 18 6"/>
    <path d="M52 126 q9 11 19 4"/>
    <path d="M66 116 q9 11 19 3"/>
    <path d="M82 102 q10 10 19 1"/>
    <path d="M98 86 q10 9 19 -1"/>
    <path d="M118 74 q10 8 19 -3"/>
    <path d="M140 64 q10 7 19 -4"/>
  </g>
  <!-- proteção de ráfia na curva (hachura curta) -->
  <g stroke="var(--litchi)" stroke-width="2">
    <path d="M88 96 l8 6 M94 90 l8 6 M100 84 l8 6"/>
  </g>
  <!-- seta da direção de dobra -->
  <g stroke="var(--leaf)" stroke-width="1.5">
    <path d="M100 132 q14 -8 22 -22"/>
    <path d="M122 110 l-9 1 M122 110 l-1 -9"/>
  </g>
</svg>`,

  // ── PODA DE RAIZ: torrão por baixo, ≤30% marcado p/ remover, tesoura, primavera ──
  podaRaiz: `<svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- torrão de raízes (visto por baixo) -->
  <circle cx="104" cy="92" r="56" stroke="var(--ink-mut)" stroke-width="2.5"/>
  <!-- raízes finas radiais -->
  <g stroke="var(--leaf)" stroke-width="1.5">
    <path d="M104 92 l0 -50 M104 92 l34 -34 M104 92 l50 0 M104 92 l34 34"/>
    <path d="M104 92 l0 50 M104 92 l-34 34 M104 92 l-50 0 M104 92 l-34 -34"/>
    <path d="M104 92 l24 -42 M104 92 l44 -22 M104 92 l44 22 M104 92 l24 42"/>
    <path d="M104 92 l-24 42 M104 92 l-44 22 M104 92 l-44 -22 M104 92 l-24 -42"/>
  </g>
  <!-- setor a remover (~30%) tracejado -->
  <path d="M104 92 L104 36 A56 56 0 0 1 152 64 Z" fill="var(--litchi)" stroke="var(--litchi)" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.85" fill-opacity="0.15"/>
  <text x="146" y="44" font-family="sans-serif" font-size="15" font-weight="700" fill="var(--litchi)" stroke="none" text-anchor="middle">≤30%</text>
  <!-- tesoura -->
  <g transform="translate(168 112)" stroke="var(--ink)">
    <circle cx="0" cy="8" r="6"/><circle cx="0" cy="-8" r="6"/>
    <path d="M5 5 l26 -9 M5 -5 l26 9"/>
  </g>
  <!-- seta/broto = primavera -->
  <g transform="translate(30 150)">
    <path d="M0 0 q6 -12 12 -2" stroke="var(--leaf)" stroke-width="1.5"/>
    <path d="M12 -2 q6 -10 0 -16" stroke="var(--leaf)" stroke-width="1.5"/>
    <path d="M12 -18 q8 4 6 14" fill="var(--leaf)" stroke="var(--leaf)" stroke-width="1.5" opacity="0.5"/>
  </g>
</svg>`,

  // ── INVERNO: planta dentro sob LED (12–14h), relógio, floco lá fora, seta p/ dentro ──
  inverno: `<svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- parede/janela -->
  <path d="M118 18 v150" stroke="var(--ink-mut)" stroke-width="1.5"/>
  <rect x="126" y="36" width="74" height="86" rx="3" stroke="var(--frost)" stroke-width="2"/>
  <path d="M163 36 v86 M126 79 h74" stroke="var(--frost)" stroke-width="1.5"/>
  <!-- LED + raios -->
  <rect x="42" y="34" width="48" height="9" rx="3" stroke="var(--ink)"/>
  <g stroke="var(--litchi)" stroke-width="1.5">
    <path d="M52 45 v10 M66 45 v12 M80 45 v10"/>
  </g>
  <!-- planta no vaso, dentro -->
  <path d="M52 152 h28 l-4 -22 h-20 z" stroke="var(--ink)"/>
  <path d="M66 130 v-18" stroke="var(--leaf)" stroke-width="2.5"/>
  <path d="M66 122 q-12 -4 -16 -14 M66 116 q12 -4 16 -14" stroke="var(--leaf)" stroke-width="2"/>
  <!-- relógio 12–14h -->
  <circle cx="100" cy="150" r="13" stroke="var(--ink-mut)" stroke-width="1.5"/>
  <path d="M100 150 v-7 M100 150 l5 3" stroke="var(--ink-mut)" stroke-width="1.5"/>
  <text x="100" y="178" font-family="sans-serif" font-size="13" font-weight="700" fill="var(--ink-mut)" stroke="none" text-anchor="middle">12–14h</text>
  <!-- floco de neve lá fora -->
  <g transform="translate(176 78)" stroke="var(--frost)" stroke-width="1.5">
    <path d="M0 -11 V11 M-10 -6 L10 6 M-10 6 L10 -6"/>
    <path d="M0 -11 l-3 3 M0 -11 l3 3 M0 11 l-3 -3 M0 11 l3 -3"/>
  </g>
  <!-- seta: trazer para dentro -->
  <g stroke="var(--leaf)" stroke-width="2">
    <path d="M150 150 h-36 M114 150 l8 -6 M114 150 l8 6"/>
  </g>
</svg>`,

  // ── ESTILOS: ereto informal (moyogi), multi-tronco, penjing/pomar largo ──
  estilos: `<svg viewBox="0 0 280 170" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- 1. ereto informal (moyogi) -->
  <g>
    <path d="M44 142 q-6 -36 8 -58 q10 -16 0 -36" stroke="var(--ink)" stroke-width="3"/>
    <path d="M52 86 q16 -2 26 -10 M50 64 q-14 0 -22 -8" stroke="var(--ink-mut)" stroke-width="2"/>
    <path d="M48 50 q-24 -2 -36 -16 q34 -8 50 4 q22 -16 50 0 q-16 18 -40 16 q-14 6 -24 -4 z" fill="var(--leaf)" stroke="var(--leaf)" stroke-width="1.5" opacity="0.45"/>
    <path d="M28 142 h40" stroke="var(--ink-mut)" stroke-width="1.5"/>
  </g>
  <!-- 2. multi-tronco -->
  <g transform="translate(96 0)">
    <path d="M44 142 q-4 -38 -2 -66 M50 142 q2 -42 6 -70 M56 142 q6 -34 18 -54" stroke="var(--ink)" stroke-width="2.5"/>
    <path d="M30 60 q4 -22 22 -28 q24 0 36 8 q12 14 -4 26 q-26 14 -54 -6 z" fill="var(--leaf)" stroke="var(--leaf)" stroke-width="1.5" opacity="0.45"/>
    <path d="M28 142 h48" stroke="var(--ink-mut)" stroke-width="1.5"/>
  </g>
  <!-- 3. penjing / pomar largo -->
  <g transform="translate(192 0)">
    <path d="M30 142 v-44 M46 142 v-58 M62 142 v-50 M78 142 v-40" stroke="var(--ink)" stroke-width="2.5"/>
    <path d="M14 86 q10 -28 40 -32 q34 -2 50 18 q12 18 -8 28 q-44 18 -82 -14 z" fill="var(--leaf)" stroke="var(--leaf)" stroke-width="1.5" opacity="0.45"/>
    <path d="M16 142 h78" stroke="var(--ink-mut)" stroke-width="1.5"/>
  </g>
</svg>`,
};
