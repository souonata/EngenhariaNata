/**
 * mutuo-script-new.js
 * Calculadora de Empréstimos - Versão Modular
 *
 * Sistemas: SAC, Price (Francês) e Americano
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero, formatarMoeda } from '../src/utils/formatters.js';
import { ExplicacaoResultado } from '../src/components/resultado-explicado.js';

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
        this.graficos = { evolucao: null };
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
        this.calcular();
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
        this.calcular();
    }

    configurarEventos() {
        // Info icons
        this.configurarIconesInfo();

        // Pagamentos extras aplicados em parcelas especificas
        this.configurarPagamentosExtrasEspecificos();

        // Botões de incremento/decremento (setas + e -)
        this.configurarBotoesIncremento();

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
            radio.addEventListener('change', () => this.calcular());
        });

        document.querySelectorAll('input[name="periodoExtra"]').forEach(radio => {
            radio.addEventListener('change', () => this.calcular());
        });

        // Botões da tabela
        const btnTabela = document.getElementById('btnTabela');
        if (btnTabela) {
            btnTabela.addEventListener('click', () => this.toggleTabela());
        }

        const btnFecharTabela = document.getElementById('btnFecharTabela');
        if (btnFecharTabela) {
            btnFecharTabela.addEventListener('click', () => this.toggleTabela());
        }

        // Exemplos
        document.querySelectorAll('[data-exemplo]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const exemplo = e.currentTarget.dataset.exemplo;
                this.aplicarExemplo(exemplo);
            });
        });

        // Botão SAIBA MAIS
        const btnExemplos = document.getElementById('btnExemplos');
        if (btnExemplos) {
            btnExemplos.addEventListener('click', () => {
                const memorial = document.getElementById('memorialSection');
                const resultados = document.getElementById('resultados');
                const sistemaAtual = document.querySelector('input[name="sistemaRapido"]:checked')?.value || 'price';
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
            if (this.tabelaAmortizacao.length > 0) {
                this.atualizarGrafico();
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

    configurarBotoesIncremento() {
        document.querySelectorAll('.arrow-btn').forEach(btn => {
            const HOLD_DELAY_MS = 180;
            let animationFrame = null;
            let timeoutSegurar = null;
            let tempoInicio = 0;
            let estaSegurando = false;
            let iniciouAnimacaoContinua = false;
            let direcao = 1;

            const obterChaveOverridePorTarget = (targetId) => {
                const mapa = {
                    sliderValor: 'valor',
                    sliderTaxa: 'taxa',
                    sliderPrazo: 'prazo',
                    sliderExtraPagamento: 'extra'
                };
                return mapa[targetId] || null;
            };

            const normalizarValorPorChave = (chave, valor) => {
                if (chave === 'prazo') return Math.max(1, valor);
                if (chave === 'valor' || chave === 'extra' || chave === 'taxa') return Math.max(0, valor);
                return valor;
            };

            const obterValorEfetivo = (slider, targetId) => {
                const chave = obterChaveOverridePorTarget(targetId);
                if (!chave) return parseFloat(slider.value);

                const override = this.valoresEntradaOverride[chave];
                if (override != null && !Number.isNaN(override)) {
                    return Number(override);
                }

                return parseFloat(slider.value);
            };

            const aplicarValorNoControle = (slider, targetId, valor, casasDecimais = 3) => {
                const chave = obterChaveOverridePorTarget(targetId);
                const valorNormalizado = normalizarValorPorChave(chave, valor);
                const valorArredondado = Number(valorNormalizado.toFixed(Math.max(casasDecimais, 3)));

                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);
                slider.value = Math.max(min, Math.min(max, valorArredondado));

                if (chave) {
                    this.valoresEntradaOverride[chave] = valorArredondado;
                    this.calcular();
                    return;
                }

                slider.dispatchEvent(new Event('input', { bubbles: true }));
            };

            const animar = (timestamp) => {
                if (!estaSegurando) return;

                const targetId = btn.getAttribute('data-target');
                const slider = document.getElementById(targetId);

                if (!slider) return;

                const tempoDecorrido = timestamp - tempoInicio;
                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);
                const range = max - min;
                const chaveOverride = obterChaveOverridePorTarget(targetId);

                const velocidade = range / 3000;
                const distancia = velocidade * tempoDecorrido;

                const valorInicial = parseFloat(btn.dataset.valorInicial);
                let novoValor = valorInicial + (distancia * direcao);

                if (!chaveOverride) {
                    novoValor = Math.max(min, Math.min(max, novoValor));

                    if ((direcao > 0 && novoValor >= max) || (direcao < 0 && novoValor <= min)) {
                        slider.value = novoValor;
                        slider.dispatchEvent(new Event('input', { bubbles: true }));
                        pararIncremento();
                        return;
                    }
                }

                aplicarValorNoControle(slider, targetId, novoValor);

                animationFrame = requestAnimationFrame(animar);
            };

            const iniciarAnimacao = () => {
                if (animationFrame) return;

                const targetId = btn.getAttribute('data-target');
                const slider = document.getElementById(targetId);
                if (!slider) return;

                const stepStr = btn.getAttribute('data-step');
                direcao = parseFloat(stepStr) > 0 ? 1 : -1;

                btn.dataset.valorInicial = String(obterValorEfetivo(slider, targetId));

                tempoInicio = performance.now();
                animationFrame = requestAnimationFrame(animar);
            };

            const aplicarIncrementoUnico = () => {
                const targetId = btn.getAttribute('data-target');
                const slider = document.getElementById(targetId);
                if (!slider) return;

                const passo = parseFloat(btn.getAttribute('data-step') || '0');
                if (!passo) return;

                const valorAtual = obterValorEfetivo(slider, targetId);
                const casasDecimais = (String(Math.abs(passo)).split('.')[1] || '').length;

                let novoValor = valorAtual + passo;

                // Evita erro de ponto flutuante em passos decimais (ex: 0.01).
                aplicarValorNoControle(slider, targetId, novoValor, casasDecimais);
            };

            const pararIncremento = () => {
                estaSegurando = false;
                iniciouAnimacaoContinua = false;

                if (timeoutSegurar) {
                    clearTimeout(timeoutSegurar);
                    timeoutSegurar = null;
                }

                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                    animationFrame = null;
                }

                delete btn.dataset.valorInicial;
            };

            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                estaSegurando = true;
                iniciouAnimacaoContinua = false;

                timeoutSegurar = setTimeout(() => {
                    if (!estaSegurando) return;
                    iniciouAnimacaoContinua = true;
                    iniciarAnimacao();
                }, HOLD_DELAY_MS);
            });

            btn.addEventListener('mouseup', (e) => {
                e.preventDefault();

                const foiToqueRapido = estaSegurando && !iniciouAnimacaoContinua;
                pararIncremento();

                if (foiToqueRapido) {
                    aplicarIncrementoUnico();
                }
            });

            btn.addEventListener('mouseleave', (e) => {
                pararIncremento();
            });

            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                estaSegurando = true;
                iniciouAnimacaoContinua = false;

                timeoutSegurar = setTimeout(() => {
                    if (!estaSegurando) return;
                    iniciouAnimacaoContinua = true;
                    iniciarAnimacao();
                }, HOLD_DELAY_MS);
            });

            btn.addEventListener('touchend', (e) => {
                e.preventDefault();

                const foiToqueRapido = estaSegurando && !iniciouAnimacaoContinua;
                pararIncremento();

                if (foiToqueRapido) {
                    aplicarIncrementoUnico();
                }
            });

            btn.addEventListener('touchcancel', (e) => {
                pararIncremento();
            });
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
                    this.calcular();
                }
                return;
            }

            if (tipo === 'extra') {
                const apenasDigitos = input.value.replace(/\D/g, '');
                const numeroInteiro = parseInt(apenasDigitos, 10);

                if (!isNaN(numeroInteiro)) {
                    this.valoresEntradaOverride.extra = numeroInteiro;
                    slider.value = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), numeroInteiro));
                    this.calcular();
                }
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
                this.calcular();
            }
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
            const ariaRemover = i18n.obterIdiomaAtual() === 'it-IT'
                ? 'Rimuovi pagamento extra specifico'
                : 'Remover pagamento extra específico';

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
        const taxaAtual = parseFloat(sliderTaxa?.value || 10);
        const periodoNovo = document.querySelector('input[name="periodoRapido"]:checked')?.value || 'ano';

        const obterPassoTaxa = (periodo) => {
            if (periodo === 'dia') return 0.0001;
            if (periodo === 'mes') return 0.001;
            return 0.01;
        };

        const atualizarStepBotoesTaxa = (periodo) => {
            const passoTaxa = obterPassoTaxa(periodo);
            document.querySelectorAll('.arrow-btn[data-target="sliderTaxa"]').forEach((btn) => {
                const sinal = btn.classList.contains('arrow-down') ? -1 : 1;
                btn.setAttribute('data-step', String(sinal * passoTaxa));
                btn.setAttribute(
                    'aria-label',
                    sinal < 0
                        ? `Diminuir taxa em ${passoTaxa}%`
                        : `Aumentar taxa em ${passoTaxa}%`
                );
            });
        };

        atualizarStepBotoesTaxa(periodoNovo);

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

            // Garantir que a taxa convertida não exceda o máximo
            taxaConvertida = Math.min(taxaConvertida, parseFloat(sliderTaxa.max));

            // Atualizar slider e input
            sliderTaxa.value = taxaConvertida;
            if (inputTaxa) {
                inputTaxa.value = formatarNumero(taxaConvertida, casasDecimais);
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

        if (periodicidade === 'ano') {
            // Taxa anual -> converter para mensal equivalente
            taxaMensal = Math.pow(1 + taxaInput / 100, 1 / 12) - 1;
        } else if (periodicidade === 'mes') {
            // Taxa já está em mensal
            taxaMensal = taxaInput / 100;
        } else { // dia
            // Taxa diária -> converter para mensal (30 dias)
            taxaMensal = Math.pow(1 + taxaInput / 100, 30) - 1;
        }

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
        try {
            this.atualizarMemorial(dados);
        } catch (error) {
            console.error('[Mutuo] Erro ao atualizar memorial:', error);
        }
    }

    calcularAmortizacao(dados) {
        const { valor, taxaMensal, numParcelas, sistema, extraPagamento, periodicidadeExtra, pagamentosExtrasEspecificos = [] } = dados;
        const tabela = [];

        const mapaExtrasEspecificos = pagamentosExtrasEspecificos.reduce((acc, item) => {
            const parcela = parseInt(item.parcela, 10);
            const valorExtra = parseFloat(item.valor);

            if (!isNaN(parcela) && !isNaN(valorExtra) && valorExtra > 0) {
                acc.set(parcela, (acc.get(parcela) || 0) + valorExtra);
            }

            return acc;
        }, new Map());

        const deveAplicarExtra = (numeroParcela) => {
            if (!extraPagamento || extraPagamento <= 0) return false;
            if (periodicidadeExtra === 'semestral') return numeroParcela % 6 === 0;
            if (periodicidadeExtra === 'anual') return numeroParcela % 12 === 0;
            return false;
        };

        if (sistema === 'sac') {
            // SAC: Amortização constante
            const amortizacaoFixa = valor / numParcelas;
            let saldo = valor;

            for (let i = 1; i <= numParcelas; i++) {
                if (saldo <= 0) break;

                const juros = saldo * taxaMensal;
                const amortizacao = Math.min(amortizacaoFixa, saldo);
                const parcelaBase = amortizacao + juros;
                const saldoAposBase = saldo - amortizacao;
                const extraRecorrente = deveAplicarExtra(i) ? extraPagamento : 0;
                const extraEspecifico = mapaExtrasEspecificos.get(i) || 0;
                const extraSolicitado = extraRecorrente + extraEspecifico;
                const extraAplicado = Math.min(extraSolicitado, saldoAposBase);
                const parcela = parcelaBase + extraAplicado;
                saldo = saldoAposBase - extraAplicado;

                tabela.push({
                    numero: i,
                    parcela: parcela,
                    amortizacao: amortizacao,
                    juros: juros,
                    extraPagamento: extraAplicado,
                    saldo: Math.max(0, saldo)
                });
            }
        } else if (sistema === 'price') {
            // Price: Parcela fixa (PMT)
            const pmt = valor * (taxaMensal * Math.pow(1 + taxaMensal, numParcelas)) /
                        (Math.pow(1 + taxaMensal, numParcelas) - 1);
            let saldo = valor;

            for (let i = 1; i <= numParcelas; i++) {
                if (saldo <= 0) break;

                const juros = saldo * taxaMensal;
                const amortizacaoBase = Math.max(0, pmt - juros);
                const amortizacao = Math.min(amortizacaoBase, saldo);
                const parcelaBase = amortizacao + juros;
                const saldoAposBase = saldo - amortizacao;
                const extraRecorrente = deveAplicarExtra(i) ? extraPagamento : 0;
                const extraEspecifico = mapaExtrasEspecificos.get(i) || 0;
                const extraSolicitado = extraRecorrente + extraEspecifico;
                const extraAplicado = Math.min(extraSolicitado, saldoAposBase);
                const parcela = parcelaBase + extraAplicado;
                saldo = saldoAposBase - extraAplicado;

                tabela.push({
                    numero: i,
                    parcela: parcela,
                    amortizacao: amortizacao,
                    juros: juros,
                    extraPagamento: extraAplicado,
                    saldo: Math.max(0, saldo)
                });
            }
        } else if (sistema === 'americano') {
            // Americano: Só juros, principal no final
            let saldo = valor;

            for (let i = 1; i <= numParcelas; i++) {
                if (saldo <= 0) break;

                const juros = saldo * taxaMensal;
                const amortizacao = i === numParcelas ? saldo : 0;
                const parcelaBase = amortizacao + juros;
                const saldoAposBase = saldo - amortizacao;
                const extraRecorrente = (i < numParcelas && deveAplicarExtra(i)) ? extraPagamento : 0;
                const extraEspecifico = (i < numParcelas) ? (mapaExtrasEspecificos.get(i) || 0) : 0;
                const extraSolicitado = extraRecorrente + extraEspecifico;
                const extraAplicado = Math.min(extraSolicitado, saldoAposBase);
                const parcela = parcelaBase + extraAplicado;
                saldo = saldoAposBase - extraAplicado;

                tabela.push({
                    numero: i,
                    parcela: parcela,
                    amortizacao: amortizacao,
                    juros: juros,
                    extraPagamento: extraAplicado,
                    saldo: Math.max(0, saldo)
                });
            }
        }

        return tabela;
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

    renderizarExplicacao({ dados, totalPago, jurosTotais, percJuros, mesesQuitacao }) {
        const pt = i18n.obterIdiomaAtual() === 'pt-BR';
        const anos = Math.floor(mesesQuitacao / 12);
        const meses = mesesQuitacao % 12;
        const sistemaLabel = {
            sac: pt ? 'SAC' : 'SAC',
            price: pt ? 'Price (Frances)' : 'Price (Francese)',
            americano: pt ? 'Americano' : 'Americano'
        }[dados.sistema] || dados.sistema;

        const totalPagoStr = this.formatarMoedaLocal(totalPago);
        const jurosTotaisStr = this.formatarMoedaLocal(jurosTotais);
        const valorStr = this.formatarMoedaLocal(dados.valor);
        const primeiraParcela = this.tabelaAmortizacao[0]?.parcela || 0;
        const ultimaParcela = this.tabelaAmortizacao[this.tabelaAmortizacao.length - 1]?.parcela || 0;
        const tempoStr = anos > 0
            ? (pt ? `${anos} ano(s) e ${meses} mes(es)` : `${anos} anno/i e ${meses} mese/i`)
            : (pt ? `${meses} meses` : `${meses} mesi`);

        this.explicacao.renderizar({
            destaque: pt
                ? `Para ${valorStr} emprestado no sistema ${sistemaLabel}, voce pagara ${jurosTotaisStr} de juros (${formatarNumero(percJuros, 1)}% a mais).`
                : `Per ${valorStr} preso in prestito con il sistema ${sistemaLabel}, pagherai ${jurosTotaisStr} di interessi (${formatarNumero(percJuros, 1)}% in piu).`,
            linhas: [
                {
                    icone: '💸',
                    titulo: pt ? 'Total em Juros' : 'Totale Interessi',
                    valor: `${jurosTotaisStr} (${formatarNumero(percJuros, 1)}%)`,
                    descricao: pt
                        ? `Quanto a mais voce paga alem dos ${valorStr} emprestados.`
                        : `Quanto paghi in piu rispetto ai ${valorStr} presi in prestito.`
                },
                {
                    icone: '📅',
                    titulo: pt ? 'Prazo de Quitacao' : 'Durata del Prestito',
                    valor: tempoStr,
                    descricao: pt ? `${mesesQuitacao} parcelas mensais.` : `${mesesQuitacao} rate mensili.`
                },
                {
                    icone: '💳',
                    titulo: pt ? '1a Parcela' : '1a Rata',
                    valor: this.formatarMoedaLocal(primeiraParcela),
                    descricao: pt
                        ? (dados.sistema === 'sac'
                            ? `No SAC a parcela cai com o tempo. Ultima: ${this.formatarMoedaLocal(ultimaParcela)}.`
                            : 'No Price as parcelas sao fixas.')
                        : (dados.sistema === 'sac'
                            ? `Nel SAC la rata diminuisce nel tempo. Ultima: ${this.formatarMoedaLocal(ultimaParcela)}.`
                            : 'Nel Price le rate sono fisse.')
                },
                {
                    icone: '🏁',
                    titulo: pt ? 'Total Pago' : 'Totale Pagato',
                    valor: totalPagoStr,
                    descricao: pt
                        ? `Soma de capital (${valorStr}) + juros (${jurosTotaisStr}).`
                        : `Somma di capitale (${valorStr}) + interessi (${jurosTotaisStr}).`
                }
            ],
            dica: pt
                ? 'Pagamentos extras reduzem juros totais e o tempo de quitacao.'
                : 'Pagamenti extra riducono interessi totali e tempo di estinzione.'
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
            const pt = i18n.obterIdiomaAtual() === 'pt-BR';
            const paraLabel = pt ? 'Para' : 'Per';
            const porLabel = pt ? 'por' : 'per';
            const mesesLabel = pt ? 'meses' : 'mesi';
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
                <div class="memorial-system-switcher" role="tablist" aria-label="Sistema para formulas">
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
    aplicarExemplo(tipo) {
        const exemplos = {
            'casa-popular': { valor: 150000, taxa: 9, prazo: 20, periodicidade: 'anual', sistema: 'sac' },
            'apartamento': { valor: 300000, taxa: 10, prazo: 30, periodicidade: 'anual', sistema: 'sac' },
            'carro-novo': { valor: 60000, taxa: 18, prazo: 5, periodicidade: 'anual', sistema: 'price' },
            'carro-usado': { valor: 30000, taxa: 24, prazo: 4, periodicidade: 'anual', sistema: 'price' },
            'moto': { valor: 15000, taxa: 20, prazo: 3, periodicidade: 'anual', sistema: 'price' },
            'pessoal': { valor: 5000, taxa: 3, prazo: 2, periodicidade: 'mensal', sistema: 'price' }
        };

        const exemplo = exemplos[tipo];
        if (!exemplo) return;

        // Aplicar valores
        const sliderValor = document.getElementById('sliderValor');
        const sliderTaxa = document.getElementById('sliderTaxa');
        const sliderPrazo = document.getElementById('sliderPrazo');

        if (sliderValor) sliderValor.value = exemplo.valor;
        if (sliderTaxa) sliderTaxa.value = exemplo.taxa;
        if (sliderPrazo) sliderPrazo.value = exemplo.prazo;

        // Selecionar periodicidade
        const radioPeriodicidade = document.querySelector(`input[name="periodicidade"][value="${exemplo.periodicidade}"]`);
        if (radioPeriodicidade) radioPeriodicidade.checked = true;

        // Selecionar sistema
        const radioSistema = document.querySelector(`input[name="sistema"][value="${exemplo.sistema}"]`);
        if (radioSistema) radioSistema.checked = true;

        this.calcular();
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

