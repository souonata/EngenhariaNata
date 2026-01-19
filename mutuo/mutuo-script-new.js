/**
 * mutuo-script-new.js
 * Calculadora de Empréstimos - Versão Modular
 * 
 * Sistemas: SAC, Price (Francês) e Americano
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero, formatarMoeda } from '../src/utils/formatters.js';
import { configurarInputComSlider, obterValorReal, limparValorReal } from '../src/utils/input-handlers.js';

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
    }

    inicializarMutuo() {
        this.configurarEventos();
        this.calcular();
    }

    atualizarAposTrocaIdioma() {
        this.calcular();
    }

    configurarEventos() {
        // Info icons
        this.configurarIconesInfo();

        // Botões de incremento/decremento (setas + e -)
        this.configurarBotoesIncremento();

        // Inputs de texto (valor, taxa, prazo)
        this.configurarInputsTexto();

        // Sliders
        ['sliderValor', 'sliderTaxa', 'sliderPrazo', 'sliderParcelas'].forEach(id => {
            const slider = document.getElementById(id);
            if (slider) {
                slider.addEventListener('input', () => {
                    if (id === 'sliderParcelas') {
                        this.ultimaParcelaSelecionada = parseInt(slider.value);
                        this.atualizarParcelaExibida();
                    } else {
                        // Limpar valorReal do input correspondente ao usar o slider
                        const inputId = id.replace('slider', 'input');
                        const input = document.getElementById(inputId);
                        limparValorReal(input);
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

        // Botão SAIBA MAIS (abre memorial)
        const btnExemplos = document.getElementById('btnExemplos');
        if (btnExemplos) {
            btnExemplos.addEventListener('click', () => {
                this.atualizarMemorial();
                const memorial = document.getElementById('memorialSection');
                if (memorial) {
                    memorial.style.display = 'block';
                    memorial.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }

        // Botão Fechar Memorial (topo)
        const btnFecharMemorial = document.getElementById('btnFecharMemorial');
        if (btnFecharMemorial) {
            btnFecharMemorial.addEventListener('click', () => {
                const memorial = document.getElementById('memorialSection');
                if (memorial) {
                    memorial.style.display = 'none';
                }
            });
        }

        // Botão Voltar Memorial (rodapé)
        const btnVoltarMemorial = document.querySelector('.btn-voltar-memorial');
        if (btnVoltarMemorial) {
            btnVoltarMemorial.addEventListener('click', () => {
                const memorial = document.getElementById('memorialSection');
                if (memorial) {
                    memorial.style.display = 'none';
                }
            });
        }

        // Botão Ver Exemplos Educacionais
        const btnVerExemplos = document.getElementById('btnVerExemplos');
        if (btnVerExemplos) {
            btnVerExemplos.addEventListener('click', () => {
                const memorial = document.getElementById('memorialSection');
                const exemplos = document.getElementById('exemplosSection');
                if (memorial) memorial.style.display = 'none';
                if (exemplos) {
                    exemplos.style.display = 'block';
                    exemplos.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }

        // Botão Fechar Exemplos
        const btnFecharExemplos = document.getElementById('btnFecharExemplos');
        if (btnFecharExemplos) {
            btnFecharExemplos.addEventListener('click', () => {
                const exemplos = document.getElementById('exemplosSection');
                if (exemplos) {
                    exemplos.style.display = 'none';
                }
            });
        }

        // Botões Voltar nos Exemplos (todos os botões com a classe)
        document.querySelectorAll('.btn-voltar-exemplo').forEach(btn => {
            btn.addEventListener('click', () => {
                const exemplos = document.getElementById('exemplosSection');
                if (exemplos) {
                    exemplos.style.display = 'none';
                }
            });
        });
    }

    configurarIconesInfo() {
        console.log('🔧 Configurando ícones de info no mutuo...');
        const infoIcons = [
            { iconId: 'infoIconValor', descricaoId: 'descricaoValor' },
            { iconId: 'infoIconTaxa', descricaoId: 'descricaoTaxa' },
            { iconId: 'infoIconPrazo', descricaoId: 'descricaoPrazo' }
        ];

        infoIcons.forEach(({ iconId, descricaoId }) => {
            const icon = document.getElementById(iconId);
            const descricao = document.getElementById(descricaoId);
            
            console.log(`  - ${iconId}:`, icon ? '✅ encontrado' : '❌ NÃO encontrado');
            console.log(`  - ${descricaoId}:`, descricao ? '✅ encontrado' : '❌ NÃO encontrado');

            if (icon && descricao) {
                icon.addEventListener('click', () => {
                    console.log(`🖱️ Clique no ${iconId}`);
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
            let animationFrame = null;
            let tempoInicio = 0;
            let estaSegurando = false;
            let direcao = 1;
            let timeoutInicial = null;
            let incrementouUmaVez = false;
            
            const animar = (timestamp) => {
                if (!estaSegurando) return;
                
                const targetId = btn.getAttribute('data-target');
                const slider = document.getElementById(targetId);
                
                if (!slider) return;
                
                const tempoDecorrido = timestamp - tempoInicio;
                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);
                const range = max - min;
                
                const velocidade = range / 3000;
                const distancia = velocidade * tempoDecorrido;
                
                const valorInicial = parseFloat(btn.dataset.valorInicial);
                let novoValor = valorInicial + (distancia * direcao);
                
                novoValor = Math.max(min, Math.min(max, novoValor));
                
                if ((direcao > 0 && novoValor >= max) || (direcao < 0 && novoValor <= min)) {
                    slider.value = novoValor;
                    slider.dispatchEvent(new Event('input', { bubbles: true }));
                    pararIncremento();
                    return;
                }
                
                slider.value = novoValor;
                slider.dispatchEvent(new Event('input', { bubbles: true }));
                
                animationFrame = requestAnimationFrame(animar);
            };
            
            const incrementarUmaVez = () => {
                const targetId = btn.getAttribute('data-target');
                const slider = document.getElementById(targetId);
                if (!slider) return;
                
                const step = parseFloat(btn.getAttribute('data-step'));
                const novoValor = Math.max(
                    parseFloat(slider.min),
                    Math.min(parseFloat(slider.max), parseFloat(slider.value) + step)
                );
                
                slider.value = novoValor;
                slider.dispatchEvent(new Event('input', { bubbles: true }));
                incrementouUmaVez = true;
            };
            
            const iniciarAnimacao = () => {
                if (animationFrame) return;
                
                const targetId = btn.getAttribute('data-target');
                const slider = document.getElementById(targetId);
                if (!slider) return;
                
                const stepStr = btn.getAttribute('data-step');
                direcao = parseFloat(stepStr) > 0 ? 1 : -1;
                
                btn.dataset.valorInicial = slider.value;
                
                tempoInicio = performance.now();
                animationFrame = requestAnimationFrame(animar);
            };
            
            const pararIncremento = () => {
                estaSegurando = false;
                
                if (timeoutInicial) {
                    clearTimeout(timeoutInicial);
                    timeoutInicial = null;
                }
                
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                    animationFrame = null;
                }
                
                delete btn.dataset.valorInicial;
                incrementouUmaVez = false;
            };
            
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                estaSegurando = true;
                
                incrementarUmaVez();
                
                timeoutInicial = setTimeout(() => {
                    if (estaSegurando) {
                        iniciarAnimacao();
                    }
                }, 500);
            });
            
            btn.addEventListener('mouseup', (e) => {
                e.preventDefault();
                pararIncremento();
            });
            
            btn.addEventListener('mouseleave', (e) => {
                pararIncremento();
            });
            
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                estaSegurando = true;
                
                incrementarUmaVez();
                
                timeoutInicial = setTimeout(() => {
                    if (estaSegurando) {
                        iniciarAnimacao();
                    }
                }, 500);
            });
            
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                pararIncremento();
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
        const sliderValor = document.getElementById('sliderValor');
        const sliderTaxa = document.getElementById('sliderTaxa');
        const sliderPrazo = document.getElementById('sliderPrazo');

        if (inputValor && sliderValor) {
            configurarInputComSlider({
                input: inputValor,
                slider: sliderValor,
                onUpdate: () => this.calcular()
            });
        }

        if (inputTaxa && sliderTaxa) {
            configurarInputComSlider({
                input: inputTaxa,
                slider: sliderTaxa,
                onUpdate: () => this.calcular()
            });
        }

        if (inputPrazo && sliderPrazo) {
            configurarInputComSlider({
                input: inputPrazo,
                slider: sliderPrazo,
                onUpdate: () => this.calcular()
            });
        }
    }

    converterTaxa() {
        const sliderTaxa = document.getElementById('sliderTaxa');
        const inputTaxa = document.getElementById('inputTaxa');
        const taxaAtual = parseFloat(sliderTaxa?.value || 10);
        const periodoNovo = document.querySelector('input[name="periodoRapido"]:checked')?.value || 'ano';
        
        // Determinar casas decimais baseado na periodicidade
        const casasDecimais = periodoNovo === 'dia' ? 3 : 2;
        
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
                sliderTaxa.step = 0.1;
            } else if (periodoNovo === 'mes') {
                sliderTaxa.min = 0;
                sliderTaxa.max = (Math.pow(1.20, 1 / 12) - 1) * 100; // ~1.531%
                sliderTaxa.step = 0.01;
            } else { // dia
                sliderTaxa.min = 0;
                sliderTaxa.max = (Math.pow(1.20, 1 / 365) - 1) * 100; // ~0.0501%
                sliderTaxa.step = 0.001;
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
        const inputValor = document.getElementById('inputValor');
        const inputTaxa = document.getElementById('inputTaxa');
        const inputPrazo = document.getElementById('inputPrazo');
        const sliderValor = document.getElementById('sliderValor');
        const sliderTaxa = document.getElementById('sliderTaxa');
        const sliderPrazo = document.getElementById('sliderPrazo');
        
        const valor = obterValorReal(inputValor, sliderValor, 50000);
        const taxaInput = obterValorReal(inputTaxa, sliderTaxa, 12);
        const prazoAnos = parseInt(obterValorReal(inputPrazo, sliderPrazo, 5));

        const periodicidade = document.querySelector('input[name="periodoRapido"]:checked')?.value || 'ano';
        const sistema = document.querySelector('input[name="sistemaRapido"]:checked')?.value || 'sac';

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

        return {
            valor,
            taxaMensal,
            numParcelas,
            sistema,
            taxaExibida: taxaInput,
            periodicidade
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

        // Atualizar slider de parcelas
        const sliderParcelas = document.getElementById('sliderParcelas');
        if (sliderParcelas) {
            sliderParcelas.max = dados.numParcelas;
            if (this.ultimaParcelaSelecionada > dados.numParcelas) {
                this.ultimaParcelaSelecionada = 1;
            }
            sliderParcelas.value = this.ultimaParcelaSelecionada;
        }

        this.atualizarParcelaExibida();
        this.gerarTabelaCompleta();
        this.atualizarGrafico();
    }

    calcularAmortizacao(dados) {
        const { valor, taxaMensal, numParcelas, sistema } = dados;
        const tabela = [];

        if (sistema === 'sac') {
            // SAC: Amortização constante
            const amortizacaoFixa = valor / numParcelas;
            let saldo = valor;

            for (let i = 1; i <= numParcelas; i++) {
                const juros = saldo * taxaMensal;
                const parcela = amortizacaoFixa + juros;
                saldo -= amortizacaoFixa;

                tabela.push({
                    numero: i,
                    parcela: parcela,
                    amortizacao: amortizacaoFixa,
                    juros: juros,
                    saldo: Math.max(0, saldo)
                });
            }
        } else if (sistema === 'price') {
            // Price: Parcela fixa (PMT)
            const pmt = valor * (taxaMensal * Math.pow(1 + taxaMensal, numParcelas)) / 
                        (Math.pow(1 + taxaMensal, numParcelas) - 1);
            let saldo = valor;

            for (let i = 1; i <= numParcelas; i++) {
                const juros = saldo * taxaMensal;
                const amortizacao = pmt - juros;
                saldo -= amortizacao;

                tabela.push({
                    numero: i,
                    parcela: pmt,
                    amortizacao: amortizacao,
                    juros: juros,
                    saldo: Math.max(0, saldo)
                });
            }
        } else if (sistema === 'americano') {
            // Americano: Só juros, principal no final
            const jurosFixos = valor * taxaMensal;

            for (let i = 1; i <= numParcelas; i++) {
                if (i < numParcelas) {
                    tabela.push({
                        numero: i,
                        parcela: jurosFixos,
                        amortizacao: 0,
                        juros: jurosFixos,
                        saldo: valor
                    });
                } else {
                    // Última parcela: principal + juros
                    tabela.push({
                        numero: i,
                        parcela: valor + jurosFixos,
                        amortizacao: valor,
                        juros: jurosFixos,
                        saldo: 0
                    });
                }
            }
        }

        return tabela;
    }

    atualizarDisplays(dados) {
        // Atualizar input de valor
        const inputValor = document.getElementById('inputValor');
        if (inputValor) {
            inputValor.value = this.formatarComSufixo(dados.valor);
        }

        // Atualizar input de taxa com casas decimais variáveis
        const inputTaxa = document.getElementById('inputTaxa');
        if (inputTaxa) {
            const casasDecimais = dados.periodicidade === 'dia' ? 3 : 2;
            inputTaxa.value = formatarNumero(dados.taxaExibida, casasDecimais);
        }

        // Atualizar input de prazo
        const inputPrazo = document.getElementById('inputPrazo');
        if (inputPrazo) {
            const prazo = parseInt(document.getElementById('sliderPrazo')?.value || 5);
            inputPrazo.value = prazo;
        }
    }

    formatarComSufixo(valor) {
        if (valor >= 1000000) {
            return formatarNumero(valor / 1000000, 1) + 'M';
        } else if (valor >= 1000) {
            return formatarNumero(valor / 1000, 1) + 'k';
        }
        return formatarNumero(valor, 0);
    }

    atualizarResultados(dados) {
        const totalPago = this.tabelaAmortizacao.reduce((sum, p) => sum + p.parcela, 0);
        const jurosTotais = this.tabelaAmortizacao.reduce((sum, p) => sum + p.juros, 0);
        const percJuros = (jurosTotais / dados.valor) * 100;

        // Atualizar número total de parcelas
        const totalParcelas = document.getElementById('totalParcelas');
        if (totalParcelas) totalParcelas.textContent = dados.numParcelas;

        // Atualizar resumo financeiro
        const resValorEmprestado = document.getElementById('resValorEmprestado');
        const resTotalPagar = document.getElementById('resTotalPagar');
        const resTotalJuros = document.getElementById('resTotalJuros');
        const resPorcentagemJuros = document.getElementById('resPorcentagemJuros');

        if (resValorEmprestado) resValorEmprestado.textContent = formatarMoeda(dados.valor);
        if (resTotalPagar) resTotalPagar.textContent = formatarMoeda(totalPago);
        if (resTotalJuros) resTotalJuros.textContent = formatarMoeda(jurosTotais);
        if (resPorcentagemJuros) resPorcentagemJuros.textContent = formatarNumero(percJuros, 2) + '%';
    }

    atualizarParcelaExibida() {
        const parcela = this.tabelaAmortizacao[this.ultimaParcelaSelecionada - 1];
        if (!parcela) return;

        const numeroParcela = document.getElementById('numeroParcela');
        const valorParcela = document.getElementById('valorParcela');
        const valorAmortizacao = document.getElementById('valorAmortizacao');
        const valorJurosParcela = document.getElementById('valorJurosParcela');
        const saldoDevedor = document.getElementById('saldoDevedor');

        if (numeroParcela) numeroParcela.textContent = parcela.numero;
        if (valorParcela) valorParcela.textContent = formatarMoeda(parcela.parcela);
        if (valorAmortizacao) valorAmortizacao.textContent = formatarMoeda(parcela.amortizacao);
        if (valorJurosParcela) valorJurosParcela.textContent = formatarMoeda(parcela.juros);
        if (saldoDevedor) saldoDevedor.textContent = formatarMoeda(parcela.saldo);
    }

    toggleTabela() {
        const tabelaSection = document.getElementById('tabelaSection');
        const resultados = document.getElementById('resultadosSection');

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
                <td>${formatarMoeda(p.parcela)}</td>
                <td>${formatarMoeda(p.amortizacao)}</td>
                <td>${formatarMoeda(p.juros)}</td>
                <td>${formatarMoeda(p.saldo)}</td>
            `;
            tbody.appendChild(tr);
        });

        // Linha de total
        const totalParcelas = this.tabelaAmortizacao.reduce((sum, p) => sum + p.parcela, 0);
        const totalAmort = this.tabelaAmortizacao.reduce((sum, p) => sum + p.amortizacao, 0);
        const totalJuros = this.tabelaAmortizacao.reduce((sum, p) => sum + p.juros, 0);

        const trTotal = document.createElement('tr');
        trTotal.className = 'linha-total';
        trTotal.innerHTML = `
            <td><strong>TOTAL</strong></td>
            <td><strong>${formatarMoeda(totalParcelas)}</strong></td>
            <td><strong>${formatarMoeda(totalAmort)}</strong></td>
            <td><strong>${formatarMoeda(totalJuros)}</strong></td>
            <td>-</td>
        `;
        tbody.appendChild(trTotal);
    }

    atualizarMemorial() {
        // Obter valores atuais
        const inputValor = document.getElementById('inputValor');
        const inputTaxa = document.getElementById('inputTaxa');
        const inputPrazo = document.getElementById('inputPrazo');
        const sliderValor = document.getElementById('sliderValor');
        const sliderTaxa = document.getElementById('sliderTaxa');
        const sliderPrazo = document.getElementById('sliderPrazo');

        const valor = obterValorReal(inputValor, sliderValor);
        const taxa = obterValorReal(inputTaxa, sliderTaxa);
        const prazo = obterValorReal(inputPrazo, sliderPrazo);
        
        const periodicidade = document.querySelector('input[name="periodoRapido"]:checked')?.value || 'mes';
        const sistema = document.querySelector('input[name="sistemaRapido"]:checked')?.value || 'sac';

        // Obter nomes traduzidos
        const nomeSistema = sistema === 'sac' ? i18n.obterTraducao('system-sac') : 
                           sistema === 'price' ? i18n.obterTraducao('system-price') : 
                           i18n.obterTraducao('system-german');

        const periodoTexto = periodicidade === 'ano' ? i18n.obterTraducao('yearly') : i18n.obterTraducao('monthly');

        // Atualizar resumo
        const resumoValor = document.getElementById('resumo-valor');
        const resumoTaxa = document.getElementById('resumo-taxa');
        const resumoPrazo = document.getElementById('resumo-prazo');
        const resumoSistema = document.getElementById('resumo-sistema');
        const resumoParcela = document.getElementById('resumo-parcela');
        const resumoTotalJuros = document.getElementById('resumo-total-juros');
        const resumoTotalPago = document.getElementById('resumo-total-pago');

        if (resumoValor) resumoValor.textContent = formatarMoeda(valor);
        if (resumoTaxa) resumoTaxa.textContent = `${formatarNumero(taxa, 2)}% ${periodoTexto}`;
        if (resumoPrazo) resumoPrazo.textContent = `${prazo} ${periodicidade === 'ano' ? i18n.obterTraducao('years') : i18n.obterTraducao('months')}`;
        if (resumoSistema) resumoSistema.textContent = nomeSistema;

        if (this.tabelaAmortizacao && this.tabelaAmortizacao.length > 0) {
            const primeiraParcela = this.tabelaAmortizacao[0];
            const totalJuros = this.tabelaAmortizacao.reduce((sum, p) => sum + p.juros, 0);
            const totalPago = this.tabelaAmortizacao.reduce((sum, p) => sum + p.parcela, 0);

            if (resumoParcela) {
                if (sistema === 'sac') {
                    const ultimaParcela = this.tabelaAmortizacao[this.tabelaAmortizacao.length - 1];
                    resumoParcela.textContent = `${formatarMoeda(primeiraParcela.parcela)} → ${formatarMoeda(ultimaParcela.parcela)}`;
                } else {
                    resumoParcela.textContent = formatarMoeda(primeiraParcela.parcela);
                }
            }
            if (resumoTotalJuros) resumoTotalJuros.textContent = formatarMoeda(totalJuros);
            if (resumoTotalPago) resumoTotalPago.textContent = formatarMoeda(totalPago);
        }

        // Gerar conteúdo dinâmico do memorial baseado no sistema
        this.gerarConteudoMemorialDinamico(sistema, valor, taxa, prazo);
    }

    gerarConteudoMemorialDinamico(sistema, valor, taxa, prazo) {
        const container = document.getElementById('memorial-conteudo-dinamico');
        if (!container) return;

        // Limpar conteúdo anterior
        container.innerHTML = '';

        // Obter traduções
        const txtAmortizacao = i18n.obterTraducao('memorial-amortizacao') || 'Amortização';
        const txtJuros = i18n.obterTraducao('memorial-juros') || 'Juros';
        const txtSaldoDevedor = i18n.obterTraducao('memorial-saldo-devedor') || 'Saldo Devedor';
        const txtParcela = i18n.obterTraducao('memorial-parcela') || 'Parcela';
        const txtParcelaFixa = i18n.obterTraducao('memorial-parcela-fixa') || 'Parcela Fixa';
        const txtFormulas = i18n.obterTraducao('formulas') || 'Fórmulas';
        const txtUltimaParcela = i18n.obterTraducao('memorial-ultima-parcela') || 'Última Parcela';

        // Criar conteúdo baseado no sistema
        if (sistema === 'sac') {
            const subtitulo = i18n.obterTraducao('memorial-sac-subtitle') || 'Sistema de Amortização Constante';
            container.innerHTML = `
                <div class="memorial-item">
                    <h3>📐 ${subtitulo}</h3>
                    <p><strong>${txtFormulas}:</strong></p>
                    <div class="formula-box">
                        <p>${txtAmortizacao} = ${formatarMoeda(valor)} ÷ ${prazo} = ${formatarMoeda(valor / prazo)}</p>
                        <p>${txtJuros} = ${txtSaldoDevedor} × ${formatarNumero(taxa / 100, 4)}</p>
                        <p>${txtParcela} = ${txtAmortizacao} + ${txtJuros}</p>
                    </div>
                </div>
            `;
        } else if (sistema === 'price') {
            const taxaMensal = taxa / 100;
            const pmt = valor * (taxaMensal * Math.pow(1 + taxaMensal, prazo)) / (Math.pow(1 + taxaMensal, prazo) - 1);
            const subtitulo = i18n.obterTraducao('memorial-price-subtitle') || 'Sistema Francês de Amortização';
            
            container.innerHTML = `
                <div class="memorial-item">
                    <h3>📐 ${subtitulo}</h3>
                    <p><strong>${txtFormulas}:</strong></p>
                    <div class="formula-box">
                        <p>PMT = ${formatarMoeda(valor)} × [${formatarNumero(taxa / 100, 4)} × (1 + ${formatarNumero(taxa / 100, 4)})^${prazo}] / [(1 + ${formatarNumero(taxa / 100, 4)})^${prazo} - 1]</p>
                        <p>${txtParcelaFixa} = ${formatarMoeda(pmt)}</p>
                        <p>${txtJuros} = ${txtSaldoDevedor} × ${formatarNumero(taxa / 100, 4)}</p>
                        <p>${txtAmortizacao} = ${txtParcela} - ${txtJuros}</p>
                    </div>
                </div>
            `;
        } else if (sistema === 'americano') {
            const jurosFixos = valor * (taxa / 100);
            const subtitulo = i18n.obterTraducao('memorial-german-subtitle') || 'Sistema Americano';
            
            container.innerHTML = `
                <div class="memorial-item">
                    <h3>📐 ${subtitulo}</h3>
                    <p><strong>${txtFormulas}:</strong></p>
                    <div class="formula-box">
                        <p>${txtJuros} (${txtParcela.toLowerCase()}s 1 a ${prazo - 1}) = ${formatarMoeda(valor)} × ${formatarNumero(taxa / 100, 4)} = ${formatarMoeda(jurosFixos)}</p>
                        <p>${txtUltimaParcela} (${prazo}) = ${formatarMoeda(valor)} + ${formatarMoeda(jurosFixos)} = ${formatarMoeda(valor + jurosFixos)}</p>
                    </div>
                </div>
            `;
        }
    }

    atualizarGrafico() {
        const canvas = document.getElementById('graficoEvolutivo');
        if (!canvas || typeof Chart === 'undefined') return;

        const ctx = canvas.getContext('2d');

        // Destruir gráfico anterior
        if (this.graficos.evolucao) {
            this.graficos.evolucao.destroy();
        }

        const labels = this.tabelaAmortizacao.map(p => p.numero);
        
        // Calcular valores acumulados
        let amortAcumulada = 0;
        let jurosAcumulados = 0;
        const dadosAmortAcum = this.tabelaAmortizacao.map(p => {
            amortAcumulada += p.amortizacao;
            return amortAcumulada;
        });
        const dadosJurosAcum = this.tabelaAmortizacao.map(p => {
            jurosAcumulados += p.juros;
            return jurosAcumulados;
        });
        const dadosSaldo = this.tabelaAmortizacao.map(p => p.saldo);

        this.graficos.evolucao = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: i18n.t('grafico.amortizacao'),
                        data: dadosAmortAcum,
                        borderColor: '#4CAF50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: i18n.t('grafico.juros'),
                        data: dadosJurosAcum,
                        borderColor: '#FF9800',
                        backgroundColor: 'rgba(255, 152, 0, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: i18n.t('grafico.saldoDevedor'),
                        data: dadosSaldo,
                        borderColor: '#2196F3',
                        backgroundColor: 'rgba(33, 150, 243, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: i18n.t('grafico.eixoX')
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: i18n.t('grafico.eixoY')
                        },
                        beginAtZero: true
                    }
                }
            }
        });
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
    console.log('⏳ Mutuo: Aguardando DOM carregar...');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('✅ Mutuo: DOM carregado, inicializando...');
        const app = new MutuoApp();
        app.inicializar();
    });
} else {
    console.log('✅ Mutuo: DOM já carregado, inicializando imediatamente...');
    const app = new MutuoApp();
    app.inicializar();
}
