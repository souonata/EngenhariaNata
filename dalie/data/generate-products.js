#!/usr/bin/env node
// Gerador de catálogo Dalié — 200 produtos com imagens reais de moda
// Uso: node data/generate-products.js > data/products.json

// ── Definições de categoria ────────────────────────────────────────────────
const cats = [
  { name:'Vestido',  kw:'dress,fashion,woman',       sexos:['feminino'],                                   pr:[180,650], n:25 },
  { name:'Blusa',    kw:'fashion,woman,blouse',       sexos:['feminino','feminino','feminino','unissex'],   pr:[80, 280], n:25 },
  { name:'Calça',    kw:'fashion,pants,clothing',     sexos:['feminino','feminino','unissex','masculino'], pr:[150,450], n:20 },
  { name:'Jaqueta',  kw:'jacket,fashion,coat',        sexos:['feminino','feminino','unissex','masculino'], pr:[280,900], n:20 },
  { name:'Saia',     kw:'skirt,fashion,woman',        sexos:['feminino'],                                   pr:[120,380], n:20 },
  { name:'Short',    kw:'fashion,summer,casual',      sexos:['feminino','feminino','unissex'],             pr:[90, 250], n:15 },
  { name:'Macacão',  kw:'jumpsuit,fashion,woman',     sexos:['feminino'],                                   pr:[220,580], n:15 },
  { name:'Blazer',   kw:'blazer,suit,fashion',        sexos:['feminino','feminino','unissex','masculino'], pr:[320,950], n:20 },
  { name:'Cardigan', kw:'sweater,knit,fashion',       sexos:['feminino','feminino','unissex'],             pr:[150,420], n:20 },
  { name:'Conjunto', kw:'outfit,fashion,woman',       sexos:['feminino'],                                   pr:[280,750], n:20 },
];

// ── Dados de variação ──────────────────────────────────────────────────────
const cores = [
  'Preto','Branco','Bege','Rosa','Azul','Verde','Vermelho',
  'Amarelo','Marrom','Cinza','Lilás','Laranja','Vinho','Nude',
  'Off-white','Azul Marinho','Verde Militar','Caramelo','Terracota','Mostarda',
];

const estacoes = ['verao','inverno','primavera','outono'];

const tamanhoLetras = [
  ['PP','P','M','G','GG'],
  ['P','M','G','GG'],
  ['PP','P','M','G'],
  ['M','G','GG','XGG'],
  ['PP','P','M'],
  ['P','M','G'],
];

const tamanhoNumeros = [
  ['34','36','38','40','42'],
  ['36','38','40','42','44'],
  ['34','36','38','40'],
  ['38','40','42','44'],
];

const adjetivos = {
  Vestido:  ['Midi','Longo','Mini','Evasê','Envelope','Slip','Chemise','Wrap','com Babado','Plissado','Ombro a Ombro','Decote V','Tubo','Rodado','Assimétrico','Frente Única','Fluido','Tule','Cetim','Xadrez'],
  Blusa:    ['Cropped','Básica','Oversized','Franzida','Manga Longa','Sem Manga','Gola Alta','Decote V','Social','Peplum','Ombro a Ombro','Bufante','Regata','Camiseta','Renda'],
  Calça:    ['Flare','Skinny','Wide Leg','Reta','Mom','Jogger','Cropped','Pantalona','Cargo','Palazzo','Alfaiataria','Cigarrete','Boyfriend','Straight','Bootcut'],
  Jaqueta:  ['Bomber','Jeans','Couro','Moletom','Corta-Vento','Puffer','Sobretudo','Trench Coat','Kimono','Teddy','Militar','Varsity','Cropped','Oversized','Sherpa'],
  Saia:     ['Midi','Longa','Mini','Plissada','Lápis','Evasê','Assimétrica','A-Line','Cargo','Franzida','Godê','Jeans','com Babado','Envelope','Drapeada'],
  Short:    ['Jeans','Social','Cargo','Ciclista','Bermuda','Hot Pant','Slouchy','Alfaiataria','Cós Alto','Basic','Destroyed','Vintage','Elástico','Franzido','Sarja'],
  Macacão:  ['Longo','Curto','Jeans','Social','Listrado','Palazzo','Slim','Cargo','Cropped','Sem Manga','Manga Longa','Oversized','Básico','Floral','Alfaiataria'],
  Blazer:   ['Oversized','Clássico','Cropped','Duplo Botão','Alfaiataria','Slim','Xadrez','Tweed','Listrado','Veludo','Jeans','Colorido','Básico','Power','Long'],
  Cardigan: ['Longo','Curto','Chunky','Fine Knit','Aberto','com Botões','Oversized','Cropped','Mohair','Básico','Colorido','Trançado','Xale','Listrado','Texturizado'],
  Conjunto: ['de Calça','de Saia','com Short','Blazer e Calça','Cropped e Saia','Social','Casual','Loungewear','Coordenado','Esportivo','de Linho','Floral','Listrado','Básico','Minimalista'],
};

const materiais = [
  '','','','',
  ' em Linho',' em Viscose',' em Seda',' em Algodão',' em Malha',
  ' em Crepe',' em Cetim',' em Tricô',' Jeans',
];

const descricoes = {
  Vestido: [
    'Vestido com caimento elegante em tecido fluido. Perfeito para ocasiões especiais e dias de passeio.',
    'Modelo midi com detalhes que valorizam a silhueta. Tecido de alta qualidade com toque suave.',
    'Design minimalista de corte limpo para looks sofisticados no dia a dia.',
    'Peça versátil que transita entre o casual e o elegante, confeccionada em tecido premium.',
    'Corte contemporâneo com acabamento refinado. Ideal para trabalho e eventos sociais.',
  ],
  Blusa: [
    'Blusa de corte moderno com tecido de qualidade superior. Combine com calças ou saias.',
    'Modelo versátil para o dia a dia. Tecido leve e confortável, perfeito para todas as ocasiões.',
    'Detalhes exclusivos trazem personalidade ao look. Fácil de combinar com diferentes peças.',
    'Básica essencial ao guarda-roupa. Conforto e estilo em uma única peça.',
    'Design atemporal com acabamento impecável. Tecido de alta qualidade e excelente caimento.',
  ],
  Calça: [
    'Modelagem moderna que valoriza a silhueta. Tecido de alta durabilidade e conforto.',
    'Clássico atualizado com detalhes contemporâneos. Versatilidade total no guarda-roupa.',
    'Caimento perfeito para o trabalho e momentos casuais. Tecido que não amassa.',
    'Peça coringa para compor looks variados. Tecido premium com acabamento refinado.',
    'Design pensado para o conforto sem abrir mão do estilo. Modelagem exclusiva.',
  ],
  Jaqueta: [
    'Acabamento impecável com detalhes que fazem a diferença. Peça investimento do guarda-roupa.',
    'Versátil e estilosa para proteger do frio. Qualidade que dura por temporadas.',
    'Design contemporâneo perfeita para elevar qualquer look. Tecido de excelente qualidade.',
    'Peça icônica que nunca sai de moda. Materiais premium e craftsmanship impecável.',
    'Corte moderno com detalhes exclusivos. Investimento certeiro no guarda-roupa.',
  ],
  Saia: [
    'Caimento perfeito que valoriza a silhueta em tecido de alta qualidade.',
    'Modelo versátil que combina com blusas, camisetas e tops. Design atemporal.',
    'Corte moderno com acabamento refinado. Peça essencial ao guarda-roupa feminino.',
    'Tecido fluido e confortável para diferentes ocasiões. Design elegante.',
    'Detalhes únicos que personalizam o look com qualidade premium e acabamento impecável.',
  ],
  Short: [
    'Confortável e estiloso para os dias quentes. Tecido de qualidade com excelente caimento.',
    'Moderno que une conforto e estilo, perfeito para o verão.',
    'Versátil para diferentes ocasiões casuais. Tecido leve e durável.',
    'Design contemporâneo com acabamento impecável. Ideal para passeios ao ar livre.',
    'Essencial para o verão. Combina com tops, blusas e camisetas.',
  ],
  Macacão: [
    'Look pronto em uma única peça que dispensa combinações elaboradas.',
    'Design moderno que valoriza a silhueta em tecido de alta qualidade.',
    'Versátil que transita entre o casual e o sofisticado com acabamento refinado.',
    'Peça tendência com corte contemporâneo, perfeito para diferentes ocasiões.',
    'Design exclusivo com detalhes que fazem toda a diferença. Qualidade premium.',
  ],
  Blazer: [
    'Alfaiataria com acabamento impecável. Peça investimento indispensável no guarda-roupa.',
    'Clássico atualizado com detalhes modernos. Versatilidade total para diferentes ocasiões.',
    'Eleva qualquer look ao próximo nível. Tecido premium de excelente caimento.',
    'Qualidade e sofisticação em cada detalhe, perfeito para o ambiente profissional.',
    'Oversized tendência com corte moderno. Combine com calças retas ou saias midi.',
  ],
  Cardigan: [
    'Confortável e elegante para os dias mais frios. Tricô de qualidade superior.',
    'Versátil que complementa diferentes looks. Perfeito para o outono e inverno.',
    'Design atemporal e acabamento refinado. Peça essencial ao guarda-roupa.',
    'Tecido macio com excelente caimento. Combine com diferentes peças do guarda-roupa.',
    'Design moderno com detalhes que personalizam o look. Qualidade premium em cada fio.',
  ],
  Conjunto: [
    'Conjunto completo que facilita a criação de looks elegantes. Peças que funcionam separadas.',
    'Design sofisticado e contemporâneo, perfeito para diferentes ocasiões.',
    'Acabamento impecável com peças que também podem ser usadas separadamente.',
    'Design exclusivo em tecido de alta qualidade para um look completo e elegante.',
    'Peças coordenadas para um visual harmonioso. Qualidade e estilo em cada detalhe.',
  ],
};

const tagsPorCategoria = {
  Vestido:  ['florido','elegante','feminino','festa','romantico','minimalista','boho','casual','trabalho','passeio','chique','fluido'],
  Blusa:    ['casual','basico','minimalista','trabalho','passeio','feminino','trendy','leve','versátil','conforto'],
  Calça:    ['casual','trabalho','basico','street','versatil','confortavel','moderno','classico','denim'],
  Jaqueta:  ['casual','street','inverno','vintage','elegante','unissex','tendencia','outdoor','layering'],
  Saia:     ['feminino','casual','romantico','trabalho','florido','elegante','boho','minimalista','midi'],
  Short:    ['casual','praia','verao','festival','street','descontraido','tropical','athleisure'],
  Macacão:  ['elegante','casual','minimalista','festa','trabalho','trendy','feminino','versatil'],
  Blazer:   ['trabalho','elegante','formal','poder','minimalista','classico','versátil','chique','oversized'],
  Cardigan: ['confortavel','casual','aconchegante','inverno','basico','layering','cozy','tricô'],
  Conjunto: ['trendy','casual','elegante','combinado','pratico','moderno','feminino','coordenado'],
};

// ── Helpers pseudo-aleatórios (determinísticos por seed) ─────────────────
function sr(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function pick(arr, seed) {
  return arr[Math.floor(sr(seed) * arr.length)];
}

function pickN(arr, n, seed) {
  const used = new Set();
  const result = [];
  let s = seed;
  while (result.length < n && result.length < arr.length) {
    const idx = Math.floor(sr(s++) * arr.length);
    if (!used.has(idx)) { used.add(idx); result.push(arr[idx]); }
  }
  return result;
}

function roundPrice(min, max, seed) {
  const raw = min + sr(seed) * (max - min);
  return Math.round(raw / 10) * 10;
}

// ── Gerar produtos ─────────────────────────────────────────────────────────
let id = 1;
const products = [];

for (const cat of cats) {
  for (let i = 0; i < cat.n; i++) {
    const s = id * 37 + i * 13;

    const cor    = pick(cores, s);
    const sexo   = pick(cat.sexos, s + 7);

    const numEst = 1 + Math.floor(sr(s + 14) * 3);
    const estacao = pickN(estacoes, numEst, s + 14);

    // Calça e Saia podem usar tamanho numérico (40% das vezes)
    const usaNum = ['Calça','Saia'].includes(cat.name) && sr(s + 21) > 0.6;
    const tamanhos = pick(usaNum ? tamanhoNumeros : tamanhoLetras, s + 21);

    const adj  = pick(adjetivos[cat.name], s + 28);
    const mat  = pick(materiais, s + 35);
    const nome = `${cat.name} ${adj}${mat} ${cor}`;

    const preco      = roundPrice(cat.pr[0], cat.pr[1], s + 42);
    const temDesc    = sr(s + 49) > 0.5;
    const precoAntigo = temDesc
      ? roundPrice(preco * 1.12, preco * 1.45, s + 56)
      : null;

    const avaliacao   = Math.round((3.5 + sr(s + 63) * 1.5) * 2) / 2;
    const numAvaliacoes = 10 + Math.floor(sr(s + 70) * 490);
    const vendidos    = Math.floor(sr(s + 77) * 500);
    const emEstoque   = sr(s + 84) > 0.08;
    const destaque    = sr(s + 91) > 0.72;

    const numTags = 2 + Math.floor(sr(s + 98) * 4);
    const tags    = pickN(tagsPorCategoria[cat.name], numTags, s + 98);

    const descricao = pick(descricoes[cat.name], s + 105);

    // Imagem: loremflickr retorna fotos reais do Flickr por keyword, lock=seed fixo
    const imagem = `https://loremflickr.com/400/520/${cat.kw}?lock=${id}`;

    products.push({
      id,
      nome,
      descricao,
      categoria: cat.name,
      sexo,
      tamanhos,
      cor,
      estacao,
      preco,
      precoAntigo,
      avaliacao,
      numAvaliacoes,
      imagem,
      destaque,
      vendidos,
      emEstoque,
      tags,
    });

    id++;
  }
}

process.stdout.write(JSON.stringify(products, null, 2) + '\n');
