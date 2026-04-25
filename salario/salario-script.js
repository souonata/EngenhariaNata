/**
 * Papel no projeto:
 * - Calculadora salarial bilíngue com regras de Brasil e Itália.
 * - Consolida descontos, benefícios, custo empresa e cenários de rescisão.
 *
 * Pontos seguros para IA editar:
 * - tabelas tributárias/previdenciárias;
 * - lógica específica de país;
 * - memorial textual e composição dos cards/ gráficos.
 *
 * Cuidados antes de mexer:
 * - este arquivo mistura legislação, conversão temporal e UX em uma única fonte;
 * - qualquer atualização fiscal precisa manter datas e hipóteses explícitas no comentário e na UI.
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero, formatarMoeda } from '../src/utils/formatters.js';
import { ExplicacaoResultado } from '../src/components/resultado-explicado.js';
import {
    INSS_BR_TETO,
    calcularBR,
    calcularIT
} from './salario-calc.js';

// ============================================
// MAPEAMENTO SLIDER → INPUT
// ============================================
const SLIDER_TO_INPUT = {
    sliderBruto:       'inputBruto',
    sliderDependentes: 'inputDependentes',
    sliderPlano:       'inputPlano',
    sliderOutros:      'inputOutros',
    sliderMeses:       'inputMeses',
    sliderComunale:    'inputComunale'
};

const CONFIG_BRUTO_POR_MODO = {
    br: { min: 1000, max: 50000, step: 100, valorPadrao: 5000 },
    it: { min: 12000, max: 250000, step: 500, valorPadrao: 35000 }
};

// ============================================
// CLASSE PRINCIPAL
// ============================================

class SalarioApp extends App {
    constructor() {
        super({
            appName: 'salario',
            callbacks: {
                aoInicializar:   () => this.inicializarSalario(),
                aoTrocarIdioma:  () => this.aposTrocarIdioma()
            }
        });
        this.explicacao = new ExplicacaoResultado('v2-explicacao', i18n);
        this.graficoDonut = null;
        this.graficoBarras = null;
        this.ultimoModoPaisAplicado = null;
    }

    get traducoes() {
        const idioma = i18n.obterIdiomaAtual();
        return this.config.traducoes[idioma] || this.config.traducoes['pt-BR'] || {};
    }

    get modoPais() {
        return i18n.obterIdiomaAtual() === 'it-IT' ? 'it' : 'br';
    }

    inicializarSalario() {
        this.aplicarModoPais();
        this.configurarEventos();
        document.addEventListener('engnata:themechange', () => {
            this.atualizarResultado();
        });
        this.atualizarResultado();
    }

    aposTrocarIdioma() {
        this.aplicarModoPais();
        this.atualizarResultado();
    }

    aplicarModoPais() {
        const body = document.body;
        body.classList.toggle('lang-br', this.modoPais === 'br');
        body.classList.toggle('lang-it', this.modoPais === 'it');
        // Atualiza unidades monetárias
        const moeda = i18n.obterMoeda() === 'EUR' ? '€' : 'R$';
        document.querySelectorAll('.moeda-unit, #unidadeMoeda').forEach(el => {
            el.textContent = moeda;
        });
        this.configurarEntradaBrutoPorPais();
    }

    // ============================================
    // EVENTOS
    // ============================================

    configurarEventos() {
        this.configurarIconesInfo();
        this.configurarBotoesIncremento();
        this.configurarSlidersEInputs();

        document.querySelectorAll('input[name="vt"], input[name="tredicesima"], input[name="quattordicesima"], input[name="tfrDestino"]')
            .forEach(r => r.addEventListener('change', () => this.atualizarResultado()));

        const selectRegione = document.getElementById('selectRegione');
        if (selectRegione) selectRegione.addEventListener('change', () => this.atualizarResultado());

        // Memorial
        document.getElementById('btnAbrirMemorial')?.addEventListener('click', () => this.abrirMemorial());
        document.getElementById('btnFecharMemorial')?.addEventListener('click', () => this.fecharMemorial());
        document.getElementById('btnVoltarMemorial2')?.addEventListener('click', () => this.fecharMemorial());
    }

    configurarIconesInfo() {
        document.querySelectorAll('.info-icon[data-info-target]').forEach((icon) => {
            const desc = document.getElementById(icon.getAttribute('data-info-target'));
            if (!icon || !desc) return;
            const toggle = () => {
                desc.style.display = desc.style.display === 'none' ? 'block' : 'none';
            };
            icon.addEventListener('click', toggle);
            icon.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
            });
        });
    }

    configurarEntradaBrutoPorPais() {
        const slider = document.getElementById('sliderBruto');
        const input = document.getElementById('inputBruto');
        const config = CONFIG_BRUTO_POR_MODO[this.modoPais];
        if (!slider || !input || !config) return;

        const valorAtual = parseFloat(String(input.value).replace(',', '.'));
        const configAnterior = this.ultimoModoPaisAplicado
            ? CONFIG_BRUTO_POR_MODO[this.ultimoModoPaisAplicado]
            : null;

        slider.min = String(config.min);
        slider.max = String(config.max);
        slider.step = String(config.step);

        let valorFinal = Number.isFinite(valorAtual) ? valorAtual : config.valorPadrao;
        if (!this.ultimoModoPaisAplicado && this.modoPais === 'it' && valorFinal <= CONFIG_BRUTO_POR_MODO.br.valorPadrao) {
            valorFinal = config.valorPadrao;
        }
        if (this.ultimoModoPaisAplicado && this.ultimoModoPaisAplicado !== this.modoPais) {
            const usavaValorPadraoAnterior = configAnterior
                ? Math.abs(valorFinal - configAnterior.valorPadrao) < 0.0001
                : false;
            if (usavaValorPadraoAnterior || valorFinal < config.min) {
                valorFinal = config.valorPadrao;
            }
        }

        valorFinal = Math.min(config.max, Math.max(config.min, valorFinal));
        slider.value = String(valorFinal);
        input.value = parseFloat(slider.value).toFixed(this.decimaisPorSlider(slider));
        this.ultimoModoPaisAplicado = this.modoPais;
    }

    configurarBotoesIncremento() {
        document.querySelectorAll('.arrow-btn').forEach(btn => {
            const HOLD_DELAY_MS = 180;
            let animationFrame = null;
            let timeoutSegurar = null;
            let tempoInicio = 0;
            let estaSegurando = false;
            let iniciouAnimacaoContinua = false;
            let direcao = 1;

            const animar = (timestamp) => {
                if (!estaSegurando) return;
                const sliderId = btn.getAttribute('data-target');
                const slider   = document.getElementById(sliderId);
                const inputId  = SLIDER_TO_INPUT[sliderId];
                const inputEl  = inputId ? document.getElementById(inputId) : null;
                if (!slider) return;

                const tempoDecorrido = timestamp - tempoInicio;
                const sliderMin  = parseFloat(slider.min);
                const sliderMax  = parseFloat(slider.max);
                const velocidade = (sliderMax - sliderMin) / 3000;
                const valorInicial = parseFloat(btn.dataset.valorInicial);
                let novoValor = valorInicial + velocidade * tempoDecorrido * direcao;
                novoValor = Math.max(sliderMin * 0.5, novoValor);

                slider.value = novoValor;
                if (inputEl) {
                    inputEl.value = parseFloat(slider.value).toFixed(this.decimaisPorSlider(slider));
                }
                this.atualizarResultado();
                animationFrame = requestAnimationFrame(animar);
            };

            const iniciarAnimacao = () => {
                if (animationFrame) return;
                const sliderId = btn.getAttribute('data-target');
                const slider   = document.getElementById(sliderId);
                if (!slider) return;
                direcao = parseFloat(btn.getAttribute('data-step')) > 0 ? 1 : -1;
                btn.dataset.valorInicial = parseFloat(slider.value);
                tempoInicio = performance.now();
                animationFrame = requestAnimationFrame(animar);
            };

            const aplicarIncrementoUnico = () => {
                const sliderId = btn.getAttribute('data-target');
                const slider   = document.getElementById(sliderId);
                const inputId  = SLIDER_TO_INPUT[sliderId];
                const inputEl  = inputId ? document.getElementById(inputId) : null;
                if (!slider) return;
                const passo = parseFloat(btn.getAttribute('data-step') || '0');
                if (!passo) return;

                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);
                const casasDecimais = (String(Math.abs(passo)).split('.')[1] || '').length;
                let novoValor = parseFloat(slider.value) + passo;
                novoValor = Math.max(min, Math.min(max, novoValor));
                novoValor = Number(novoValor.toFixed(Math.max(casasDecimais, 3)));

                slider.value = novoValor;
                if (inputEl) {
                    inputEl.value = parseFloat(slider.value).toFixed(this.decimaisPorSlider(slider));
                }
                this.atualizarResultado();
            };

            const parar = () => {
                estaSegurando = false;
                iniciouAnimacaoContinua = false;
                if (timeoutSegurar) { clearTimeout(timeoutSegurar); timeoutSegurar = null; }
                if (animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = null; }
            };

            const aoPressionar = (e) => {
                e.preventDefault();
                estaSegurando = true;
                iniciouAnimacaoContinua = false;
                timeoutSegurar = setTimeout(() => {
                    if (!estaSegurando) return;
                    iniciouAnimacaoContinua = true;
                    iniciarAnimacao();
                }, HOLD_DELAY_MS);
            };

            const aoSoltar = (e) => {
                if (e) e.preventDefault();
                const foiToqueRapido = estaSegurando && !iniciouAnimacaoContinua;
                parar();
                if (foiToqueRapido) aplicarIncrementoUnico();
            };

            btn.addEventListener('mousedown',   aoPressionar);
            btn.addEventListener('touchstart',  aoPressionar, { passive: false });
            btn.addEventListener('mouseup',     aoSoltar);
            btn.addEventListener('mouseleave',  parar);
            btn.addEventListener('touchend',    aoSoltar);
            btn.addEventListener('touchcancel', parar);
        });
    }

    configurarSlidersEInputs() {
        Object.entries(SLIDER_TO_INPUT).forEach(([sliderId, inputId]) => {
            const slider = document.getElementById(sliderId);
            const input  = document.getElementById(inputId);
            if (!slider || !input) return;

            slider.addEventListener('input', () => {
                input.value = parseFloat(slider.value).toFixed(this.decimaisPorSlider(slider));
                this.atualizarResultado();
            });
            input.addEventListener('change', () => {
                const val = parseFloat(String(input.value).replace(',', '.'));
                if (!isNaN(val)) {
                    slider.value = val;
                    input.value = parseFloat(slider.value).toFixed(this.decimaisPorSlider(slider));
                }
                this.atualizarResultado();
            });
        });
    }

    decimaisPorSlider(slider) {
        const step = parseFloat(slider.step) || 1;
        return step < 1 ? (String(step).split('.')[1]?.length || 1) : 0;
    }

    // ============================================
    // LEITURA DE ENTRADAS
    // ============================================

    obterValores() {
        return {
            bruto:         parseFloat(document.getElementById('inputBruto').value) || 0,
            dependentes:   parseInt(document.getElementById('inputDependentes').value) || 0,
            plano:         parseFloat(document.getElementById('inputPlano').value) || 0,
            outros:        parseFloat(document.getElementById('inputOutros').value) || 0,
            meses:         parseInt(document.getElementById('inputMeses').value) || 1,
            vt:            document.querySelector('input[name="vt"]:checked')?.value || 'nao',
            regione:       document.getElementById('selectRegione')?.value || 'veneto',
            comunale:      parseFloat(String(document.getElementById('inputComunale')?.value || '0').replace(',', '.')) || 0,
            tredicesima:   document.querySelector('input[name="tredicesima"]:checked')?.value || 'sim',
            quattordicesima: document.querySelector('input[name="quattordicesima"]:checked')?.value || 'nao',
            tfrDestino:    document.querySelector('input[name="tfrDestino"]:checked')?.value || 'azienda'
        };
    }

    // ============================================
    // RENDER
    // ============================================

    atualizarResultado() {
        const v = this.obterValores();
        const res = this.modoPais === 'it' ? calcularIT(v) : calcularBR(v);
        this.atualizarDOM(res);
        this.explicacao.renderizar(this.gerarExplicacao(res));
        this.atualizarGraficos(res);
    }

    fMoeda(v) {
        return formatarMoeda(v, i18n.obterMoeda());
    }

    atualizarDOM(r) {
        document.getElementById('resultadoLiquido').textContent = this.fMoeda(r.liquido);
        document.getElementById('resultadoInss').textContent    = this.fMoeda(r.inss);
        document.getElementById('resultadoIrrf').textContent    = this.fMoeda(r.irrf);

        if (r.pais === 'br') {
            document.getElementById('resultadoVt').textContent       = this.fMoeda(r.vt);
            document.getElementById('resultadoPlano').textContent    = this.fMoeda(r.plano);
            document.getElementById('resultadoFeriasBr').textContent = this.fMoeda(r.feriasLiquido);
        } else {
            document.getElementById('resultadoAddRegional').textContent = this.fMoeda(r.vt);
            document.getElementById('resultadoAddComunal').textContent  = this.fMoeda(r.plano);
            document.getElementById('resultadoFerias').textContent      = this.fMoeda(r.feriasLiquido);
        }

        document.getElementById('resultadoOutros').textContent         = this.fMoeda(r.outros);
        document.getElementById('resultadoTotalDescontos').textContent = this.fMoeda(r.totalDescontos);
        document.getElementById('resultadoAliqEfetiva').textContent    = formatarNumero(r.aliqEfetiva, 1) + '%';

        document.getElementById('resultadoDecimoTerceiro').textContent = this.fMoeda(r.decimoLiquido);
        document.getElementById('resultadoFgtsMensal').textContent     = this.fMoeda(r.fgtsMensal);
        document.getElementById('resultadoFgtsAcumulado').textContent  = this.fMoeda(r.fgtsAcumulado);
        document.getElementById('resultadoRendaAnual').textContent     = this.fMoeda(r.rendaAnual);
        document.getElementById('resultadoRescisao').textContent       = this.fMoeda(r.rescisao);
        document.getElementById('resultadoCustoEmpresa').textContent   = this.fMoeda(r.custoEmpresa);
    }

    gerarExplicacao(r) {
        const isIt = r.pais === 'it';
        const bruto = r.bruto;
        const liq = r.liquido;
        const pct = bruto > 0 ? (liq / bruto) * 100 : 0;

        const linhas = isIt ? [
            {
                icone: '💶',
                titulo: 'RAL → Netto',
                valor: `${this.fMoeda(bruto)} → ${this.fMoeda(liq)}`,
                descricao: `Da ogni €100 lordi, ti restano €${pct.toFixed(1)} in tasca. Aliquota effettiva: ${r.aliqEfetiva.toFixed(1)}%.`
            },
            {
                icone: '🏛️',
                titulo: 'INPS (9,19%)',
                valor: this.fMoeda(r.inss),
                descricao: `Contributo previdenziale obbligatorio. Va a costruire la tua pensione futura.`
            },
            {
                icone: '📊',
                titulo: 'IRPEF + Addizionali',
                valor: this.fMoeda(r.irrf + r.vt + r.plano),
                descricao: `IRPEF a 3 scaglioni (23%/33%/43% — riforma 2026) meno detrazioni (€${Math.round(r.detrazioni)}/anno). Addizionali regionale e comunale applicate separatamente.`
            },
            {
                icone: '🎁',
                titulo: 'Tredicesima + TFR',
                valor: this.fMoeda(r.decimoLiquido + r.fgtsMensal * 12),
                descricao: `13ª mensilità (dicembre) + TFR 6,91% RAL accantonato ${r.tfrDestino === 'fondo' ? 'nel fondo pensione' : 'in azienda'}.`
            }
        ] : [
            {
                icone: '💰',
                titulo: 'Bruto → Líquido',
                valor: `${this.fMoeda(bruto)} → ${this.fMoeda(liq)}`,
                descricao: `De cada R$ 100 brutos, sobram R$ ${pct.toFixed(1)} no bolso. Alíquota efetiva: ${r.aliqEfetiva.toFixed(1)}%.`
            },
            {
                icone: '🏛️',
                titulo: 'INSS (progressivo)',
                valor: this.fMoeda(r.inss),
                descricao: `Contribuição previdenciária por faixas: 7,5% / 9% / 12% / 14%. Teto 2026: R$ ${formatarNumero(INSS_BR_TETO, 2)} (contribuição máx. ≈ R$ 988,09).`
            },
            {
                icone: '📊',
                titulo: 'IRRF',
                valor: this.fMoeda(r.irrf),
                descricao: `Base = bruto − INSS − dependentes (R$ 189,59 cada). Desconto simplificado (R$ 607,20) aplicado automaticamente se mais vantajoso.`
            },
            {
                icone: '🏦',
                titulo: 'FGTS',
                valor: `${this.fMoeda(r.fgtsMensal)}/mês`,
                descricao: `8% do bruto depositado pela empresa em conta vinculada. Acumulado em ${r.meses} meses: ${this.fMoeda(r.fgtsAcumulado)}.`
            },
            {
                icone: '🎁',
                titulo: '13º + Férias',
                valor: this.fMoeda(r.decimoLiquido + r.feriasLiquido),
                descricao: `13º proporcional aos ${((r.meses - 1) % 12) + 1} mês(es) do ciclo. Férias + 1/3 ${r.meses >= 12 ? 'disponíveis' : '(disponível após 12 meses)'}.`
            }
        ];

        return {
            linhas,
            destaque: isIt
                ? `Netto mensile ordinario: ${this.fMoeda(liq)} (${pct.toFixed(1)}% del lordo mensile, RAL ${this.fMoeda(r.ral)}/anno)`
                : `Líquido mensal: ${this.fMoeda(liq)} (${pct.toFixed(1)}% do bruto)`,
            dica: isIt
                ? 'Conferire il TFR a un fondo pensione può offrire rendimenti migliori (tipicamente 3-6% vs 1,5% fisso in azienda) e vantaggi fiscali al riscatto (aliquota fino 15% invece di 23%).'
                : 'Para simular rescisão, ajuste "Meses na Empresa". Direitos acumulam: 13º proporcional, férias + 1/3 após 12 meses, e multa de 40% sobre FGTS em demissão sem justa causa.',
            norma: isIt
                ? 'Riforma IRPEF 2026 (23/33/43%) • TUIR art. 13 • INPS Circolare 6/2026'
                : 'INSS 2026 (reajuste 3,9%) • IRRF (tabela tradicional) • CLT'
        };
    }

    // ============================================
    // GRÁFICOS
    // ============================================

    get coresGrafico() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        return {
            liquido:  isDark ? '#4DD0E1' : '#00ACC1',
            inss:     '#EF5350',
            irrf:     '#FFA726',
            add1:     '#AB47BC',
            add2:     '#7E57C2',
            plano:    '#66BB6A',
            outros:   '#78909C',
            decimo:   isDark ? '#81C784' : '#43A047',
            ferias:   isDark ? '#FFD54F' : '#F9A825',
            fgts:     isDark ? '#64B5F6' : '#1E88E5',
            texto:    isDark ? '#E8EAED' : '#333'
        };
    }

    atualizarGraficos(r) {
        this.atualizarDonut(r);
        this.atualizarBarras(r);
    }

    atualizarDonut(r) {
        const canvas = document.getElementById('graficoDonut');
        if (!canvas || !window.Chart) return;

        const t = this.traducoes;
        const cores = this.coresGrafico;
        const isIt = r.pais === 'it';

        const labels = isIt
            ? ['Netto', 'INPS', 'IRPEF', 'Add. Regionale', 'Add. Comunale', 'Altre']
            : ['Líquido', 'INSS', 'IRRF', 'VT', 'Plano', 'Outros'];
        const data = [
            Math.max(0, r.liquido),
            r.inss, r.irrf, r.vt, r.plano, r.outros
        ];
        const bg = [cores.liquido, cores.inss, cores.irrf, cores.add1, cores.add2, cores.outros];

        if (this.graficoDonut) this.graficoDonut.destroy();
        this.graficoDonut = new Chart(canvas, {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: bg, borderWidth: 2, borderColor: 'transparent' }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: cores.texto, font: { size: 11 }, padding: 8, boxWidth: 12 }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.parsed;
                                const total = data.reduce((a,b) => a+b, 0);
                                const pct = total > 0 ? (val / total * 100).toFixed(1) : 0;
                                return `${ctx.label}: ${this.fMoeda(val)} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    atualizarBarras(r) {
        const canvas = document.getElementById('graficoBarras');
        if (!canvas || !window.Chart) return;

        const cores = this.coresGrafico;
        const isIt = r.pais === 'it';

        const labels = isIt
            ? ['12 × Netto', '13ª', '14ª', 'TFR annuo']
            : ['12 × Líquido', '13º', 'Férias + 1/3', 'FGTS anual'];
        const data = [
            r.liquido * 12,
            r.decimoLiquido,
            r.feriasLiquido,
            r.fgtsMensal * 12
        ];
        const bg = [cores.liquido, cores.decimo, cores.ferias, cores.fgts];

        if (this.graficoBarras) this.graficoBarras.destroy();
        this.graficoBarras = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{ data, backgroundColor: bg, borderRadius: 6 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => this.fMoeda(ctx.parsed.x)
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: cores.texto,
                            callback: (v) => this.fMoeda(v).replace(/,\d{2}$/, '')
                        },
                        grid: { color: 'rgba(128,128,128,0.15)' }
                    },
                    y: {
                        ticks: { color: cores.texto, font: { size: 11 } },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // ============================================
    // MEMORIAL — Conteúdo dinâmico com referências
    // ============================================

    abrirMemorial() {
        const section = document.getElementById('memorialSection');
        const inputs = document.getElementById('inputsSection');
        const results = document.getElementById('resultadosSection');
        const v2 = document.getElementById('v2-explicacao');

        this.renderizarMemorial();
        section.style.display = 'block';
        if (inputs) inputs.style.display = 'none';
        if (results) results.style.display = 'none';
        if (v2) v2.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    fecharMemorial() {
        document.getElementById('memorialSection').style.display = 'none';
        const inputs = document.getElementById('inputsSection');
        const results = document.getElementById('resultadosSection');
        const v2 = document.getElementById('v2-explicacao');
        if (inputs) inputs.style.display = '';
        if (results) results.style.display = '';
        if (v2) v2.style.display = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    renderizarMemorial() {
        const t = this.traducoes;
        const m = t.memorial || {};
        const isIt = this.modoPais === 'it';

        const tabelaInss = isIt
            ? `<table class="mem-tabela">
                 <thead><tr><th>Categoria</th><th>Aliquota</th></tr></thead>
                 <tbody>
                   <tr><td>Lavoratore dipendente</td><td>9,19%</td></tr>
                   <tr><td>Oltre soglia (€56.224/anno)</td><td>+1%</td></tr>
                   <tr><td>Datore di lavoro</td><td>~30%</td></tr>
                 </tbody>
               </table>`
            : `<table class="mem-tabela">
                 <thead><tr><th>Faixa (R$)</th><th>Alíquota</th></tr></thead>
                 <tbody>
                   <tr><td>até 1.621,00</td><td>7,5%</td></tr>
                   <tr><td>1.621,01 – 2.902,84</td><td>9%</td></tr>
                   <tr><td>2.902,85 – 4.354,27</td><td>12%</td></tr>
                   <tr><td>4.354,28 – 8.475,55</td><td>14%</td></tr>
                 </tbody>
               </table>`;

        const tabelaIrrf = isIt
            ? `<table class="mem-tabela">
                 <thead><tr><th>Scaglione (€)</th><th>Aliquota</th></tr></thead>
                 <tbody>
                   <tr><td>fino a 28.000</td><td>23%</td></tr>
                   <tr><td>28.001 – 50.000</td><td>33%</td></tr>
                   <tr><td>oltre 50.000</td><td>43%</td></tr>
                 </tbody>
               </table>`
            : `<table class="mem-tabela">
                 <thead><tr><th>Base (R$)</th><th>Alíquota</th><th>Dedução</th></tr></thead>
                 <tbody>
                   <tr><td>até 2.259,20</td><td>isento</td><td>—</td></tr>
                   <tr><td>2.259,21 – 2.826,65</td><td>7,5%</td><td>169,44</td></tr>
                   <tr><td>2.826,66 – 3.751,05</td><td>15%</td><td>381,44</td></tr>
                   <tr><td>3.751,06 – 4.664,68</td><td>22,5%</td><td>662,77</td></tr>
                   <tr><td>acima de 4.664,68</td><td>27,5%</td><td>896,00</td></tr>
                 </tbody>
               </table>`;

        const refs = (m.referencias || []).map(r =>
            `<li><a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.texto}</a></li>`
        ).join('');

        const secoes = [
            { titulo: m.introTitulo,    texto: m.introTexto },
            { titulo: m.inssTitulo,     texto: m.inssTexto,    extra: `<p><strong>${m.inssTabela || ''}</strong></p>${tabelaInss}` },
            { titulo: m.irrfTitulo,     texto: m.irrfTexto,    extra: `<p><strong>${m.irrfTabela || ''}</strong></p>${tabelaIrrf}` },
            { titulo: m.fgtsTitulo,     texto: m.fgtsTexto },
            { titulo: m.feriasTitulo,   texto: m.feriasTexto },
            { titulo: m.decimoTitulo,   texto: m.decimoTexto },
            { titulo: m.rescisaoTitulo, texto: m.rescisaoTexto },
            { titulo: m.custoTitulo,    texto: m.custoTexto }
        ];

        const html = secoes
            .filter(s => s.titulo)
            .map(s => `
                <div class="mem-secao">
                    <h3>${s.titulo}</h3>
                    <p>${s.texto || ''}</p>
                    ${s.extra || ''}
                </div>
            `).join('');

        const refHtml = refs ? `
            <div class="mem-secao">
                <h3>${m.referenciasTitulo || '📖 Referências'}</h3>
                <ul class="mem-referencias">${refs}</ul>
            </div>
        ` : '';

        document.getElementById('memorialConteudo').innerHTML = html + refHtml;
        document.getElementById('memorialTitulo').textContent = m.titulo || '';
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new SalarioApp();
        app.inicializar();
    });
} else {
    const app = new SalarioApp();
    app.inicializar();
}
