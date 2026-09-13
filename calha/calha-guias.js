/*
 * Calha 10844 — "como escolher": quando e por que usar cada opção dos passos. Só texto;
 * calha-app.js mostra a opção escolhida em destaque e as demais para comparar.
 * A base é a própria norma; o que é critério do projetista ou recomendação de fabricante
 * vem dito como tal.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CalhaGuias = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const GUIAS = {
    modoI: {
      opcoes: {
        tabela: ['Tabela 5', 'Use quando a cidade da obra tem posto na tabela. É o caminho mais direto: valores medidos para chuva de 5 minutos, nos três períodos de retorno. Se a cidade não aparece, prefira um dado local (equação IDF ou valor local), que é a base da norma (5.1).'],
        idf: ['Equação IDF', 'Use quando existe um estudo de chuvas intensas do município ou do estado, com a equação i = K·Tᵃ/(t + b)ᶜ. É dado local, em geral mais recente e mais perto da obra que a Tabela 5 (5.1.1). Anote a fonte no campo abaixo.'],
        pequena: ['Até 100 m²', 'Só para construção com até 100 m² de área de projeção horizontal: a norma permite adotar I = 150 mm/h sem consultar dados de chuva (5.1.4). Serve para casas pequenas; acima de 100 m², use a Tabela 5 ou um dado local.'],
        manual: ['Valor local', 'Use quando você já tem a intensidade de 5 minutos da cidade para o período de retorno escolhido, tirada de estudo, órgão público ou plano de drenagem. Informe o valor, o período de retorno e a fonte.'],
      },
    },
    T: {
      opcoes: {
        1: ['1 ano', 'Para áreas pavimentadas no chão, como quintais e estacionamentos, onde uma poça passageira pode ser tolerada (5.1.2 a). Não é o caso de telhados.'],
        5: ['5 anos', 'O padrão para coberturas e terraços (5.1.2 b). Numa casa com calha de beiral, se a calha transbordar, a água cai do lado de fora da parede: é a escolha usual para residências.'],
        25: ['25 anos', 'Para coberturas e áreas onde empoçamento ou extravasamento não pode ser tolerado (5.1.2 c): calhas de platibanda e de água-furtada, calhas internas ou sobre ambientes que não podem molhar. A chuva de projeto é maior e as peças crescem.'],
      },
    },
    saidas: {
      opcoes: {
        ponta: ['Uma, na ponta', 'Calha curta, ou quando só uma das pontas tem onde descer o condutor. Toda a água corre para um lado, e a calha leva a vazão inteira (5.5.4).'],
        intermediaria: ['Uma, no meio', 'O condutor fica em algum ponto ao longo da calha, e a água chega pelos dois lados; vale o lado mais comprido (5.5.4). No centro exato, cada lado leva metade.'],
        'duas-pontas': ['Nas duas pontas', 'Um condutor em cada extremidade, com o divisor de águas no centro: cada condutor recebe metade da vazão, e a calha leva só essa metade.'],
        espacadas: ['Várias, espaçadas', 'Para calhas longas ou vazões grandes: repartir a água entre mais saídas diminui a seção da calha e o diâmetro de cada condutor.'],
        personalizadas: ['Posições livres', 'Quando as saídas não podem ficar em espaçamento regular, por causa de portas, janelas ou pilares: informe a posição de cada uma.'],
      },
    },
    curva: {
      opcoes: {
        nenhuma: ['Não há', 'Nenhuma mudança de direção da calha a menos de 4 m de uma saída: a vazão de projeto fica como está.'],
        'canto-reto': ['Canto reto', 'A calha dobra em ângulo vivo perto da saída. A norma aumenta a vazão de projeto em 20% com a curva a menos de 2 m e em 10% entre 2 e 4 m (5.5.6, Tabela 1).'],
        'canto-arredondado': ['Canto arredondado', 'Curva suave perto da saída: acréscimo menor, de 10% a menos de 2 m e de 5% entre 2 e 4 m (Tabela 1).'],
      },
    },
    material: {
      intro: 'Escolha o material que será usado na obra (4.1.1). Ele define a rugosidade n da Tabela 2: superfícies lisas (metais, PVC, fibrocimento, n = 0,011) escoam mais que concreto e alvenaria (n até 0,015), que pedem seção maior. Nas chapas metálicas, o app também dá o corte e a massa por metro.',
    },
    forma: {
      opcoes: {
        retangular: ['Retangular', 'Calha de chapa dobrada ou de alvenaria em que você define a largura e a altura. Com "Liberar a largura", o app acha a seção econômica, com largura igual ao dobro da lâmina.'],
        semicircular: ['Semicircular', 'Meia-cana de PVC ou de chapa. A Tabela 3 da norma traz a capacidade dos diâmetros de 100 a 200 mm; o botão escolhe só entre 100, 125, 150 e 200 mm, o menor que escoa a vazão e deixa a lâmina em pelo menos 50 mm para o ábaco do condutor (com ⅔ da altura, isso pede D de 150 mm ou mais). O app confere pela tabela, interpolando entre as colunas. Não se aplica à alvenaria.'],
        trapezoidal: ['Trapezoidal', 'Paredes inclinadas (talude z na horizontal para 1 na vertical), como em calhas moldadas de concreto: mais larga em cima para a mesma largura de fundo.'],
      },
    },
    fracLamina: {
      opcoes: {
        '0.6667': ['⅔ da altura', 'Padrão do app. A norma não fixa a lâmina da calha: é critério do projetista. Com ⅔, sobra ⅓ da altura como bordo livre contra o transbordamento (3.3), a mesma proporção que a norma usa nos condutores horizontais (5.7.2).'],
        '0.5': ['½ da altura', 'Mais bordo livre e seção maior. Use quando o transbordamento seria mais grave, como numa calha de platibanda ou de água-furtada.'],
        1: ['Seção cheia', 'Sem bordo livre: qualquer excesso transborda. Só onde isso é tolerável ou com extravasor (5.5.5). Na semicircular, a seção cheia é a lâmina D/2 da Tabela 3.'],
      },
    },
    saida: {
      opcoes: {
        a: ['Aresta viva', 'Furo simples no fundo da calha, com a borda reta: a saída mais simples de fazer. Usa o ábaco (a) da Figura 3.'],
        b: ['Funil de saída', 'Peça em forma de funil na saída da calha (3.13). Engole mais água com a mesma lâmina, então o condutor pode ser menor. Usa o ábaco (b).'],
      },
    },
    materialV: {
      intro: 'Material dos condutores verticais, entre os admitidos no item 4.1.2. O ábaco da Figura 3 é o mesmo para qualquer material; o material decide de onde vem o diâmetro interno: o PVC tem catálogo Tigre e Amanco no app, e os demais pedem os seus tubos.',
    },
    linhaV: {
      opcoes: {
        'pvc-sn': ['PVC Série Normal', 'Tubo branco de esgoto e águas pluviais prediais (NBR 5688), o padrão do app. Di de catálogo Tigre e Amanco: 72,1 mm no DN 75 e 98,0 mm no DN 100.'],
        'pvc-sr': ['PVC Série Reforçada', 'Mesma NBR 5688, com parede mais grossa e Di um pouco menor. Os fabricantes a indicam para condutores de edifícios de vários pavimentos e trechos sujeitos a impacto; é recomendação deles, não da NBR 10844.'],
        'aquapluv-88': ['Condutor Aquapluv 88', 'Condutor circular da linha de calhas de PVC Tigre Aquapluv, com peças próprias: Di 84,6 mm (DE 88, e 1,7). Escolha quando a calha for dessa linha.'],
        'amanco-pluvial': ['Condutor Calha Pluvial Amanco', 'Condutor DN 100 da linha Calha Pluvial da Amanco: Di 98,0 mm (DE 101,6, e 1,8). Escolha quando a calha for dessa linha.'],
        usuario: ['Meus tubos', 'Outro fabricante, série ou material: informe o DN e o diâmetro interno do catálogo, Di = DE − 2e. Tubos com Di abaixo de 70 mm ficam fora (5.6.3).'],
      },
    },
    trecho: {
      intro: 'Cada trecho escolhe como o tubo é instalado e de que linha ele vem. O app adota o menor tubo da linha que leva a vazão com a lâmina a 2/3 do diâmetro interno (5.7.2).',
      atual: false,
      opcoes: {
        enterrado: ['Enterrado', 'No solo, com caixa de areia nas conexões, nas mudanças de direção ou de declividade e a cada 20 m (5.7.4). Em PVC, a linha padrão é o coletor de parede maciça NBR 7362.'],
        aparente: ['Aparente', 'Fixado na estrutura, com inspeção nos mesmos pontos (5.7.3). Em PVC, a linha padrão é a Série Normal.'],
        auto: ['Linha padrão', 'Enterrado: coletor PVC NBR 7362; aparente: PVC Série Normal; outros materiais: diâmetros da Tabela 4, com ressalva para confirmar o tubo.'],
        tabela4: ['Diâmetros da Tabela 4', 'Sem catálogo do material: o D da tabela vale como diâmetro interno. O resultado fica com ressalva até você confirmar que o tubo comprado tem Di igual ou maior (3.11).'],
        usuario: ['Meus tubos', 'Informe os diâmetros internos dos tubos que você vai usar, em mm, separados por ponto e vírgula (Di = DE − 2e do catálogo).'],
      },
    },
  };

  return { GUIAS: GUIAS };
});
