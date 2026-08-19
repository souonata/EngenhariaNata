/**
 * Papel no projeto:
 * - Comparador de financiamento com SAC, Price e Americano.
 * - Gera tabela de amortização, gráficos e memorial do sistema selecionado.
 *
 * Pontos seguros para IA editar:
 * - fórmulas dos sistemas financeiros;
 * - geração da tabela e do gráfico de evolução;
 * - conversões de periodicidade e textos do memorial.
 *
 * Cuidados antes de mexer:
 * - periodicidade, taxa e prazo são interdependentes;
 * - preserve a separação entre cálculo puro, seleção de parcela e renderização.
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero, formatarMoeda } from '../src/utils/formatters.js';
import { ExplicacaoResultado } from '../src/components/resultado-explicado.js';
import {
    converterTaxaParaMensal,
    calcularAmortizacao as calcularAmortizacaoPuro,
    calcularBolan,
    projetarBolan
} from './mutuo-calc.js';

// ============================================
// CLASSE PRINCIPAL
// ============================================

class MutuoApp extends App {
    constructor() {
        super({
            appName: 'mutuo',
            callbacks: {
                aoInicializar: () => this.inicializarMutuo(),
                aoTrocarIdioma: () => this.atualizarAposTrocaIdioma()
            }
        });

        this.tabelaAmortizacao = [];
        this.ultimaParcelaSelecionada = 1;
        this.graficos = { evolucao: null, extraRecorrente: null, bolan: null };
        this.periodicidadeAnterior = 'ano'; // Rastrear periodicidade para conversão
        this.memorialSistemaSelecionado = 'price';
        this.explicacao = new ExplicacaoResultado('v2-explicacao', i18n);
        this.valoresEntradaOverride = {
            valor: null,
            taxa: null,
            prazo: null,
            extra: null
        };
    }

    get traducoes() {
        const idiomaAtual = i18n.obterIdiomaAtual();
        return this.config.traducoes[idiomaAtual] || this.config.traducoes['pt-BR'];
    }

    formatarMoedaLocal(valor) {
        return formatarMoeda(valor, i18n.obterMoeda());
    }

    formatarRotuloAnoGrafico(ano) {
        if (ano === 0) return '0';

        const unidadeAno = ano === 1
            ? (this.traducoes['period-year-short'] || 'Ano').toLowerCase()
            : (this.traducoes['years'] || this.traducoes['unidades']?.anos || 'anos');

        return `${ano} ${unidadeAno}`;
    }

    formatarTempoGrafico(valorEmAnos) {
        const totalMeses = Math.max(0, Math.round(Number(valorEmAnos) * 12));
        const anos = Math.floor(totalMeses / 12);
        const meses = totalMeses % 12;
        const partes = [];

        if (anos > 0) {
            partes.push(this.formatarRotuloAnoGrafico(anos));
        }

        if (meses > 0 || partes.length === 0) {
            const unidadeMes = meses === 1
                ? (this.traducoes['period-month-short'] || 'Mês').toLowerCase()
                : (this.traducoes['months'] || this.traducoes['unidades']?.meses || 'meses');

            partes.push(`${meses} ${unidadeMes}`);
        }

        return partes.join(' e ');
    }

    inicializarMutuo() {
        this.configurarEventos();
        this.configurarEventosBolan();
        this.aplicarModoPais();
        this.aplicarSistemaPadrao();
        this.calcular();
    }

    // O idioma define moeda e textos; o SISTEMA escolhido define a tela. Os
    // quatro sistemas ficam disponíveis nos três idiomas — o bolån sueco
    // inclusive, marcado com o país no seletor.
    get modoPais() {
        return { 'it-IT': 'it', 'sv-SE': 'se' }[i18n.obterIdiomaAtual()] || 'br';
    }

    aplicarModoPais() {
        document.body.classList.toggle('lang-br', this.modoPais === 'br');
        document.body.classList.toggle('lang-it', this.modoPais === 'it');
        document.body.classList.toggle('lang-se', this.modoPais === 'se');
    }

    get sistemaSelecionado() {
        return document.querySelector('input[name="sistemaRapido"]:checked')?.value || 'price';
    }

    /**
     * Sistema padrão por idioma: quem abre em sueco cai no bolån, quem abre em
     * pt/it cai no Price. Uma escolha manual do usuário passa a mandar e não é
     * mais sobrescrita na troca de idioma.
     */
    aplicarSistemaPadrao() {
        if (this.sistemaEscolhidoManualmente) {
            this.aplicarSistemaNaTela();
            return;
        }
        const padrao = this.modoPais === 'se' ? 'bolan' : 'price';
        const radio = document.querySelector(`input[name="sistemaRapido"][value="${padrao}"]`);
        if (radio) radio.checked = true;
        this.aplicarSistemaNaTela();
    }

    // O bolån troca a tela inteira: entradas, gráfico e explicação são outros.
    aplicarSistemaNaTela() {
        document.body.classList.toggle('sistema-bolan', this.sistemaSelecionado === 'bolan');
    }

    configurarEventosBolan() {
        const pares = [
            ['sliderPrecoImovel', 'inputPrecoImovel', 0],
            ['sliderEntrada', 'inputEntrada', 0],
            ['sliderJurosBolan', 'inputJurosBolan', 2],
            ['sliderAnosBolan', 'inputAnosBolan', 0],
            ['sliderExtraBolan', 'inputExtraBolan', 0]
        ];

        // LÄS MER: memorial de cálculo sueco (fórmulas, premissas e fontes).
        const btnSaibaMais = document.getElementById('btnBolanSaibaMais');
        const memorial = document.getElementById('bolanMemorial');
        if (btnSaibaMais && memorial) {
            btnSaibaMais.addEventListener('click', () => this.alternarMemorialBolan());
        }

        pares.forEach(([idSlider, idInput, casas]) => {
            const slider = document.getElementById(idSlider);
            const input = document.getElementById(idInput);
            if (!slider || !input) return;

            slider.addEventListener('input', () => {
                input.value = this.formatarNumeroBolan(parseFloat(slider.value), casas);
                this.calcularBolanUI();
            });

            input.addEventListener('input', () => {
                const valor = this.lerNumeroBolan(input.value);
                if (Number.isFinite(valor)) {
                    slider.value = String(valor);
                    this.calcularBolanUI();
                }
            });
        });
    }

    // Entrada em formato sueco: espaço como separador de milhar, vírgula
    // decimal. Aceita também ponto, para não punir quem digita do jeito antigo.
    lerNumeroBolan(texto) {
        const limpo = String(texto).replace(/\s|\u00a0/g, '').replace(',', '.');
        const n = parseFloat(limpo);
        return Number.isFinite(n) ? n : NaN;
    }

    formatarNumeroBolan(valor, casas = 0) {
        return valor.toLocaleString('sv-SE', {
            minimumFractionDigits: casas,
            maximumFractionDigits: casas
        });
    }

    calcularBolanUI() {
        if (this.sistemaSelecionado !== 'bolan') return;

        const preco = this.lerNumeroBolan(document.getElementById('inputPrecoImovel')?.value);
        const entrada = this.lerNumeroBolan(document.getElementById('inputEntrada')?.value);
        const juros = this.lerNumeroBolan(document.getElementById('inputJurosBolan')?.value);
        if (!Number.isFinite(preco) || !Number.isFinite(entrada) || !Number.isFinite(juros)) return;

        const anosLidos = this.lerNumeroBolan(document.getElementById('inputAnosBolan')?.value);
        const extraLido = this.lerNumeroBolan(document.getElementById('inputExtraBolan')?.value);
        const anos = Number.isFinite(anosLidos) ? Math.max(1, Math.round(anosLidos)) : 30;
        const amortizacaoExtraAnual = Number.isFinite(extraLido) ? Math.max(0, extraLido) : 0;

        const entradaEfetiva = Math.min(entrada, preco);
        const r = calcularBolan({
            valorImovel: preco,
            entrada: entradaEfetiva,
            taxaJurosAnual: juros
        });

        const kr = v => formatarMoeda(v, 'SEK', 0);
        const pct = v => `${formatarNumero(v * 100, 1)} %`;
        const def = (id, txt) => {
            const el = document.getElementById(id);
            if (el) el.textContent = txt;
        };

        def('bolanEmprestimo', kr(r.emprestimo));
        def('bolanBelaningsgrad', pct(r.belaningsgrad));
        def('bolanAmorteringskrav', `${pct(r.taxaAmortizacao)} ${this.textoBolan('porAno')}`);
        def('bolanAmortizacaoMensal', kr(r.amortizacaoMensal));
        def('bolanJurosMensais', kr(r.jurosAnuais / 12));
        def('bolanRanteavdrag', '−' + kr(r.ranteavdrag / 12));
        def('bolanCustoMensal', kr(r.custoMensalLiquido));

        // Aviso do bolånetak: desde 1/4/2026 o teto é 90% do valor do imóvel.
        const aviso = document.getElementById('bolanAviso');
        if (aviso) {
            const falta = r.entradaMinima - entrada;
            if (!r.dentroDoBolanetak && falta > 0) {
                aviso.textContent = this.textoBolan('avisoTeto')
                    .replace('{minimo}', kr(r.entradaMinima))
                    .replace('{falta}', kr(falta));
                aviso.classList.add('visivel');
            } else {
                aviso.classList.remove('visivel');
            }
        }

        this.renderizarExplicacaoBolan(r);

        this.projecaoBolan = projetarBolan({
            valorImovel: preco,
            entrada: entradaEfetiva,
            taxaJurosAnual: juros,
            anos,
            amortizacaoExtraAnual
        });
        this.atualizarGraficoBolan();
        this.renderizarResumoProjecao(this.projecaoBolan);
    }

    /**
     * Resumo em texto da projeção — o que a série do gráfico significa em
     * números fechados. Fica logo abaixo do gráfico.
     */
    renderizarResumoProjecao(projecao) {
        const alvo = document.getElementById('bolanProjecaoResumo');
        if (!alvo || !projecao) return;

        const kr = v => formatarMoeda(v, 'SEK', 0);
        const pct = v => `${formatarNumero(v * 100, 1)} %`;
        const { resumo } = projecao;
        const anos = resumo.anos;

        const itens = [
            [this.textoBolan('resumoJuros'), kr(resumo.totalJurosLiquidos)],
            [this.textoBolan('resumoAmortizado'), kr(resumo.totalAmortizado)],
            [this.textoBolan('resumoSaldo'), `${kr(resumo.saldoFinal)} (${pct(resumo.belaningsgradFinal)})`]
        ];

        const linhas = itens
            .map(([rotulo, valor]) => `
                <div class="bolan-projecao-item">
                    <span class="label-resultado">${rotulo}</span>
                    <span class="valor-resultado">${valor}</span>
                </div>`)
            .join('');

        // A frase que fecha o raciocínio: com o mínimo legal a dívida não zera.
        const nota = resumo.minimoNaoQuita
            ? this.textoBolan('resumoNaoQuita')
            : this.textoBolan('resumoQuita').replace('{ano}', String(resumo.anoQuitado));

        alvo.innerHTML = `
            <p class="bolan-projecao-titulo">${this.textoBolan('resumoTitulo').replace('{anos}', String(anos))}</p>
            <div class="bolan-projecao-grid">${linhas}</div>
            <p class="bolan-projecao-nota">${nota}</p>
        `;
    }

    /**
     * Gráfico da projeção sueca. Barras empilhadas = custo do ano (amortização
     * + juros líquidos); linha = belåningsgrad, com as duas fronteiras (70 % e
     * 50 %) que fazem o amorteringskrav mudar de degrau.
     */
    atualizarGraficoBolan() {
        const canvas = document.getElementById('graficoBolan');
        const projecao = this.projecaoBolan;
        if (!canvas || !projecao || typeof Chart === 'undefined') return;

        if (this.graficos.bolan) {
            this.graficos.bolan.destroy();
            this.graficos.bolan = null;
        }

        const cores = this.obterCoresGrafico();
        const linhas = projecao.linhas;
        const rotulos = linhas.map(l => String(l.ano));
        const kr = v => formatarMoeda(v, 'SEK', 0);

        this.graficos.bolan = new Chart(canvas.getContext('2d'), {
            data: {
                labels: rotulos,
                datasets: [
                    {
                        type: 'bar',
                        label: this.textoBolan('serieAmortizacao'),
                        data: linhas.map(l => l.amortizacao),
                        backgroundColor: cores.green,
                        stack: 'custo',
                        yAxisID: 'y',
                        order: 3
                    },
                    {
                        type: 'bar',
                        label: this.textoBolan('serieJuros'),
                        data: linhas.map(l => l.jurosLiquidos),
                        backgroundColor: cores.orange,
                        stack: 'custo',
                        yAxisID: 'y',
                        order: 3
                    },
                    {
                        type: 'line',
                        label: this.textoBolan('serieBelaningsgrad'),
                        data: linhas.map(l => l.belaningsgradFinal * 100),
                        borderColor: cores.blue,
                        backgroundColor: cores.blueSoft,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        tension: 0.1,
                        yAxisID: 'y1',
                        order: 1
                    },
                    {
                        type: 'line',
                        label: this.textoBolan('serieLimite70'),
                        data: linhas.map(() => 70),
                        borderColor: cores.text,
                        borderWidth: 1,
                        borderDash: [6, 4],
                        pointRadius: 0,
                        pointHitRadius: 0,
                        yAxisID: 'y1',
                        order: 2
                    },
                    {
                        type: 'line',
                        label: this.textoBolan('serieLimite50'),
                        data: linhas.map(() => 50),
                        borderColor: cores.text,
                        borderWidth: 1,
                        borderDash: [2, 4],
                        pointRadius: 0,
                        pointHitRadius: 0,
                        yAxisID: 'y1',
                        order: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'top', labels: { color: cores.text } },
                    tooltip: {
                        callbacks: {
                            title: (items) => `${this.textoBolan('eixoAno')} ${items[0]?.label}`,
                            label: (ctx) => ctx.dataset.yAxisID === 'y1'
                                ? `${ctx.dataset.label}: ${formatarNumero(ctx.parsed.y, 1)} %`
                                : `${ctx.dataset.label}: ${kr(ctx.parsed.y)}`,
                            afterBody: (items) => {
                                const linha = linhas[items[0]?.dataIndex];
                                if (!linha) return '';
                                return `${this.textoBolan('amorteringskrav')}: ${formatarNumero(linha.taxaAmortizacao * 100, 0)} %`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        ticks: { color: cores.text, maxRotation: 0, autoSkip: true },
                        grid: { color: cores.grid },
                        title: { display: true, text: this.textoBolan('eixoAno'), color: cores.text }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        position: 'left',
                        ticks: { color: cores.text, callback: (v) => formatarNumero(Number(v), 0) },
                        grid: { color: cores.grid },
                        title: { display: true, text: this.textoBolan('eixoCusto'), color: cores.text }
                    },
                    y1: {
                        position: 'right',
                        beginAtZero: true,
                        suggestedMax: 100,
                        ticks: { color: cores.text, callback: (v) => `${formatarNumero(Number(v), 0)} %` },
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: this.textoBolan('eixoBelaningsgrad'), color: cores.text }
                    }
                }
            }
        });
    }

    // Memorial de cálculo do bolån: fórmulas, premissas e fontes.
    alternarMemorialBolan() {
        const memorial = document.getElementById('bolanMemorial');
        const botao = document.getElementById('btnBolanSaibaMais');
        if (!memorial) return;

        const aberto = !memorial.hidden;
        memorial.hidden = aberto;
        if (botao) botao.setAttribute('aria-expanded', String(!aberto));
        if (!aberto) memorial.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    textoBolan(chave) {
        return i18n.obterTraducao(`bolan.${chave}`) || '';
    }

    renderizarExplicacaoBolan(r) {
        if (!this.explicacaoBolan) {
            this.explicacaoBolan = new ExplicacaoResultado('v2-explicacao-bolan', i18n);
        }
        const kr = v => formatarMoeda(v, 'SEK', 0);
        const pct = v => `${formatarNumero(v * 100, 1)} %`;

        this.explicacaoBolan.renderizar({
            linhas: [
                {
                    icone: '🏠',
                    titulo: this.textoBolan('expBelaningsgradTitulo'),
                    valor: pct(r.belaningsgrad),
                    descricao: this.textoBolan('expBelaningsgradTexto')
                },
                {
                    icone: '📉',
                    titulo: this.textoBolan('expAmorteringskravTitulo'),
                    valor: `${pct(r.taxaAmortizacao)} ${this.textoBolan('porAno')}`,
                    descricao: this.textoBolan('expAmorteringskravTexto')
                },
                {
                    icone: '🧾',
                    titulo: this.textoBolan('expRanteavdragTitulo'),
                    valor: '−' + kr(r.ranteavdrag / 12),
                    descricao: this.textoBolan('expRanteavdragTexto')
                }
            ],
            destaque: this.textoBolan('expDestaque')
                .replace('{custo}', kr(r.custoMensalLiquido))
                .replace('{amort}', kr(r.amortizacaoMensal)),
            dica: this.textoBolan('expDica'),
            norma: this.textoBolan('expNorma')
        });
    }

    obterCoresGrafico() {
        const css = getComputedStyle(document.documentElement);
        return {
            green: css.getPropertyValue('--chart-green').trim() || '#4caf50',
            greenSoft: css.getPropertyValue('--chart-green-soft').trim() || 'rgba(76, 175, 80, 0.16)',
            orange: css.getPropertyValue('--chart-orange').trim() || '#ff9800',
            orangeSoft: css.getPropertyValue('--chart-orange-soft').trim() || 'rgba(255, 152, 0, 0.16)',
            blue: css.getPropertyValue('--chart-blue').trim() || '#2196f3',
            blueSoft: css.getPropertyValue('--chart-blue-soft').trim() || 'rgba(33, 150, 243, 0.16)',
            text: css.getPropertyValue('--chart-text').trim() || '#3a3a3a',
            grid: css.getPropertyValue('--chart-grid').trim() || 'rgba(0, 0, 0, 0.08)'
        };
    }

    atualizarAposTrocaIdioma() {
        this.aplicarModoPais();
        this.aplicarSistemaPadrao();
        this.calcular();
    }

    configurarEventos() {
        // Info icons
        this.configurarIconesInfo();

        // Pagamentos extras aplicados em parcelas especificas
        this.configurarPagamentosExtrasEspecificos();

        // Botões de incremento/decremento (setas + e -)

        // Inputs de texto (valor, taxa, prazo)
        this.configurarInputsTexto();

        // Sliders
        ['sliderValor', 'sliderTaxa', 'sliderPrazo', 'sliderExtraPagamento', 'sliderParcelas'].forEach(id => {
            const slider = document.getElementById(id);
            if (slider) {
                slider.addEventListener('input', () => {
                    if (id === 'sliderParcelas') {
                        this.ultimaParcelaSelecionada = parseInt(slider.value);
                        this.atualizarParcelaExibida();
                    } else {
                        const mapaOverridePorSlider = {
                            sliderValor: 'valor',
                            sliderTaxa: 'taxa',
                            sliderPrazo: 'prazo',
                            sliderExtraPagamento: 'extra'
                        };
                        const chaveOverride = mapaOverridePorSlider[id];
                        if (chaveOverride) {
                            this.valoresEntradaOverride[chaveOverride] = null;
                        }
                        this.calcular();
                    }
                });
            }
        });

        // Radio buttons
        document.querySelectorAll('input[name="periodoRapido"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.converterTaxa();
                this.calcular();
            });
        });

        document.querySelectorAll('input[name="sistemaRapido"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.sistemaEscolhidoManualmente = true;
                this.calcular();
            });
        });

        document.querySelectorAll('input[name="periodoExtra"]').forEach(radio => {
            radio.addEventListener('change', () => this.calcular());
        });

        // Toggle minimizar gráfico
        const btnToggleGrafico = document.getElementById('btnToggleGrafico');
        const graficosContainer = document.getElementById('graficosContainer');
        if (btnToggleGrafico && graficosContainer) {
            const STORAGE_KEY = 'mutuoGraficoMinimizado';
            if (localStorage.getItem(STORAGE_KEY) === '1') {
                graficosContainer.classList.add('grafico-minimizado');
                btnToggleGrafico.setAttribute('aria-expanded', 'false');
            }
            btnToggleGrafico.addEventListener('click', () => {
                const minimizado = graficosContainer.classList.toggle('grafico-minimizado');
                btnToggleGrafico.setAttribute('aria-expanded', minimizado ? 'false' : 'true');
                localStorage.setItem(STORAGE_KEY, minimizado ? '1' : '0');
            });
        }

        // Botões da tabela
        const btnTabela = document.getElementById('btnTabela');
        if (btnTabela) {
            btnTabela.addEventListener('click', () => this.toggleTabela());
        }

        const btnFecharTabela = document.getElementById('btnFecharTabela');
        if (btnFecharTabela) {
            btnFecharTabela.addEventListener('click', () => this.toggleTabela());
        }

        // Botão SAIBA MAIS
        const btnExemplos = document.getElementById('btnExemplos');
        if (btnExemplos) {
            btnExemplos.addEventListener('click', () => {
                if (this.sistemaSelecionado === 'bolan') {
                    this.alternarMemorialBolan();
                    return;
                }
                const memorial = document.getElementById('memorialSection');
                const resultados = document.getElementById('resultados');
                const sistemaAtual = this.sistemaSelecionado;
                if (memorial) {
                    memorial.style.display = 'block';
                }
                if (resultados) {
                    resultados.style.display = 'none';
                }
                this.selecionarSistemaMemorial(sistemaAtual);
            });
        }

        // Botão Fechar Memorial
        const btnFecharMemorial = document.getElementById('btnFecharMemorial');
        if (btnFecharMemorial) {
            btnFecharMemorial.addEventListener('click', () => {
                const memorial = document.getElementById('memorialSection');
                const resultados = document.getElementById('resultados');
                if (memorial) {
                    memorial.style.display = 'none';
                }
                if (resultados) {
                    resultados.style.display = 'block';
                }
            });
        }

        document.addEventListener('engnata:themechange', () => {
            if (this.sistemaSelecionado === 'bolan') {
                this.atualizarGraficoBolan();
                return;
            }
            if (this.tabelaAmortizacao.length > 0) {
                this.atualizarGrafico();
                this.atualizarGraficoExtraRecorrente(this.obterDadosEntrada());
            }
        });

        // Botões "Voltar" da seção educativa unificada
        document.querySelectorAll('.btn-voltar-memorial').forEach(btn => {
            btn.addEventListener('click', () => {
                const memorial = document.getElementById('memorialSection');
                const resultados = document.getElementById('resultados');

                if (memorial) memorial.style.display = 'none';
                if (resultados) resultados.style.display = 'block';
            });
        });

        // Abas/botões de sistema no memorial (sincronizados entre blocos)
        const memorialSection = document.getElementById('memorialSection');
        if (memorialSection) {
            memorialSection.addEventListener('click', (event) => {
                if (!(event.target instanceof Element)) return;

                const tabButton = event.target.closest('.js-system-tab');
                if (!tabButton) return;

                const sistema = tabButton.getAttribute('data-system');
                if (!sistema) return;

                this.selecionarSistemaMemorial(sistema);
            });
        }
    }

    selecionarSistemaMemorial(sistema) {
        this.memorialSistemaSelecionado = sistema;

        // Sincronizar estado visual de todos os grupos de botões
        document.querySelectorAll('.js-system-tab').forEach((button) => {
            const ativo = button.getAttribute('data-system') === sistema;
            button.classList.toggle('is-active', ativo);
            button.setAttribute('aria-selected', ativo ? 'true' : 'false');
        });

        // Exibir o painel correspondente em cada bloco que possui painéis por sistema
        document.querySelectorAll('[data-system-panel]').forEach((panel) => {
            const ativo = panel.getAttribute('data-system-panel') === sistema;
            panel.classList.toggle('is-active', ativo);
            panel.hidden = !ativo;
        });

        // Destacar linha do sistema escolhido na tabela comparativa
        document.querySelectorAll('[data-system-row]').forEach((row) => {
            const ativo = row.getAttribute('data-system-row') === sistema;
            row.classList.toggle('is-highlight', ativo);
        });
    }

    configurarIconesInfo() {
        const infoIcons = [
            { iconId: 'infoIconValor', descricaoId: 'descricaoValor' },
            { iconId: 'infoIconTaxa', descricaoId: 'descricaoTaxa' },
            { iconId: 'infoIconPrazo', descricaoId: 'descricaoPrazo' },
            { iconId: 'infoIconExtra', descricaoId: 'descricaoExtra' },
            { iconId: 'infoIconExtraEspecifico', descricaoId: 'descricaoExtraEspecifico' }
        ];

        infoIcons.forEach(({ iconId, descricaoId }) => {
            const icon = document.getElementById(iconId);
            const descricao = document.getElementById(descricaoId);

            if (icon && descricao) {
                icon.addEventListener('click', () => {
                    const isVisible = descricao.style.display !== 'none';
                    descricao.style.display = isVisible ? 'none' : 'block';
                });

                icon.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        const isVisible = descricao.style.display !== 'none';
                        descricao.style.display = isVisible ? 'none' : 'block';
                    }
                });
            }
        });
    }

    configurarInputsTexto() {
        const inputValor = document.getElementById('inputValor');
        const inputTaxa = document.getElementById('inputTaxa');
        const inputPrazo = document.getElementById('inputPrazo');
        const inputExtraPagamento = document.getElementById('inputExtraPagamento');
        const sliderValor = document.getElementById('sliderValor');
        const sliderTaxa = document.getElementById('sliderTaxa');
        const sliderPrazo = document.getElementById('sliderPrazo');
        const sliderExtraPagamento = document.getElementById('sliderExtraPagamento');

        const atualizarDoInput = (input, slider, tipo) => {
            if (tipo === 'valor') {
                // Para valor de mutuo, aceitar apenas inteiro e ignorar separadores.
                const apenasDigitos = input.value.replace(/\D/g, '');
                const numeroInteiro = parseInt(apenasDigitos, 10);

                if (!isNaN(numeroInteiro)) {
                    this.valoresEntradaOverride.valor = numeroInteiro;
                    slider.value = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), numeroInteiro));
                }
                // Entrada inválida: recalcula para restaurar o display anterior.
                this.calcular();
                return;
            }

            if (tipo === 'extra') {
                const apenasDigitos = input.value.replace(/\D/g, '');
                const numeroInteiro = parseInt(apenasDigitos, 10);

                if (!isNaN(numeroInteiro)) {
                    this.valoresEntradaOverride.extra = numeroInteiro;
                    slider.value = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), numeroInteiro));
                }
                this.calcular();
                return;
            }

            const valor = input.value.replace(/[^\d.,]/g, '').replace(',', '.');
            const numero = parseFloat(valor);

            if (!isNaN(numero)) {
                if (tipo === 'taxa') {
                    this.valoresEntradaOverride.taxa = numero;
                } else if (tipo === 'prazo') {
                    this.valoresEntradaOverride.prazo = numero;
                }
                slider.value = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), numero));
            }
            this.calcular();
        };

        const camposCiclicos = [
            { input: inputValor, slider: sliderValor, tipo: 'valor' },
            { input: inputPrazo, slider: sliderPrazo, tipo: 'prazo' },
            { input: inputTaxa, slider: sliderTaxa, tipo: 'taxa' },
            { input: inputExtraPagamento, slider: sliderExtraPagamento, tipo: 'extra' }
        ].filter((campo) => campo.input && campo.slider);

        const focarCampoCiclico = (inputAtual, direcao = 1) => {
            const indiceAtual = camposCiclicos.findIndex((campo) => campo.input === inputAtual);
            if (indiceAtual === -1 || camposCiclicos.length === 0) return;

            const proximoIndice = (indiceAtual + direcao + camposCiclicos.length) % camposCiclicos.length;
            camposCiclicos[proximoIndice].input.focus();
        };

        const tratarTeclaCiclica = (e, input, slider, tipo) => {
            if (e.key !== 'Enter' && e.key !== 'Tab') return;

            e.preventDefault();
            atualizarDoInput(input, slider, tipo);

            const direcao = e.key === 'Tab' && e.shiftKey ? -1 : 1;
            focarCampoCiclico(input, direcao);
        };

        if (inputValor && sliderValor) {
            const selecionarTudoValor = () => {
                // Timeout curto para garantir seleção após o foco/click em desktop e mobile.
                setTimeout(() => {
                    inputValor.select();
                }, 0);
            };

            inputValor.addEventListener('focus', selecionarTudoValor);
            inputValor.addEventListener('click', selecionarTudoValor);
            inputValor.addEventListener('touchend', selecionarTudoValor);

            inputValor.addEventListener('blur', () => atualizarDoInput(inputValor, sliderValor, 'valor'));
            inputValor.addEventListener('keydown', (e) => {
                tratarTeclaCiclica(e, inputValor, sliderValor, 'valor');
            });
        }

        if (inputTaxa && sliderTaxa) {
            const selecionarTudoTaxa = () => {
                setTimeout(() => {
                    inputTaxa.select();
                }, 0);
            };

            inputTaxa.addEventListener('focus', selecionarTudoTaxa);
            inputTaxa.addEventListener('click', selecionarTudoTaxa);
            inputTaxa.addEventListener('touchend', selecionarTudoTaxa);

            inputTaxa.addEventListener('blur', () => atualizarDoInput(inputTaxa, sliderTaxa, 'taxa'));
            inputTaxa.addEventListener('keydown', (e) => {
                tratarTeclaCiclica(e, inputTaxa, sliderTaxa, 'taxa');
            });
        }

        if (inputPrazo && sliderPrazo) {
            const selecionarTudoPrazo = () => {
                setTimeout(() => {
                    inputPrazo.select();
                }, 0);
            };

            inputPrazo.addEventListener('focus', selecionarTudoPrazo);
            inputPrazo.addEventListener('click', selecionarTudoPrazo);
            inputPrazo.addEventListener('touchend', selecionarTudoPrazo);

            inputPrazo.addEventListener('blur', () => atualizarDoInput(inputPrazo, sliderPrazo, 'prazo'));
            inputPrazo.addEventListener('keydown', (e) => {
                tratarTeclaCiclica(e, inputPrazo, sliderPrazo, 'prazo');
            });
        }

        if (inputExtraPagamento && sliderExtraPagamento) {
            const selecionarTudoExtra = () => {
                setTimeout(() => {
                    inputExtraPagamento.select();
                }, 0);
            };

            inputExtraPagamento.addEventListener('focus', selecionarTudoExtra);
            inputExtraPagamento.addEventListener('click', selecionarTudoExtra);
            inputExtraPagamento.addEventListener('touchend', selecionarTudoExtra);

            inputExtraPagamento.addEventListener('blur', () => atualizarDoInput(inputExtraPagamento, sliderExtraPagamento, 'extra'));
            inputExtraPagamento.addEventListener('keydown', (e) => {
                tratarTeclaCiclica(e, inputExtraPagamento, sliderExtraPagamento, 'extra');
            });
        }
    }

    configurarPagamentosExtrasEspecificos() {
        const lista = document.getElementById('extrasEspecificosLista');
        const btnAdicionar = document.getElementById('btnAdicionarExtraEspecifico');

        if (!lista || !btnAdicionar) return;

        const vincularLinha = (linha) => {
            const inputValor = linha.querySelector('.input-extra-especifico-valor');
            const inputParcela = linha.querySelector('.input-extra-especifico-parcela');
            const btnRemover = linha.querySelector('.btn-remover-extra-especifico');

            if (inputValor) {
                inputValor.addEventListener('input', () => {
                    inputValor.value = inputValor.value.replace(/\D/g, '');
                });

                inputValor.addEventListener('blur', () => {
                    const valor = parseInt(inputValor.value.replace(/\D/g, ''), 10);
                    inputValor.value = isNaN(valor) ? '' : formatarNumero(valor, 0);
                    this.calcular();
                });
            }

            if (inputParcela) {
                const normalizarParcela = () => {
                    if (!inputParcela.value || String(inputParcela.value).trim() === '') {
                        inputParcela.value = '';
                        return;
                    }

                    const numParcelas = Math.max(1, parseInt(document.getElementById('sliderPrazo')?.value || 30, 10) * 12);
                    const parcela = parseInt(inputParcela.value, 10);

                    if (isNaN(parcela)) {
                        inputParcela.value = '';
                        return;
                    }

                    const parcelaNormalizada = Math.max(1, Math.min(numParcelas, parcela));
                    inputParcela.value = String(parcelaNormalizada);
                };

                inputParcela.addEventListener('blur', () => {
                    normalizarParcela();
                    this.calcular();
                });

                inputParcela.addEventListener('change', () => {
                    normalizarParcela();
                    this.calcular();
                });
            }

            if (btnRemover) {
                btnRemover.addEventListener('click', () => {
                    linha.remove();
                    this.calcular();
                });
            }
        };

        lista.querySelectorAll('.extra-especifico-row').forEach(vincularLinha);

        btnAdicionar.addEventListener('click', () => {
            const placeholderValor = this.traducoes['extra-specific-value-placeholder'] || 'Valor extra';
            const placeholderParcela = this.traducoes['extra-specific-installment-placeholder'] || 'Parcela';
            const labelValor = this.traducoes['extra-specific-value-label'] || 'Valor';
            const labelParcela = this.traducoes['extra-specific-installment-label'] || 'Parcela (nº)';
            const ariaRemover = this.textoExp('removerExtra');

            const novaLinha = document.createElement('div');
            novaLinha.className = 'extra-especifico-row';
            novaLinha.innerHTML = `
                <div class="extra-especifico-campo">
                    <label class="extra-especifico-label">${labelValor}</label>
                    <input type="text" class="valor-display valor-input input-extra-especifico-valor" value="" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="${placeholderValor}">
                </div>
                <div class="extra-especifico-campo">
                    <label class="extra-especifico-label">${labelParcela}</label>
                    <input type="number" class="valor-display valor-input input-extra-especifico-parcela" value="" min="1" max="999" step="1" placeholder="${placeholderParcela}">
                </div>
                <button type="button" class="btn-remover-extra-especifico" aria-label="${ariaRemover}">×</button>
            `;

            lista.appendChild(novaLinha);
            vincularLinha(novaLinha);

            const novoInputValor = novaLinha.querySelector('.input-extra-especifico-valor');
            if (novoInputValor) {
                novoInputValor.focus();
                novoInputValor.select();
            }

            this.calcular();
        });
    }

    converterTaxa() {
        const sliderTaxa = document.getElementById('sliderTaxa');
        const inputTaxa = document.getElementById('inputTaxa');
        // A taxa efetiva pode vir de digitação livre (override), inclusive além
        // do range do slider — ela também precisa ser convertida ao trocar a
        // periodicidade, senão o mesmo número seria reinterpretado no novo
        // período (ex.: 12% a.a. virar 12% a.m.).
        const overrideTaxa = this.valoresEntradaOverride.taxa;
        const temOverrideTaxa = overrideTaxa != null && !Number.isNaN(overrideTaxa);
        const taxaAtual = temOverrideTaxa ? Number(overrideTaxa) : parseFloat(sliderTaxa?.value || 10);
        const periodoNovo = document.querySelector('input[name="periodoRapido"]:checked')?.value || 'ano';

        const obterPassoTaxa = (periodo) => {
            if (periodo === 'dia') return 0.0001;
            if (periodo === 'mes') return 0.001;
            return 0.01;
        };

        // O slider da taxa acompanha a periodicidade escolhida.
        const sliderTaxaPasso = document.getElementById('sliderTaxa');
        if (sliderTaxaPasso) sliderTaxaPasso.step = String(obterPassoTaxa(periodoNovo));

        // Determinar casas decimais baseado na periodicidade
        const casasDecimais = periodoNovo === 'dia' ? 4 : (periodoNovo === 'mes' ? 3 : 2);

        // Se a periodicidade mudou, converter o valor da taxa
        if (periodoNovo !== this.periodicidadeAnterior && sliderTaxa) {
            let taxaConvertida;

            // Primeiro, converter taxa atual para anual (base comum)
            let taxaAnual;
            if (this.periodicidadeAnterior === 'ano') {
                taxaAnual = taxaAtual;
            } else if (this.periodicidadeAnterior === 'mes') {
                // Mensal -> Anual
                taxaAnual = (Math.pow(1 + taxaAtual / 100, 12) - 1) * 100;
            } else { // dia
                // Diária -> Anual
                taxaAnual = (Math.pow(1 + taxaAtual / 100, 365) - 1) * 100;
            }

            // Depois, converter de anual para novo período
            if (periodoNovo === 'ano') {
                taxaConvertida = taxaAnual;
            } else if (periodoNovo === 'mes') {
                // Anual -> Mensal
                taxaConvertida = (Math.pow(1 + taxaAnual / 100, 1 / 12) - 1) * 100;
            } else { // dia
                // Anual -> Diária
                taxaConvertida = (Math.pow(1 + taxaAnual / 100, 1 / 365) - 1) * 100;
            }

            // Ajustar limites do slider baseado na periodicidade (equivalente a 0-20% ao ano)
            if (periodoNovo === 'ano') {
                sliderTaxa.min = 0;
                sliderTaxa.max = 20;
                sliderTaxa.step = obterPassoTaxa(periodoNovo);
            } else if (periodoNovo === 'mes') {
                sliderTaxa.min = 0;
                sliderTaxa.max = (Math.pow(1.20, 1 / 12) - 1) * 100; // ~1.531%
                sliderTaxa.step = obterPassoTaxa(periodoNovo);
            } else { // dia
                sliderTaxa.min = 0;
                sliderTaxa.max = (Math.pow(1.20, 1 / 365) - 1) * 100; // ~0.0501%
                sliderTaxa.step = obterPassoTaxa(periodoNovo);
            }

            // O slider respeita o próprio máximo; o override preserva o valor
            // convertido integral (digitação livre pode exceder o slider).
            const taxaConvertidaSlider = Math.min(taxaConvertida, parseFloat(sliderTaxa.max));
            sliderTaxa.value = taxaConvertidaSlider;
            if (temOverrideTaxa) {
                this.valoresEntradaOverride.taxa = Number(taxaConvertida.toFixed(6));
            }
            if (inputTaxa) {
                inputTaxa.value = formatarNumero(
                    temOverrideTaxa ? taxaConvertida : taxaConvertidaSlider,
                    casasDecimais
                );
            }

            // Atualizar periodicidade anterior
            this.periodicidadeAnterior = periodoNovo;
        } else {
            // Apenas atualizar display se não mudou periodicidade
            if (inputTaxa) {
                inputTaxa.value = formatarNumero(taxaAtual, casasDecimais);
            }
        }
    }

    obterDadosEntrada() {
        const sliderValor = document.getElementById('sliderValor');
        const sliderTaxa = document.getElementById('sliderTaxa');
        const sliderPrazo = document.getElementById('sliderPrazo');
        const sliderExtraPagamento = document.getElementById('sliderExtraPagamento');

        const valor = this.valoresEntradaOverride.valor ?? parseFloat(sliderValor?.value || 115000);
        const taxaInput = this.valoresEntradaOverride.taxa ?? parseFloat(sliderTaxa?.value || 3.16);
        const prazoOverride = this.valoresEntradaOverride.prazo;
        const prazoAnos = prazoOverride != null
            ? Math.max(1, Math.round(prazoOverride))
            : parseInt(sliderPrazo?.value || 30);
        const extraPagamento = this.valoresEntradaOverride.extra ?? parseFloat(sliderExtraPagamento?.value || 0);

        const periodicidade = document.querySelector('input[name="periodoRapido"]:checked')?.value || 'ano';
        const sistema = document.querySelector('input[name="sistemaRapido"]:checked')?.value || 'price';
        const periodicidadeExtra = document.querySelector('input[name="periodoExtra"]:checked')?.value || 'semestral';

        // Número de parcelas sempre mensal
        const numParcelas = prazoAnos * 12;

        // Converter taxa para mensal baseado na periodicidade
        let taxaMensal;

        taxaMensal = converterTaxaParaMensal(taxaInput, periodicidade);

        const pagamentosExtrasEspecificos = [];
        document.querySelectorAll('.extra-especifico-row').forEach((linha) => {
            const inputValor = linha.querySelector('.input-extra-especifico-valor');
            const inputParcela = linha.querySelector('.input-extra-especifico-parcela');

            const valorExtra = parseInt((inputValor?.value || '').replace(/\D/g, ''), 10);
            const parcelaExtra = parseInt(inputParcela?.value || '0', 10);

            if (!isNaN(valorExtra) && valorExtra > 0 && !isNaN(parcelaExtra) && parcelaExtra >= 1 && parcelaExtra <= numParcelas) {
                pagamentosExtrasEspecificos.push({
                    parcela: parcelaExtra,
                    valor: valorExtra
                });
            }
        });

        return {
            valor,
            taxaMensal,
            numParcelas,
            sistema,
            taxaExibida: taxaInput,
            periodicidade,
            extraPagamento,
            periodicidadeExtra,
            pagamentosExtrasEspecificos
        };
    }

    calcular() {
        this.aplicarSistemaNaTela();

        // Bolån tem tela própria: nada da malha SAC/Price/Americano se aplica.
        if (this.sistemaSelecionado === 'bolan') {
            this.calcularBolanUI();
            return;
        }

        const dados = this.obterDadosEntrada();

        // Atualizar displays dos sliders
        this.atualizarDisplays(dados);

        // Calcular tabela de amortização
        this.tabelaAmortizacao = this.calcularAmortizacao(dados);

        // Atualizar resultados
        this.atualizarResultados(dados);

        // Atualizar comparação dos sistemas
        this.atualizarComparacaoValores(dados);

        // Atualizar slider de parcelas
        const sliderParcelas = document.getElementById('sliderParcelas');
        if (sliderParcelas) {
            sliderParcelas.max = this.tabelaAmortizacao.length;
            if (this.ultimaParcelaSelecionada > this.tabelaAmortizacao.length) {
                this.ultimaParcelaSelecionada = 1;
            }
            sliderParcelas.value = this.ultimaParcelaSelecionada;
        }

        this.atualizarParcelaExibida();
        this.gerarTabelaCompleta();
        this.atualizarGrafico();
        this.atualizarGraficoExtraRecorrente(dados);
        try {
            this.atualizarMemorial(dados);
        } catch (error) {
            console.error('[Mutuo] Erro ao atualizar memorial:', error);
        }
    }

    calcularAmortizacao(dados) {
        return calcularAmortizacaoPuro(dados);
    }

    atualizarDisplays(dados) {
        const ativo = document.activeElement;

        // Atualizar input de valor
        const inputValor = document.getElementById('inputValor');
        if (inputValor && ativo !== inputValor) {
            inputValor.value = formatarNumero(dados.valor, 0);
        }

        // Atualizar input de taxa com casas decimais variáveis
        const inputTaxa = document.getElementById('inputTaxa');
        if (inputTaxa && ativo !== inputTaxa) {
            const casasDecimais = dados.periodicidade === 'dia' ? 4 : (dados.periodicidade === 'mes' ? 3 : 2);
            inputTaxa.value = formatarNumero(dados.taxaExibida, casasDecimais);
        }

        // Atualizar input de prazo
        const inputPrazo = document.getElementById('inputPrazo');
        if (inputPrazo && ativo !== inputPrazo) {
            const prazo = Math.max(1, Math.round((dados.numParcelas || 360) / 12));
            inputPrazo.value = prazo;
        }

        const inputExtraPagamento = document.getElementById('inputExtraPagamento');
        if (inputExtraPagamento && ativo !== inputExtraPagamento) {
            const extra = parseInt(dados.extraPagamento || 0);
            inputExtraPagamento.value = formatarNumero(extra, 0);
        }
    }

    atualizarResultados(dados) {
        const totalPago = this.tabelaAmortizacao.reduce((sum, p) => sum + p.parcela, 0);
        const jurosTotais = this.tabelaAmortizacao.reduce((sum, p) => sum + p.juros, 0);
        const percJuros = (jurosTotais / dados.valor) * 100;

        // Atualizar número total de parcelas
        const totalParcelas = document.getElementById('totalParcelas');
        if (totalParcelas) totalParcelas.textContent = this.tabelaAmortizacao.length;

        const mesesQuitacao = this.tabelaAmortizacao.length;

        // Painel de explicação V2.0
        this.renderizarExplicacao({ dados, totalPago, jurosTotais, percJuros, mesesQuitacao });
    }

    // Texto da explicação por chave i18n. Era um ternário pt/it, que deixava o
    // sueco cair no italiano assim que o bolån virou o 4º sistema e o sueco
    // passou a ver também as telas de SAC/Price/Americano.
    textoExp(chave, substituicoes = {}) {
        let texto = i18n.obterTraducao(`exp.${chave}`) || '';
        for (const [alvo, valor] of Object.entries(substituicoes)) {
            texto = texto.replaceAll(`{${alvo}}`, valor);
        }
        return texto;
    }

    renderizarExplicacao({ dados, totalPago, jurosTotais, percJuros, mesesQuitacao }) {
        const anos = Math.floor(mesesQuitacao / 12);
        const meses = mesesQuitacao % 12;
        const sistemaLabel = {
            sac: this.textoExp('sistemaSac'),
            price: this.textoExp('sistemaPrice'),
            americano: this.textoExp('sistemaAmericano')
        }[dados.sistema] || dados.sistema;

        const totalPagoStr = this.formatarMoedaLocal(totalPago);
        const jurosTotaisStr = this.formatarMoedaLocal(jurosTotais);
        const valorStr = this.formatarMoedaLocal(dados.valor);
        const percStr = formatarNumero(percJuros, 1);
        const primeiraParcela = this.tabelaAmortizacao[0]?.parcela || 0;
        const ultimaParcela = this.tabelaAmortizacao[this.tabelaAmortizacao.length - 1]?.parcela || 0;
        const tempoStr = anos > 0
            ? this.textoExp('tempoAnosMeses', { anos, meses })
            : this.textoExp('tempoMeses', { meses });

        this.explicacao.renderizar({
            destaque: this.textoExp('destaque', {
                valor: valorStr, sistema: sistemaLabel, juros: jurosTotaisStr, perc: percStr
            }),
            linhas: [
                {
                    icone: '💸',
                    titulo: this.textoExp('jurosTitulo'),
                    valor: `${jurosTotaisStr} (${percStr}%)`,
                    descricao: this.textoExp('jurosTexto', { valor: valorStr })
                },
                {
                    icone: '📅',
                    titulo: this.textoExp('prazoTitulo'),
                    valor: tempoStr,
                    descricao: this.textoExp('prazoTexto', { parcelas: mesesQuitacao })
                },
                {
                    icone: '💳',
                    titulo: this.textoExp('primeiraTitulo'),
                    valor: this.formatarMoedaLocal(primeiraParcela),
                    descricao: dados.sistema === 'sac'
                        ? this.textoExp('primeiraTextoSac', { ultima: this.formatarMoedaLocal(ultimaParcela) })
                        : this.textoExp('primeiraTextoFixa')
                },
                {
                    icone: '🏁',
                    titulo: this.textoExp('totalTitulo'),
                    valor: totalPagoStr,
                    descricao: this.textoExp('totalTexto', { valor: valorStr, juros: jurosTotaisStr })
                }
            ],
            dica: this.textoExp('dica')
        });
    }

    atualizarParcelaExibida() {
        const parcela = this.tabelaAmortizacao[this.ultimaParcelaSelecionada - 1];
        if (!parcela) return;

        const numeroParcela = document.getElementById('numeroParcela');
        const valorAmortizacao = document.getElementById('valorAmortizacao');
        const labelAmortizacaoParcela = document.getElementById('labelAmortizacaoParcela');
        const valorJurosParcela = document.getElementById('valorJurosParcela');
        const saldoDevedor = document.getElementById('saldoDevedor');
        const proporcaoAmortJurosParcela = document.getElementById('proporcaoAmortJurosParcela');

        // Quando houver pagamento extra, ele tambem entra como amortizacao efetiva.
        const amortizacaoEfetiva = parcela.amortizacao + (parcela.extraPagamento || 0);
        const totalParcela = amortizacaoEfetiva + parcela.juros;
        const percentualAmortizacao = totalParcela > 0 ? (amortizacaoEfetiva / totalParcela) * 100 : 0;
        const percentualJuros = totalParcela > 0 ? (parcela.juros / totalParcela) * 100 : 0;

        if (numeroParcela) numeroParcela.textContent = parcela.numero;
        if (labelAmortizacaoParcela) {
            const temExtra = (parcela.extraPagamento || 0) > 0;
            labelAmortizacaoParcela.textContent = temExtra
                ? (this.traducoes['amortization-with-extra'] || 'Amortização (+ extra)')
                : (this.traducoes['amortization'] || 'Amortização');
        }
        if (valorAmortizacao) valorAmortizacao.textContent = this.formatarMoedaLocal(amortizacaoEfetiva);
        if (valorJurosParcela) valorJurosParcela.textContent = this.formatarMoedaLocal(parcela.juros);
        if (saldoDevedor) saldoDevedor.textContent = this.formatarMoedaLocal(parcela.saldo);
        if (proporcaoAmortJurosParcela) {
            proporcaoAmortJurosParcela.textContent = `${formatarNumero(percentualAmortizacao, 1)}% / ${formatarNumero(percentualJuros, 1)}%`;
        }
    }

    toggleTabela() {
        const tabelaSection = document.getElementById('tabelaSection');
        const resultados = document.getElementById('resultados');

        if (!tabelaSection) return;

        if (tabelaSection.style.display === 'none' || tabelaSection.style.display === '') {
            this.gerarTabelaCompleta();
            tabelaSection.style.display = 'block';
            if (resultados) resultados.style.display = 'none';
        } else {
            tabelaSection.style.display = 'none';
            if (resultados) resultados.style.display = 'block';
        }
    }

    gerarTabelaCompleta() {
        const tabela = document.getElementById('tabelaAmortizacao');
        if (!tabela) return;

        const tbody = tabela.querySelector('tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        this.tabelaAmortizacao.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.numero}</td>
                <td>${this.formatarMoedaLocal(p.parcela)}</td>
                <td>${this.formatarMoedaLocal(p.amortizacao)}</td>
                <td>${this.formatarMoedaLocal(p.juros)}</td>
                <td>${this.formatarMoedaLocal(p.extraPagamento || 0)}</td>
                <td>${this.formatarMoedaLocal(p.saldo)}</td>
            `;
            tbody.appendChild(tr);
        });

        // Linha de total
        const totalParcelas = this.tabelaAmortizacao.reduce((sum, p) => sum + p.parcela, 0);
        const totalAmort = this.tabelaAmortizacao.reduce((sum, p) => sum + p.amortizacao, 0);
        const totalJuros = this.tabelaAmortizacao.reduce((sum, p) => sum + p.juros, 0);
        const totalExtra = this.tabelaAmortizacao.reduce((sum, p) => sum + (p.extraPagamento || 0), 0);

        const trTotal = document.createElement('tr');
        trTotal.className = 'linha-total';
        trTotal.innerHTML = `
            <td><strong>${this.traducoes['tabela']?.totalizado || 'TOTAL'}</strong></td>
            <td><strong>${this.formatarMoedaLocal(totalParcelas)}</strong></td>
            <td><strong>${this.formatarMoedaLocal(totalAmort)}</strong></td>
            <td><strong>${this.formatarMoedaLocal(totalJuros)}</strong></td>
            <td><strong>${this.formatarMoedaLocal(totalExtra)}</strong></td>
            <td>-</td>
        `;
        tbody.appendChild(trTotal);
    }

    atualizarComparacaoValores(dados) {
        const tabela = document.getElementById('tabelaComparacaoValores');
        if (!tabela) return;

        // Atualizar subtítulo com valores reais
        const subtitle = document.getElementById('comparison-subtitle');
        if (subtitle) {
            const valorStr = this.formatarMoedaLocal(dados.valor);
            const casasDecimais = dados.periodicidade === 'dia' ? 4 : (dados.periodicidade === 'mes' ? 3 : 2);
            const taxaStr = formatarNumero(dados.taxaExibida, casasDecimais) + '%';
            const periodoStr = dados.periodicidade === 'ano'
                ? (this.traducoes['unidades']?.aoAno || 'ao ano')
                : dados.periodicidade === 'mes'
                    ? (this.traducoes['unidades']?.aoMes || 'ao mês')
                    : 'ao dia';
            const paraLabel = this.textoExp('comparacaoPara');
            const porLabel = this.textoExp('comparacaoPor');
            const mesesLabel = this.textoExp('comparacaoMeses');
            subtitle.innerHTML = `<strong>${paraLabel} ${valorStr} a ${taxaStr} ${periodoStr} ${porLabel} ${dados.numParcelas} ${mesesLabel}:</strong>`;
        }

        // Calcular os 3 sistemas com os valores atuais
        const sistemas = ['sac', 'price', 'americano'];
        const resultados = sistemas.map(sistema => {
            const tabAmort = this.calcularAmortizacao({ ...dados, sistema });
            const totalJuros = tabAmort.reduce((sum, p) => sum + p.juros, 0);
            const primeira = tabAmort[0]?.parcela || 0;
            const ultima = tabAmort[tabAmort.length - 1]?.parcela || 0;
            return { totalJuros, primeira, ultima };
        });

        const rows = tabela.querySelectorAll('tbody tr');
        rows.forEach((row, idx) => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 4 && resultados[idx]) {
                cells[1].textContent = this.formatarMoedaLocal(resultados[idx].totalJuros);
                cells[2].textContent = this.formatarMoedaLocal(resultados[idx].primeira);
                cells[3].textContent = this.formatarMoedaLocal(resultados[idx].ultima);
            }
        });
    }

    obterResumoJuros(tabela, valorBase) {
        const jurosTotais = tabela.reduce((sum, parcela) => sum + parcela.juros, 0);
        const percentualJuros = valorBase > 0 ? (jurosTotais / valorBase) * 100 : 0;

        return {
            jurosTotais,
            percentualJuros
        };
    }

    gerarPontosGraficoExtraRecorrente(dados) {
        const valorMaximoExtra = 10000;
        const passo = 250;
        const pontos = [];

        for (let extra = 0; extra <= valorMaximoExtra; extra += passo) {
            const tabela = this.calcularAmortizacao({ ...dados, extraPagamento: extra });
            const { jurosTotais, percentualJuros } = this.obterResumoJuros(tabela, dados.valor);

            pontos.push({
                x: extra,
                y: Number(percentualJuros.toFixed(3)),
                jurosTotais
            });
        }

        return pontos;
    }

    atualizarGraficoExtraRecorrente(dados) {
        const canvas = document.getElementById('graficoExtraRecorrente');
        if (!canvas || typeof Chart === 'undefined') return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (this.graficos.extraRecorrente) {
            this.graficos.extraRecorrente.destroy();
        }

        const pontos = this.gerarPontosGraficoExtraRecorrente(dados);
        const cores = this.obterCoresGrafico();
        const extraAtual = Math.max(0, Number(dados.extraPagamento) || 0);
        const pontoAtual = (extraAtual <= 10000)
            ? (() => {
                const tabelaAtual = this.calcularAmortizacao(dados);
                const { jurosTotais, percentualJuros } = this.obterResumoJuros(tabelaAtual, dados.valor);
                return [{
                    x: extraAtual,
                    y: Number(percentualJuros.toFixed(3)),
                    jurosTotais
                }];
            })()
            : [];

        const tituloEixoX = `${this.traducoes['extra-chart-axis-x'] || 'Pagamento extra recorrente'} (${this.traducoes['input-currency-unit'] || 'R$'})`;
        const tituloEixoY = this.traducoes['extra-chart-axis-y'] || '% total de juros';

        this.graficos.extraRecorrente = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: this.traducoes['extra-chart-series'] || '% Total de Juros',
                        data: pontos,
                        borderColor: cores.orange,
                        backgroundColor: cores.orangeSoft,
                        tension: 0.28,
                        fill: true,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointHitRadius: 10
                    },
                    {
                        type: 'scatter',
                        label: this.traducoes['extra-chart-current-point'] || 'Extra atual',
                        data: pontoAtual,
                        borderColor: cores.blue,
                        backgroundColor: cores.blue,
                        pointRadius: pontoAtual.length ? 4 : 0,
                        pointHoverRadius: pontoAtual.length ? 5 : 0,
                        pointHitRadius: pontoAtual.length ? 10 : 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: (items) => {
                                const ponto = items[0]?.raw;
                                return `${this.traducoes['extra-chart-axis-x'] || 'Pagamento extra recorrente'}: ${this.formatarMoedaLocal(ponto?.x || 0)}`;
                            },
                            label: (contexto) => {
                                const percentual = Number(contexto.parsed.y || 0);
                                return `${this.traducoes['extra-chart-axis-y'] || '% total de juros'}: ${formatarNumero(percentual, 1)}%`;
                            },
                            afterLabel: (contexto) => {
                                const jurosTotais = contexto.raw?.jurosTotais || 0;
                                return `${this.traducoes['extra-chart-tooltip-total-interest'] || 'Total de juros'}: ${this.formatarMoedaLocal(jurosTotais)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        min: 0,
                        max: 10000,
                        ticks: {
                            color: cores.text,
                            maxTicksLimit: 6,
                            callback: (valor) => formatarNumero(Number(valor), 0)
                        },
                        grid: {
                            color: cores.grid
                        },
                        title: {
                            display: true,
                            text: tituloEixoX,
                            color: cores.text
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: cores.text,
                            callback: (valor) => `${formatarNumero(Number(valor), 0)}%`
                        },
                        grid: {
                            color: cores.grid
                        },
                        title: {
                            display: true,
                            text: tituloEixoY,
                            color: cores.text
                        }
                    }
                }
            }
        });
    }

    atualizarGrafico() {
        const canvas = document.getElementById('graficoEvolutivo');
        if (!canvas || typeof Chart === 'undefined') return;

        const ctx = canvas.getContext('2d');

        // Destruir gráfico anterior
        if (this.graficos.evolucao) {
            this.graficos.evolucao.destroy();
        }

        const totalMeses = this.tabelaAmortizacao.length;
        const totalAnos = totalMeses / 12;
        const passoMensal = 1 / 12;
        const tolerancia = 0.0001;
        const ehMarcoAnual = (valor) => Math.abs(Number(valor) - Math.round(Number(valor))) < tolerancia;

        // Calcular valores acumulados
        let amortAcumulada = 0;
        let jurosAcumulados = 0;
        const dadosAmortAcum = this.tabelaAmortizacao.map(p => {
            amortAcumulada += p.amortizacao + (p.extraPagamento || 0);
            return { x: p.numero / 12, y: amortAcumulada };
        });
        const dadosJurosAcum = this.tabelaAmortizacao.map(p => {
            jurosAcumulados += p.juros;
            return { x: p.numero / 12, y: jurosAcumulados };
        });
        const dadosSaldo = this.tabelaAmortizacao.map(p => ({ x: p.numero / 12, y: p.saldo }));
        const maiorValorY = Math.max(
            0,
            ...dadosAmortAcum.map((p) => p.y),
            ...dadosJurosAcum.map((p) => p.y),
            ...dadosSaldo.map((p) => p.y)
        );
        const maximoEscalaY = maiorValorY > 0 ? maiorValorY * 1.02 : 1;
        const cores = this.obterCoresGrafico();

        this.graficos.evolucao = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: i18n.t('grafico.amortizacao'),
                        data: dadosAmortAcum,
                        borderColor: cores.green,
                        backgroundColor: cores.greenSoft,
                        showLine: false,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                        pointHitRadius: 8
                    },
                    {
                        label: i18n.t('grafico.juros'),
                        data: dadosJurosAcum,
                        borderColor: cores.orange,
                        backgroundColor: cores.orangeSoft,
                        showLine: false,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                        pointHitRadius: 8
                    },
                    {
                        label: i18n.t('grafico.saldoDevedor'),
                        data: dadosSaldo,
                        borderColor: cores.blue,
                        backgroundColor: cores.blueSoft,
                        showLine: false,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                        pointHitRadius: 8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: cores.text
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title: (items) => {
                                const ponto = items[0]?.raw;
                                const parcela = Math.round((ponto?.x || 0) * 12);
                                return `${this.traducoes['unidades']?.parcela || 'Parcela'} ${parcela} • ${this.formatarTempoGrafico(ponto?.x || 0)}`;
                            },
                            label: (contexto) => `${contexto.dataset.label}: ${this.formatarMoedaLocal(contexto.parsed.y)}`
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        min: 0,
                        max: Math.max(totalAnos, passoMensal),
                        ticks: {
                            color: cores.text,
                            stepSize: passoMensal,
                            autoSkip: false,
                            maxRotation: 0,
                            callback: (valor) => {
                                if (!ehMarcoAnual(valor)) {
                                    return '';
                                }

                                return String(Math.round(Number(valor)));
                            }
                        },
                        grid: {
                            color: (contexto) => ehMarcoAnual(contexto.tick?.value) ? cores.grid : 'rgba(0, 0, 0, 0.04)',
                            lineWidth: (contexto) => ehMarcoAnual(contexto.tick?.value) ? 1 : 0.6,
                            tickLength: 4
                        },
                        title: {
                            display: true,
                            text: i18n.t('grafico.eixoX'),
                            color: cores.text
                        }
                    },
                    xTop: {
                        type: 'linear',
                        position: 'top',
                        min: 0,
                        max: Math.max(totalAnos, passoMensal),
                        ticks: {
                            display: true,
                            color: cores.text,
                            stepSize: passoMensal,
                            autoSkip: false,
                            maxRotation: 0,
                            callback: (valor) => {
                                if (!ehMarcoAnual(valor)) {
                                    return '';
                                }

                                return String(Math.round(Number(valor)));
                            }
                        },
                        grid: {
                            drawOnChartArea: false,
                            drawTicks: true,
                            color: cores.grid
                        },
                        title: {
                            display: true,
                            text: i18n.t('grafico.eixoX'),
                            color: cores.text
                        }
                    },
                    y: {
                        ticks: {
                            color: cores.text,
                            callback: (valor) => formatarNumero(Number(valor), 0)
                        },
                        grid: {
                            color: cores.grid
                        },
                        title: {
                            display: true,
                            text: i18n.t('grafico.eixoY'),
                            color: cores.text
                        },
                        beginAtZero: true,
                        max: maximoEscalaY
                    },
                    yRight: {
                        position: 'right',
                        beginAtZero: true,
                        max: maximoEscalaY,
                        ticks: {
                            color: cores.text,
                            callback: (valor) => formatarNumero(Number(valor), 0)
                        },
                        grid: {
                            drawOnChartArea: false,
                            drawTicks: true,
                            color: cores.grid
                        },
                        title: {
                            display: false
                        }
                    }
                }
            }
        });
    }
    atualizarMemorial(dados) {
        const { valor, taxaMensal, taxaExibida, numParcelas, sistema, periodicidade } = dados;

        if (!this.tabelaAmortizacao || this.tabelaAmortizacao.length === 0) {
            return;
        }

        // Calcular totais
        const totalJuros = this.tabelaAmortizacao.reduce((sum, p) => sum + p.juros, 0);
        const totalPago = valor + totalJuros;
        const totalParcelasReais = this.tabelaAmortizacao.length;
        const primeiraParcela = this.tabelaAmortizacao[0]?.parcela || 0;
        const ultimaParcela = this.tabelaAmortizacao[totalParcelasReais - 1]?.parcela || 0;
        const prazoAnos = Math.floor(numParcelas / 12);

        // Atualizar resumo no topo do memorial
        const resumoValor = document.getElementById('resumo-valor');
        const resumoTaxa = document.getElementById('resumo-taxa');
        const resumoPrazo = document.getElementById('resumo-prazo');
        const resumoSistema = document.getElementById('resumo-sistema');
        const resumoParcela = document.getElementById('resumo-parcela');
        const resumoTotalJuros = document.getElementById('resumo-total-juros');
        const resumoTotalPago = document.getElementById('resumo-total-pago');

        if (resumoValor) resumoValor.textContent = this.formatarMoedaLocal(valor);
        if (resumoTaxa) {
            const casasDecimaisTaxa = periodicidade === 'dia' ? 4 : (periodicidade === 'mes' ? 3 : 2);
            const periodoTexto = periodicidade === 'ano' ? this.traducoes['unidades']?.aoAno || 'ao ano' :
                               periodicidade === 'mes' ? this.traducoes['unidades']?.aoMes || 'ao mês' :
                               'ao dia';
            resumoTaxa.textContent = formatarNumero(taxaExibida, casasDecimaisTaxa) + '% ' + periodoTexto;
        }
        if (resumoPrazo) {
            const textoPrazo = `${prazoAnos} ${this.traducoes['unidades']?.anos || 'anos'} (${totalParcelasReais} ${this.traducoes['unidades']?.meses || 'meses'})`;
            resumoPrazo.textContent = textoPrazo;
        }
        if (resumoSistema) {
            const nomeSistema = sistema === 'sac' ? this.traducoes['system-sac-short'] || 'SAC' :
                              sistema === 'price' ? this.traducoes['system-price-short'] || 'Price' :
                              this.traducoes['system-german-short'] || 'Americano';
            resumoSistema.textContent = nomeSistema;
        }
        if (resumoParcela) {
            if (sistema === 'sac') {
                resumoParcela.textContent = this.formatarMoedaLocal(primeiraParcela) + ' → ' + this.formatarMoedaLocal(ultimaParcela);
            } else {
                resumoParcela.textContent = this.formatarMoedaLocal(primeiraParcela);
            }
        }
        if (resumoTotalJuros) resumoTotalJuros.textContent = this.formatarMoedaLocal(totalJuros);
        if (resumoTotalPago) resumoTotalPago.textContent = this.formatarMoedaLocal(totalPago);

        // Gerar conteúdo dinâmico do memorial
        const conteudoDinamico = document.getElementById('memorial-conteudo-dinamico');
        if (!conteudoDinamico) return;

        let htmlConteudo = '';

        // Indicação do sistema selecionado
        const nomeSistema = sistema === 'sac' ? this.traducoes['system-sac-short'] || 'SAC' :
                          sistema === 'price' ? this.traducoes['system-price-short'] || 'Price' :
                          this.traducoes['system-german-short'] || 'Americano';

        const explicacaoSistema = sistema === 'sac' ? ' (' + (this.traducoes['sistemas']?.sac || 'Sistema de Amortização Constante') + ')' :
                                sistema === 'price' ? ' (' + (this.traducoes['sistemas']?.price || 'Tabela Price') + ')' :
                                ' (' + (this.traducoes['sistemas']?.americano || 'Sistema Americano') + ')';

        htmlConteudo += `
            <div class="memorial-item" style="background: var(--accent-hover-bg, rgba(45, 159, 163, 0.1)); padding: 15px; border-left: 4px solid var(--accent-color, #2d9fa3ff); border-radius: 4px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 1.1em;"><strong>${this.traducoes['memorial-sistema-selecionado'] || 'Sistema selecionado:'}</strong> <span style="color: var(--accent-color, #2d9fa3ff); font-weight: bold;">${nomeSistema}${explicacaoSistema}</span></p>
            </div>
        `;

        // Passo 1: Converter Taxa
        const periodoTexto = periodicidade === 'ano' ? (this.traducoes['period-year-short'] || 'Anual') :
                           periodicidade === 'mes' ? (this.traducoes['period-month-short'] || 'Mensal') :
                           (this.traducoes['period-day-short'] || 'Diária');
        const casasDecimaisTaxa = periodicidade === 'dia' ? 4 : (periodicidade === 'mes' ? 3 : 2);
        const textoTaxa = this.traducoes['memorial-rate-label'] || 'Taxa';
        const textoTaxaMensal = this.traducoes['memorial-monthly-rate-label'] || 'Taxa Mensal';
        const formulaConversaoTaxa = periodicidade === 'ano'
            ? `${textoTaxaMensal} (%) = [(1 + ${textoTaxa} (%) / 100)^(1/12) - 1] × 100`
            : periodicidade === 'mes'
                ? `${textoTaxaMensal} (%) = ${textoTaxa} (%)`
                : `${textoTaxaMensal} (%) = [(1 + ${textoTaxa} (%) / 100)^30 - 1] × 100`;

        htmlConteudo += `
            <div class="memorial-item">
                <h3>${this.traducoes['memorial-passo1-title'] || '1️⃣ Passo 1: Converter Taxa para Mensal'}</h3>
                <p><strong>${this.traducoes['memorial-formula'] || 'Fórmula:'}</strong></p>
                <div class="formula-box">
                    <p><strong>${formulaConversaoTaxa}</strong></p>
                </div>
                <p>${this.traducoes['memorial-passo1-explicacao'] || 'Todos os cálculos são feitos com taxa mensal.'}</p>
                <p><strong>${this.traducoes['memorial-example'] || 'Exemplo:'}</strong> ${textoTaxa} ${formatarNumero(taxaExibida, casasDecimaisTaxa)}% → ${textoTaxaMensal} = ${formatarNumero(taxaMensal * 100, 4)}%</p>
            </div>
        `;

        // Passo 2: Número de Parcelas
        htmlConteudo += `
            <div class="memorial-item">
                <h3>${this.traducoes['memorial-passo2-title'] || '2️⃣ Passo 2: Calcular Número de Parcelas'}</h3>
                <p><strong>${this.traducoes['memorial-formula'] || 'Fórmula:'}</strong></p>
                <div class="formula-box">
                    <p><strong>${this.traducoes['unidades']?.parcela || 'Parcelas'} = ${this.traducoes['labels']?.prazo || 'Prazo'} (${this.traducoes['unidades']?.anos || 'anos'}) × 12</strong></p>
                </div>
                <p>${this.traducoes['memorial-passo2-explicacao'] || 'O número de parcelas é calculado multiplicando o prazo por 12.'}</p>
                <p><strong>${this.traducoes['memorial-example'] || 'Exemplo:'}</strong> ${prazoAnos} ${this.traducoes['unidades']?.anos || 'anos'} × 12 = ${numParcelas} ${this.traducoes['unidades']?.parcela || 'parcelas'}</p>
            </div>
        `;

        const gerarPainelPasso3 = (sistemaPainel, tabelaSistema) => {
            const totalParcelasPainel = tabelaSistema.length;
            const parcela1 = tabelaSistema[0];
            const indiceMeio = Math.max(0, Math.floor(totalParcelasPainel / 2) - 1);
            const parcelaMeio = tabelaSistema[indiceMeio] || parcela1;
            const parcelaUltima = tabelaSistema[totalParcelasPainel - 1] || parcela1;

            if (sistemaPainel === 'sac') {
                const amortizacao = valor / numParcelas;
                return `
                    <div class="system-panel" data-system-panel="sac" hidden>
                        <div class="memorial-item">
                            <h4>${this.traducoes['memorial-sac-passo1-title'] || 'SAC - Passo 1: Calcular Amortização Constante'}</h4>
                            <p><strong>${this.traducoes['memorial-formula'] || 'Fórmula:'}</strong></p>
                            <div class="formula-box">
                                <p><strong>${this.traducoes['tabela']?.amortizacao || 'Amortização'} = ${this.traducoes['labels']?.valorEmprestado || 'Valor Emprestado'} ÷ ${numParcelas}</strong></p>
                            </div>
                            <p>${this.traducoes['memorial-sac-passo1-explicacao'] || 'A amortização é sempre a mesma em todas as parcelas.'}</p>
                            <p><strong>${this.traducoes['memorial-example'] || 'Exemplo:'}</strong> ${this.formatarMoedaLocal(valor)} ÷ ${numParcelas} = ${this.formatarMoedaLocal(amortizacao)}</p>
                        </div>
                        <div class="memorial-item">
                            <h4>${this.traducoes['memorial-sac-passo2-title'] || 'SAC - Passo 2: Calcular Juros e Parcela'}</h4>
                            <p><strong>${this.traducoes['memorial-formula'] || 'Fórmula:'}</strong></p>
                            <div class="formula-box">
                                <p><strong>${this.traducoes['tabela']?.juros || 'Juros'} = ${this.traducoes['tabela']?.saldoDevedor || 'Saldo Devedor'} × ${textoTaxa}<br>${this.traducoes['unidades']?.parcela || 'Parcela'} = ${this.traducoes['tabela']?.amortizacao || 'Amortização'} + ${this.traducoes['tabela']?.juros || 'Juros'}</strong></p>
                            </div>
                            <p>${this.traducoes['memorial-sac-passo2-explicacao'] || 'Os juros diminuem a cada parcela porque o saldo diminui.'}</p>
                            <ul>
                                <li>${this.traducoes['unidades']?.meses || 'Mês'} 1: ${this.traducoes['tabela']?.juros || 'Juros'} = ${this.formatarMoedaLocal(parcela1.juros)} -> ${this.traducoes['unidades']?.parcela || 'Parcela'} = ${this.formatarMoedaLocal(amortizacao)} + ${this.formatarMoedaLocal(parcela1.juros)} = ${this.formatarMoedaLocal(parcela1.parcela)}</li>
                                <li>${this.traducoes['unidades']?.meses || 'Mês'} ${indiceMeio + 1}: ${this.traducoes['tabela']?.juros || 'Juros'} = ${this.formatarMoedaLocal(parcelaMeio.juros)} -> ${this.traducoes['unidades']?.parcela || 'Parcela'} = ${this.formatarMoedaLocal(amortizacao)} + ${this.formatarMoedaLocal(parcelaMeio.juros)} = ${this.formatarMoedaLocal(parcelaMeio.parcela)}</li>
                                <li>${this.traducoes['unidades']?.meses || 'Mês'} ${totalParcelasPainel}: ${this.traducoes['tabela']?.juros || 'Juros'} = ${this.formatarMoedaLocal(parcelaUltima.juros)} -> ${this.traducoes['unidades']?.parcela || 'Parcela'} = ${this.formatarMoedaLocal(amortizacao)} + ${this.formatarMoedaLocal(parcelaUltima.juros)} = ${this.formatarMoedaLocal(parcelaUltima.parcela)}</li>
                            </ul>
                        </div>
                    </div>
                `;
            }

            if (sistemaPainel === 'price') {
                return `
                    <div class="system-panel" data-system-panel="price" hidden>
                        <div class="memorial-item">
                            <h4>${this.traducoes['memorial-price-passo1-title'] || 'Price - Passo 1: Calcular Parcela Fixa (PMT)'}</h4>
                            <p><strong>${this.traducoes['memorial-formula'] || 'Fórmula:'}</strong></p>
                            <div class="formula-box">
                                <p><strong>PMT = PV × [i × (1+i)^n] ÷ [(1+i)^n - 1]</strong></p>
                            </div>
                            <p>${this.traducoes['memorial-price-passo1-explicacao'] || 'Esta fórmula calcula o valor da parcela fixa.'}</p>
                            <p><strong>${this.traducoes['memorial-example'] || 'Exemplo:'}</strong> PMT = ${this.formatarMoedaLocal(parcela1.parcela)}</p>
                        </div>
                        <div class="memorial-item">
                            <h4>${this.traducoes['memorial-price-passo2-title'] || 'Price - Passo 2: Calcular Juros e Amortização'}</h4>
                            <p><strong>${this.traducoes['memorial-formula'] || 'Fórmula:'}</strong></p>
                            <div class="formula-box">
                                <p><strong>${this.traducoes['tabela']?.juros || 'Juros'} = ${this.traducoes['tabela']?.saldoDevedor || 'Saldo'} × ${textoTaxa}<br>${this.traducoes['tabela']?.amortizacao || 'Amortização'} = PMT - ${this.traducoes['tabela']?.juros || 'Juros'}</strong></p>
                            </div>
                            <p>${this.traducoes['memorial-price-passo2-explicacao'] || 'A parcela é fixa, mas a composição muda ao longo do tempo.'}</p>
                            <ul>
                                <li>${this.traducoes['unidades']?.meses || 'Mês'} 1: ${this.traducoes['tabela']?.juros || 'Juros'} = ${this.formatarMoedaLocal(parcela1.juros)}, ${this.traducoes['tabela']?.amortizacao || 'Amortização'} = ${this.formatarMoedaLocal(parcela1.amortizacao)}</li>
                                <li>${this.traducoes['unidades']?.meses || 'Mês'} ${indiceMeio + 1}: ${this.traducoes['tabela']?.juros || 'Juros'} = ${this.formatarMoedaLocal(parcelaMeio.juros)}, ${this.traducoes['tabela']?.amortizacao || 'Amortização'} = ${this.formatarMoedaLocal(parcelaMeio.amortizacao)}</li>
                                <li>${this.traducoes['unidades']?.meses || 'Mês'} ${totalParcelasPainel}: ${this.traducoes['tabela']?.juros || 'Juros'} = ${this.formatarMoedaLocal(parcelaUltima.juros)}, ${this.traducoes['tabela']?.amortizacao || 'Amortização'} = ${this.formatarMoedaLocal(parcelaUltima.amortizacao)}</li>
                            </ul>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="system-panel" data-system-panel="americano" hidden>
                    <div class="memorial-item">
                        <h4>${this.traducoes['memorial-americano-passo1-title'] || 'Americano - Passo 1: Calcular Juros Mensais'}</h4>
                        <p><strong>${this.traducoes['memorial-formula'] || 'Fórmula:'}</strong></p>
                        <div class="formula-box">
                            <p><strong>${this.traducoes['tabela']?.juros || 'Juros'} = ${this.traducoes['labels']?.valorEmprestado || 'Valor Emprestado'} × ${textoTaxa}</strong></p>
                        </div>
                        <p>${this.traducoes['memorial-americano-passo1-explicacao'] || 'Os juros são sempre calculados sobre o valor total.'}</p>
                        <p><strong>${this.traducoes['memorial-example'] || 'Exemplo:'}</strong> ${this.traducoes['tabela']?.juros || 'Juros'} = ${this.formatarMoedaLocal(valor)} × ${formatarNumero(taxaMensal * 100, 4)}% = ${this.formatarMoedaLocal(parcela1.juros)}</p>
                    </div>
                    <div class="memorial-item">
                        <h4>${this.traducoes['memorial-americano-passo2-title'] || 'Americano - Passo 2: Calcular Parcelas'}</h4>
                        <p><strong>${this.traducoes['memorial-formula'] || 'Fórmula:'}</strong></p>
                        <div class="formula-box">
                            <p><strong>${this.traducoes['unidades']?.parcela || 'Parcelas'} 1 a n-1: ${this.traducoes['tabela']?.juros || 'Apenas Juros'}<br>Última: ${this.traducoes['tabela']?.juros || 'Juros'} + ${this.traducoes['labels']?.valorEmprestado || 'Valor Emprestado'}</strong></p>
                        </div>
                        <p>${this.traducoes['memorial-americano-passo2-explicacao'] || 'Paga-se apenas juros durante o período. O principal é pago no final.'}</p>
                        <ul>
                            <li>${this.traducoes['unidades']?.parcela || 'Parcelas'} 1 a ${Math.max(1, totalParcelasPainel - 1)}: ${this.formatarMoedaLocal(parcela1.parcela)} (${this.traducoes['tabela']?.juros || 'apenas juros'})</li>
                            <li>${this.traducoes['unidades']?.parcela || 'Parcela'} ${totalParcelasPainel}: ${this.formatarMoedaLocal(parcelaUltima.parcela)} (${this.traducoes['tabela']?.juros || 'juros'} + ${this.traducoes['labels']?.valorEmprestado || 'principal'})</li>
                        </ul>
                    </div>
                </div>
            `;
        };

        const tabelasPorSistema = {
            sac: this.calcularAmortizacao({ ...dados, sistema: 'sac' }),
            price: this.calcularAmortizacao({ ...dados, sistema: 'price' }),
            americano: this.calcularAmortizacao({ ...dados, sistema: 'americano' })
        };

        htmlConteudo += `
            <div class="memorial-item">
                <h3>${this.traducoes['memorial-passo3-title'] || '3️⃣ Passo 3: Calcular Tabela de Amortização'}</h3>
                <div class="memorial-system-switcher" role="tablist" aria-label="${this.textoExp('memorialAbaAria')}">
                    <button type="button" class="js-system-tab" data-system="sac" aria-selected="false">
                        <span>${this.traducoes['system-sac-short'] || 'SAC'}</span>
                    </button>
                    <button type="button" class="js-system-tab" data-system="price" aria-selected="false">
                        <span>${this.traducoes['system-price-short'] || 'Price'}</span>
                    </button>
                    <button type="button" class="js-system-tab" data-system="americano" aria-selected="false">
                        <span>${this.traducoes['system-german-short'] || 'Americano'}</span>
                    </button>
                </div>
                ${gerarPainelPasso3('sac', tabelasPorSistema.sac)}
                ${gerarPainelPasso3('price', tabelasPorSistema.price)}
                ${gerarPainelPasso3('americano', tabelasPorSistema.americano)}
            </div>
        `;

        conteudoDinamico.innerHTML = htmlConteudo;
        this.selecionarSistemaMemorial(this.memorialSistemaSelecionado || sistema || 'price');
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new MutuoApp();
        app.inicializar();
    });
} else {
    const app = new MutuoApp();
    app.inicializar();
}
