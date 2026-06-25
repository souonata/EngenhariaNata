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

// CUIDADOS POR ESTAÇÃO (Lombardia). `meses` = índices 0–11 (Date.getMonth);
// a UI destaca a estação atual. Edite as dicas conforme aprende com a planta.
export const ESTACOES = [
  {
    chave: 'primavera',
    meses: [2, 3, 4], // mar–mai
    rotulo: { pt: 'Primavera', it: 'Primavera' },
    dicas: {
      pt: [
        'Retomada do crescimento: aumente luz e rega aos poucos conforme esquenta.',
        'Volte a adubar leve (dose fraca) quando surgir o primeiro broto novo.',
        'Cuidado com geadas tardias — só deixe fora em definitivo com o frio já passado.',
      ],
      it: [
        'Ripresa della crescita: aumenta luce e acqua gradualmente con il caldo.',
        'Riprendi una concimazione leggera (dose debole) al primo nuovo germoglio.',
        'Attento alle gelate tardive — lasciala fuori stabilmente solo a freddo finito.',
      ],
    },
  },
  {
    chave: 'verao',
    meses: [5, 6, 7], // jun–ago
    rotulo: { pt: 'Verão', it: 'Estate' },
    dicas: {
      pt: [
        'Sombreie a garrafa transparente (não as folhas): a raiz não gosta de luz nem calor.',
        'Regue de manhã e cheque todo dia; em onda de calor, 1–2× ao dia — úmido, sem encharcar.',
        'Sol da manhã sim; proteja do sol forte do meio-dia. Borrife as folhas para dar umidade.',
        'Vigie ácaros (calor seco) na face de baixo das folhas.',
      ],
      it: [
        'Ombreggia la bottiglia trasparente (non le foglie): la radice non ama luce né calore.',
        'Annaffia al mattino e controlla ogni giorno; con l’afa 1–2 volte al dì — umido, mai zuppo.',
        'Sole del mattino sì; ripara dal sole forte di mezzogiorno. Nebulizza le foglie per l’umidità.',
        'Sorveglia i ragnetti rossi (caldo secco) sotto le foglie.',
      ],
    },
  },
  {
    chave: 'outono',
    meses: [8, 9, 10], // set–nov
    rotulo: { pt: 'Outono', it: 'Autunno' },
    dicas: {
      pt: [
        'O crescimento desacelera: reduza adubo e rega aos poucos.',
        'Aproveite os últimos dias quentes com boa luz.',
        'Antes da 1ª geada (pode vir em out/nov), traga a muda para dentro.',
      ],
      it: [
        'La crescita rallenta: riduci gradualmente concime e acqua.',
        'Sfrutta le ultime giornate calde con buona luce.',
        'Prima della prima gelata (ott/nov), porta la piantina in casa.',
      ],
    },
  },
  {
    chave: 'inverno',
    meses: [11, 0, 1], // dez–fev
    rotulo: { pt: 'Inverno', it: 'Inverno' },
    dicas: {
      pt: [
        'Mantenha dentro de casa, perto de uma janela bem iluminada.',
        'Evite geadas e correntes de ar frio — a lichia é subtropical.',
        'Reduza a rega sem deixar o substrato secar de todo. Sem adubo.',
      ],
      it: [
        'Tieni in casa, vicino a una finestra ben illuminata.',
        'Evita gelate e correnti d’aria fredda — il litchi è subtropicale.',
        'Riduci l’irrigazione senza far seccare del tutto il substrato. Niente concime.',
      ],
    },
  },
];
