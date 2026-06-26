/**
 * lichiabonsai-data.js — DADOS DO DIÁRIO (edite este arquivo para atualizar)
 *
 * Este é o único arquivo que você precisa mexer para registrar o progresso do
 * bonsai: novas entradas na linha do tempo, novas medições, marcar itens do
 * checklist, etc. É um módulo ES importado pelo script (entra no build do Vite),
 * então: edite → commite → o deploy publica. Não há fetch em runtime.
 *
 * Convenções:
 *  - Textos bilíngues são objetos { pt, it }.
 *  - Datas em ISO "AAAA-MM-DD" (a UI formata conforme o idioma).
 *  - Medições: alturaCm e folhas são NÚMEROS (alimentam o gráfico de crescimento).
 *  - Checklist: done = true quando concluído.
 */

export const META = {
  // Cabeçalho
  titulo: { pt: 'Projeto Bonsai Lichia 2031', it: 'Progetto Bonsai Litchi 2031' },
  subtitulo: {
    pt: 'Diário da transformação de uma semente de lichia em bonsai, em Turate, Lombardia.',
    it: 'Diario della trasformazione di un seme di litchi in bonsai, a Turate, Lombardia.',
  },
  local: { pt: 'Turate · Lombardia, Itália', it: 'Turate · Lombardia, Italia' },
  especie: 'Litchi chinensis',
  dataInicial: '2026-06-21',
  // Foto de destaque (hero). Os arquivos ficam em ./fotos/ (tratados, WebP).
  heroFoto: {
    arquivo: '2026-06-21-broto-macro.webp',
    alt: {
      pt: 'Macro da muda de lichia: caule, restos da semente e primeiras folhas em contraluz.',
      it: 'Macro della piantina di litchi: fusto, resti del seme e prime foglie in controluce.',
    },
  },
};

export const STATUS = {
  // Cada item vira um "card" de status atual
  fase: {
    rotulo: { pt: 'Fase', it: 'Fase' },
    valor: { pt: 'Enraizamento', it: 'Radicazione' },
  },
  inicio: {
    rotulo: { pt: 'Início', it: 'Inizio' },
    valor: '2026-06-21', // data ISO → formatada na UI
    isData: true,
  },
  objetivo: {
    rotulo: { pt: 'Objetivo', it: 'Obiettivo' },
    valor: { pt: 'Bonsai ornamental', it: 'Bonsai ornamentale' },
  },
  proximoPasso: {
    rotulo: { pt: 'Próximo passo', it: 'Prossimo passo' },
    valor: { pt: 'Passar o primeiro inverno protegido do frio', it: 'Superare il primo inverno al riparo dal freddo' },
  },
};

export const PLANO_PET = {
  itens: {
    pt: [
      'Até o outono: deixar a muda estabelecer e crescer — incentivar a raiz pivotante e novos lançamentos (ver os cuidados de Verão). Sem podar nem mexer nas raízes.',
      'Antes da 1ª geada (na Lombardia, out/nov): trazer para dentro, sob uma janela bem iluminada ou luz de cultivo LED full-spectrum (~12 h/dia).',
      'No inverno, dentro de casa: longe de correntes frias, rega reduzida e sem adubo; manter alguma umidade (o aquecimento resseca o ar).',
    ],
    it: [
      'Fino all’autunno: lasciar attecchire e crescere la piantina — favorire il fittone e nuovi germogli (vedi cure d’Estate). Senza potare né toccare le radici.',
      'Prima della prima gelata (in Lombardia, ott/nov): portarla in casa, sotto una finestra ben illuminata o una luce LED full-spectrum da coltivazione (~12 h/giorno).',
      'In inverno, in casa: lontano da correnti fredde, irrigazione ridotta e niente concime; mantenere un po’ di umidità (il riscaldamento secca l’aria).',
    ],
  },
  // "Regra de ouro" — destacada como faixa de alerta.
  regra: {
    pt: 'Não cortar a raiz principal (pivotante) durante o primeiro ano — ela engrossa o futuro tronco.',
    it: 'Non tagliare la radice principale (fittone) durante il primo anno — ispessisce il futuro tronco.',
  },
};

// LINHA DO TEMPO — adicione novas entradas no topo (mais recente primeiro).
export const TIMELINE = [
  {
    data: '2026-06-26',
    titulo: {
      pt: 'Vaso isolante e rega com água do ar-condicionado',
      it: 'Vaso isolante e irrigazione con acqua del condizionatore',
    },
    texto: {
      pt: 'A garrafa PET, furada no fundo, foi encaixada dentro de um vaso maior cheio de terra — isolando as raízes do calor e mantendo-as no escuro. A base do troncozinho ganhou uma cobertura de casca de coco; o resto, uma mistura fofa de fibra de coco e terra preta. A rega passou a ser com a água de condensação do ar-condicionado: naturalmente macia e levemente ácida, ótima para a lichia (evita o calcário que amarela as folhas novas).',
      it: 'La bottiglia PET, forata sul fondo, è stata inserita in un vaso più grande pieno di terra — isolando le radici dal calore e tenendole al buio. La base del piccolo tronco ha ricevuto una copertura di fibra di cocco; il resto, una miscela soffice di fibra di cocco e terra nera. L’irrigazione ora usa l’acqua di condensa del condizionatore: naturalmente dolce e leggermente acida, ottima per il litchi (evita il calcare che ingiallisce le foglie nuove).',
    },
    fotos: [
      {
        arquivo: '2026-06-26-vaso-isolante-detalhe.webp',
        legenda: { pt: 'A garrafa encaixada no vaso maior, com cobertura de casca de coco', it: 'La bottiglia inserita nel vaso più grande, con copertura di fibra di cocco' },
      },
      {
        arquivo: '2026-06-26-muda.webp',
        legenda: { pt: 'A muda, com novas folhas firmes e verdes', it: 'La piantina, con nuove foglie sode e verdi' },
      },
      {
        arquivo: '2026-06-26-vaso-isolante.webp',
        legenda: { pt: 'O conjunto: vaso dentro do vaso, no terraço em Turate', it: 'L’insieme: vaso dentro il vaso, sul terrazzo a Turate' },
      },
    ],
  },
  {
    data: '2026-06-25',
    titulo: {
      pt: 'Transplante para a garrafa PET de 2 L',
      it: 'Trapianto nella bottiglia PET da 2 L',
    },
    texto: {
      pt: 'Mudança para uma garrafa PET de 2 litros cortada, cheia de substrato de fibra de coco — espaço em altura para a raiz pivotante crescer reta. As folhas já estão maiores e mais verdes; a raiz principal foi preservada.',
      it: 'Spostata in una bottiglia PET da 2 litri tagliata, riempita di substrato in fibra di cocco — spazio in altezza per far crescere dritto il fittone. Le foglie sono più grandi e verdi; la radice principale è stata preservata.',
    },
    fotos: [
      {
        arquivo: '2026-06-25-transplante-detalhe.webp',
        legenda: { pt: 'Folhas maiores e a boca cortada da garrafa', it: 'Foglie più grandi e l’imboccatura tagliata della bottiglia' },
      },
      {
        arquivo: '2026-06-25-transplante-topo.webp',
        legenda: { pt: 'Vista de cima: as folhas no substrato de fibra de coco', it: 'Vista dall’alto: le foglie nel substrato di fibra di cocco' },
      },
      {
        arquivo: '2026-06-25-transplante-janela.webp',
        legenda: { pt: 'A garrafa de 2 L no peitoril, em Turate', it: 'La bottiglia da 2 L sul davanzale, a Turate' },
      },
    ],
  },
  {
    data: '2026-06-21',
    titulo: { pt: 'Primeira muda germinada', it: 'Prima piantina germinata' },
    texto: {
      pt: 'A semente brotou. Raiz já próxima ao fundo do vaso de germinação. Duas primeiras folhas abertas.',
      it: 'Il seme è germogliato. Radice già vicina al fondo del vaso di germinazione. Prime due foglie aperte.',
    },
    // Galeria desta entrada (arquivos em ./fotos/). Adicione fotos novas aqui.
    fotos: [
      {
        arquivo: '2026-06-21-broto-topo.webp',
        legenda: { pt: 'Vista de cima — as duas primeiras folhas', it: 'Vista dall’alto — le prime due foglie' },
      },
      {
        arquivo: '2026-06-21-jardineira.webp',
        legenda: { pt: 'A jardineira no peitoril, em Turate', it: 'La fioriera sul davanzale, a Turate' },
      },
      {
        arquivo: '2026-06-21-broto-perfil.webp',
        legenda: { pt: 'Perfil da muda', it: 'Profilo della piantina' },
      },
    ],
  },
];

// METAS por ano (do mais próximo ao mais distante).
export const METAS = [
  { ano: '2026', texto: { pt: 'Sobreviver ao transplante para o PET 2 L', it: 'Sopravvivere al trapianto nel PET 2 L' } },
  { ano: '2027', texto: { pt: 'Engrossar o tronco', it: 'Ispessire il tronco' } },
  { ano: '2028', texto: { pt: 'Primeira poda estrutural', it: 'Prima potatura strutturale' } },
  { ano: '2029', texto: { pt: 'Vaso de treinamento', it: 'Vaso di allenamento' } },
  { ano: '2031+', texto: { pt: 'Bonsai inicial formado', it: 'Bonsai iniziale formato' } },
];

// CHECKLIST de progresso (ordem cronológica). done = true quando concluído.
export const CHECKLIST = [
  { label: { pt: 'Germinação', it: 'Germinazione' }, done: true },
  { label: { pt: 'Transplante PET 2 L', it: 'Trapianto PET 2 L' }, done: true },
  { label: { pt: 'Primeiro inverno', it: 'Primo inverno' }, done: false },
  { label: { pt: 'Primeira poda', it: 'Prima potatura' }, done: false },
  { label: { pt: 'Bonsai inicial', it: 'Bonsai iniziale' }, done: false },
];

// MEDIÇÕES — alturaCm e folhas são números (gráfico de crescimento).
export const MEDICOES = [
  { data: '2026-06-21', alturaCm: 5, folhas: 2 },
  { data: '2026-06-25', alturaCm: 7, folhas: 2 },
];

// REGISTROS POR FASE — SUAS fotos/notas reais de cada fase do guia (o loop de
// feedback do projeto). Anexe aqui a evolução real à fase correspondente do
// roteiro: a UI mostra o bloco "Seu registro" dentro de cada fase do guia.
// Chaves = chave da fase em `guia-fases.js` (f0, f1, f2, f3, f4, f5).
// Fotos: ponha o .webp em ./fotos/ e referencie o nome do arquivo aqui.
export const FASE_REGISTROS = {
  f0: {
    nota: {
      pt: 'Germinação em 21/06, transplante para a garrafa PET de 2 L em 25/06 e, em 26/06, a garrafa (furada no fundo) foi para dentro de um vaso maior com terra — isolando as raízes do calor e da luz. Rega com água de condensação do ar-condicionado (macia, levemente ácida). A raiz pivotante foi preservada; folhas maiores e mais verdes a cada semana.',
      it: 'Germinazione il 21/06, trapianto nella bottiglia PET da 2 L il 25/06 e, il 26/06, la bottiglia (forata sul fondo) è finita dentro un vaso più grande con terra — isolando le radici dal calore e dalla luce. Irrigazione con acqua di condensa del condizionatore (dolce, leggermente acida). Il fittone è stato preservato; foglie più grandi e verdi ogni settimana.',
    },
    fotos: [
      { arquivo: '2026-06-26-vaso-isolante-detalhe.webp', legenda: { pt: 'O vaso isolante: garrafa furada dentro de um vaso com terra', it: 'Il vaso isolante: bottiglia forata dentro un vaso con terra' } },
      { arquivo: '2026-06-21-broto-macro.webp', legenda: { pt: 'A muda recém-germinada', it: 'La piantina appena germinata' } },
    ],
  },
  // f1: { nota: { pt: '', it: '' }, fotos: [{ arquivo: 'AAAA-MM-DD-....webp', legenda: { pt: '', it: '' } }] },
};

// ESTAÇÃO DE CULTIVO — próximos passos de INFRAESTRUTURA (vaso, irrigação, luz),
// separados da progressão do bonsai. São planos a executar; edite conforme montar.
export const ESTACAO_CULTIVO = [
  {
    chave: 'vaso',
    rotulo: { pt: 'Vaso', it: 'Vaso' },
    resumo: { pt: 'Fundo e isolado, para a raiz pivotante', it: 'Profondo e isolato, per il fittone' },
    itens: {
      pt: [
        'Profundo: 30–40 cm de altura, ~15–18 cm de largura (profundo > largo).',
        'Isopor 2–3 cm laminado com fibra de vidro (dentro e fora); resina bem curada.',
        'Forro interno inerte (manta de lago), cor clara e ótima drenagem no fundo.',
        'Transplantar só na primavera de 2027 — não mexer na raiz no 1º ano.',
      ],
      it: [
        'Profondo: 30–40 cm di altezza, ~15–18 cm di larghezza (profondo > largo).',
        'Polistirolo 2–3 cm laminato con fibra di vetro (dentro e fuori); resina ben indurita.',
        'Rivestimento interno inerte (telo da laghetto), colore chiaro e ottimo drenaggio sul fondo.',
        'Trapiantare solo in primavera 2027 — non toccare la radice nel 1° anno.',
      ],
    },
  },
  {
    chave: 'irrigacao',
    rotulo: { pt: 'Irrigação', it: 'Irrigazione' },
    resumo: { pt: 'Automática, por umidade', it: 'Automatica, a umidità' },
    itens: {
      pt: [
        'Reservatório + bomba pequena (12 V/USB) com gotejamento no topo.',
        'Controle por sensor de umidade (ESP32): rega só quando seca — evita apodrecer a raiz.',
        'Pulsos curtos, deixando secar um pouco entre regas. Água da chuva ou levemente ácida.',
      ],
      it: [
        'Serbatoio + pompetta (12 V/USB) con gocciolatoio in alto.',
        'Controllo a sensore di umidità (ESP32): irriga solo quando asciuga — evita il marciume radicale.',
        'Impulsi brevi, lasciando asciugare un po’ tra le irrigazioni. Acqua piovana o leggermente acida.',
      ],
    },
  },
  {
    chave: 'luz',
    rotulo: { pt: 'Iluminação', it: 'Illuminazione' },
    resumo: { pt: 'LED de cultivo no timer', it: 'LED da coltivazione a timer' },
    itens: {
      pt: [
        'LED full-spectrum branco (~20–40 W), braço ajustável, ~20–30 cm acima.',
        'Timer ou smart plug: 12–14 h/dia no inverno, sempre no mesmo horário.',
        'Pode ser controlada pelo mesmo ESP32 (luz + bomba juntas).',
      ],
      it: [
        'LED full-spectrum bianco (~20–40 W), braccio regolabile, ~20–30 cm sopra.',
        'Timer o smart plug: 12–14 h/giorno in inverno, sempre alla stessa ora.',
        'Gestibile dallo stesso ESP32 (luce + pompa insieme).',
      ],
    },
  },
];
