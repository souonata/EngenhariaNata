/*
 * Parâmetros nacionais para a EN 12056-3 — Itália e Suécia.
 *
 * A norma manda usar dado estatístico local de chuva (4.2.1) e, sem ele, uma intensidade mínima
 * "adequada ao clima do local e conforme a regulamentação e a prática nacional" (4.2.2). O anexo B
 * da EN, que lista a prática de cada país, NÃO traz valor nenhum para a Itália nem para a Suécia:
 * cita só leis de poluição (IT) e o BBR 94, já substituído (SV). Por isso cada número abaixo vem
 * com fonte, data de consulta e o que ele é — norma, publicação setorial ou prática corrente.
 *
 * ⚠️ Não atualize estes valores de memória: releia a fonte.
 *
 * Script clássico: no navegador vira window.EN12056_NACIONAL; em Node, module.exports.
 */
(function (root) {
  'use strict';

  /*
   * Suécia — fórmula de Dahlström (2010), a estatística de chuva recomendada pela Svenskt Vatten
   * (P104/P110) e confirmada pelo PM conjunto Svenskt Vatten + SMHI de abril de 2020
   * ("Rekommendationer vid val av nederbördsstatistik för dimensionering av dagvattensystem",
   * https://www.svensktvatten.se/contentassets/f4a31064fcb54701b3a3451d1763d46c/svensktvatten_smhi_pm-april-2020.pdf
   * — consultado em 19/09/2026): vale para todo o país, para durações de 5 min a 24 h, e fica
   * "do lado seguro" frente às estações automáticas do SMHI.
   *
   *   i = 190 · ∛T · ln(t) / t^0,98 + 2      [l/(s·ha)], T em MESES, t em minutos
   *
   * Conferida contra o exemplo do PM de metodologia da Stockholm Vatten och Avfall
   * (10 anos: 36 min → 102 l/(s·ha); 25 min → 131 l/(s·ha)).
   */
  function dahlstrom2010(p) {
    const anos = p && p.anos;
    const minutos = p && p.minutos;
    if (!(anos > 0) || !(minutos > 0)) return null;
    const T = anos * 12;
    const i = (190 * Math.cbrt(T) * Math.log(minutos)) / Math.pow(minutos, 0.98) + 2;
    return { i: i, r: i / 10000, anos: anos, minutos: minutos };
  }

  const SUECIA = {
    id: 'sv',
    // Prática sueca de coberturas: chuva de 5 anos e 10 minutos, multiplicada pelo fator de risco
    // da Tabela 2 da EN (é assim que a interpretação setorial e os guias de fabricante calculam).
    chuva: {
      via: 'pratica-nacional',
      anos: 5,
      minutos: 10,
      get rBase() { return dahlstrom2010({ anos: 5, minutos: 10 }).r; },
      fonte: 'Dahlström (2010), Svenskt Vatten P104/P110; prática de 5 anos/10 min',
    },
    // Fator climático: recomendação da Svenskt Vatten para instalações em uso no fim do século.
    // Fora da EN — entra como opção marcada, nunca embutido no cálculo sem o usuário saber.
    fatorClimatico: { padrao: 1, opcoes: [1, 1.2, 1.25], fonte: 'Svenskt Vatten/SMHI PM 2020-04' },
    vento: 'sem-vento',
    enchimentoCondutor: 0.33,
    // Norma sueca de coberturas em vigor: SS 824031:2025 (edição 2, aprovada em 04/03/2025,
    // "Ytvattenavledning från tak — Dimensioneringsanvisningar"). O conteúdo não é público; a
    // edição de 1987 admitia 0,013 l/(s·m²) para todo o país em áreas até 10 000 m².
    normaNacional: { id: 'SS 824031:2025', edicaoAnterior: { ano: 1987, r: 0.013 } },
    referencias: [
      { id: 'sv-dahlstrom', titulo: 'Svenskt Vatten och SMHI, PM april 2020', url: 'https://www.svensktvatten.se/contentassets/f4a31064fcb54701b3a3451d1763d46c/svensktvatten_smhi_pm-april-2020.pdf', consulta: '2026-09-19' },
      { id: 'sv-ss824031', titulo: 'SS 824031:2025, Ytvattenavledning från tak', url: 'https://www.sis.se/en/produkter/construction-materials-and-building/elements-of-buildings/roofs/ss-8240312025/', consulta: '2026-09-19' },
      { id: 'sv-ssen12056', titulo: 'SS-EN 12056-3 (publicada em inglês pela SIS)', url: 'https://www.sis.se/en/produkter/standardization/vocabularies/construction-materials-and-building-vocabularies/ssen120563/', consulta: '2026-09-19' },
    ],
  };

  const ITALIA = {
    id: 'it',
    // A Itália não tem valor oficial de intensidade para coberturas: nem a UNI EN 12056-3:2001
    // (o anexo B italiano só lista leis de água), nem uma norma nacional de chuva de projeto.
    // A prática corrente fica entre 0,03 e 0,05 l/(s·m²); 0,04 (≈ 144 mm/h, período de 10 anos)
    // é o valor recomendado nos manuais técnicos de fabricante. Todos são valores da Tabela 1.
    chuva: {
      via: 'tabela1',
      rBase: 0.04,
      faixaPratica: [0.03, 0.05],
      fonte: 'prática italiana (0,03–0,05); 0,04 ≈ 144 mm/h, período de retorno de 10 anos',
    },
    fatorClimatico: { padrao: 1, opcoes: [1] },
    vento: 'sem-vento',
    enchimentoCondutor: 0.33,
    normaNacional: { id: 'UNI EN 12056-3:2001', guia: 'UNI 10724' },
    referencias: [
      { id: 'it-uni12056', titulo: 'UNI EN 12056-3:2001', url: 'https://store.uni.com/uni-en-12056-3-2001', consulta: '2026-09-19' },
      { id: 'it-uni10724', titulo: 'UNI 10724:2004, raccolta e smaltimento delle acque meteoriche', url: 'https://store.uni.com/uni-10724-2004', consulta: '2026-09-19' },
    ],
  };

  /*
   * Termos oficiais/correntes de cada idioma. O italiano segue a UNI EN 12056-3:2001; o sueco é a
   * terminologia do setor, porque a SIS publica a SS-EN 12056-3 em inglês, sem tradução.
   */
  const TERMOS = {
    it: {
      calhaBeiral: 'cornicione di gronda',
      calhaInterna: 'canale di gronda di compluvio o di parapetto',
      bocal: 'bocca di efflusso',
      condutor: 'pluviale',
      coletor: 'collettore di scarico',
      bordoLivre: 'bordo libero',
      areaEfetiva: 'area effettiva della copertura',
      comprimentoDrenagem: 'lunghezza di drenaggio',
      extravasor: 'sfioratore',
      caixaColetora: 'pozzetto di raccolta',
      vertedor: 'stramazzo',
      intensidade: 'intensità di precipitazione',
      fatorRisco: 'coefficiente di rischio',
      coefEscoamento: 'coefficiente di scorrimento',
      fatorAltura: 'coefficiente di altezza',
      fatorForma: 'coefficiente di forma',
      fatorCapacidade: 'coefficiente di capacità',
      fatorCarga: 'coefficiente di carico',
      enchimento: 'grado di riempimento',
      tabela: 'prospetto',
      coberturaPlana: 'copertura piatta',
      niveladaTexto: 'nominalmente orizzontale',
    },
    sv: {
      calhaBeiral: 'hängränna',
      calhaInterna: 'ränndal eller ränna innanför sarg',
      bocal: 'utlopp (rännstos, takbrunn)',
      condutor: 'stuprör',
      coletor: 'dagvattenledning',
      bordoLivre: 'fribord',
      areaEfetiva: 'avvattningsyta',
      comprimentoDrenagem: 'avvattningslängd',
      extravasor: 'bräddavlopp',
      caixaColetora: 'uppsamlingslåda',
      vertedor: 'överfall',
      intensidade: 'regnintensitet',
      fatorRisco: 'riskfaktor',
      coefEscoamento: 'ytkoefficient',
      fatorAltura: 'djupfaktor',
      fatorForma: 'formfaktor',
      fatorCapacidade: 'kapacitetsfaktor',
      fatorCarga: 'utloppets tryckhöjdsfaktor',
      enchimento: 'fyllnadsgrad',
      tabela: 'tabell',
      coberturaPlana: 'låglutande tak',
      niveladaTexto: 'nominellt horisontell',
    },
  };

  const api = {
    dahlstrom2010: dahlstrom2010,
    SUECIA: SUECIA,
    ITALIA: ITALIA,
    TERMOS: TERMOS,
    paises: { it: ITALIA, sv: SUECIA },
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EN12056_NACIONAL = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
