/**
 * mutuo-script-new.js
 * Calculadora de Empréstimos - Versão Modular
 * 
 * Sistemas: SAC, Price (Francês) e Americano
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero, formatarMoeda } from '../src/utils/formatters.js';

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

        // Botão SAIBA MAIS (exemplos)
        const btnExemplos = document.getElementById('btnExemplos');
        if (btnExemplos) {
            btnExemplos.addEventListener('click', () => {
                const memorial = document.getElementById('memorialSection');
                if (memorial) {
                    memorial.style.display = 'block';
                }
            });
        }

        // Botão Fechar Memorial
        const btnFecharMemorial = document.getElementById('btnFecharMemorial');
        if (btnFecharMemorial) {
            btnFecharMemorial.addEventListener('click', () => {
                const memorial = document.getElementById('memorialSection');
                if (memorial) {
                    memorial.style.display = 'none';
                }
            });
        }
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
                
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                    animationFrame = null;
                }
                
                delete btn.dataset.valorInicial;
            };
            
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                estaSegurando = true;
                iniciarAnimacao();
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
                iniciarAnimacao();
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

        const atualizarDoInput = (input, slider, tipo) => {
            const valor = input.value.replace(/[^\d.,]/g, '').replace(',', '.');
            const numero = parseFloat(valor);
            
            if (!isNaN(numero)) {
                if (tipo === 'valor') {
                    // Converter k/m para valor numérico
                    let valorFinal = numero;
                    if (input.value.toLowerCase().includes('k')) {
                        valorFinal = numero * 1000;
                    } else if (input.value.toLowerCase().includes('m')) {
                        valorFinal = numero * 1000000;
                    }
                    slider.value = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), valorFinal));
                } else {
                    slider.value = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), numero));
                }
                this.calcular();
            }
        };

        if (inputValor && sliderValor) {
            inputValor.addEventListener('blur', () => atualizarDoInput(inputValor, sliderValor, 'valor'));
            inputValor.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    atualizarDoInput(inputValor, sliderValor, 'valor');
                    inputValor.blur();
                }
            });
        }

        if (inputTaxa && sliderTaxa) {
            inputTaxa.addEventListener('blur', () => atualizarDoInput(inputTaxa, sliderTaxa, 'taxa'));
            inputTaxa.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    atualizarDoInput(inputTaxa, sliderTaxa, 'taxa');
                    inputTaxa.blur();
                }
            });
        }

        if (inputPrazo && sliderPrazo) {
            inputPrazo.addEventListener('blur', () => atualizarDoInput(inputPrazo, sliderPrazo, 'prazo'));
            inputPrazo.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    atualizarDoInput(inputPrazo, sliderPrazo, 'prazo');
                    inputPrazo.blur();
                }
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
        const sliderValor = document.getElementById('sliderValor');
        const sliderTaxa = document.getElementById('sliderTaxa');
        const sliderPrazo = document.getElementById('sliderPrazo');
        
        const valor = parseFloat(sliderValor?.value || 50000);
        const taxaInput = parseFloat(sliderTaxa?.value || 12);
        const prazoAnos = parseInt(sliderPrazo?.value || 5);

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
