/**
 * iluminacao-script.js
 * Calculadora de Iluminação Residencial
 *
 * Calcula iluminação necessária baseado em tamanho, tipo de atividade,
 * cor das paredes, pé direito e luz natural (conforme NBR 5413)
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero } from '../src/utils/formatters.js';
import { ExplicacaoResultado } from '../src/components/resultado-explicado.js';

// ============================================
// CONSTANTES E DADOS
// ============================================

// Lux recomendado por tipo de atividade (NBR 5413)
const LUX_RECOMENDADO = {
    sala: 150,
    quarto: 100,
    cozinha: 300,
    banheiro: 200,
    escritorio: 300,
    corredor: 100
};

// Fatores de redução por luz natural disponível
const FATORES_LUZ_NATURAL = {
    muita: 0.5,    // Reduz 50% - muita luz natural
    media: 0.65,   // Reduz 35%
    pouca: 0.85,   // Reduz 15%
    nenhuma: 1.0   // Sem redução
};

// Fatores de reflexão por cor das paredes
const FATORES_REFLEXAO = {
    clara: 0.8,    // 80% de eficiência
    media: 0.5,    // 50%
    escura: 0.3    // 30%
};

// Tipos de lâmpadas disponíveis (watts)
const TIPOS_LAMPADAS = [6, 9, 12, 15];

// Lumens por watt (LEDs modernos)
const LUMENS_POR_WATT = 100; // 1W ≈ 100 lm para LEDs

// Horas de funcionamento por dia (para cálculo de consumo)
const HORAS_FUNCIONAMENTO_DIA = 5; // Média residencial

// ============================================
// CLASSE PRINCIPAL
// ============================================

class IluminacaoApp extends App {
    constructor() {
        super({
            appName: 'iluminacao',
            callbacks: {
                aoInicializar: () => this.inicializarIluminacao(),
                aoTrocarIdioma: () => this.atualizarAposTrocaIdioma()
            }
        });
        this.explicacao = new ExplicacaoResultado('v2-explicacao', i18n);
    }

    get traducoes() {
        const idiomaAtual = i18n.obterIdiomaAtual();
        return this.config.traducoes[idiomaAtual] || this.config.traducoes['pt-BR'] || {};
    }

    inicializarIluminacao() {
        this.configurarEventos();
        this.atualizarResultado();
    }

    atualizarAposTrocaIdioma() {
        this.atualizarResultado();
    }

    configurarEventos() {
        // Info icons (tooltips)
        this.configurarIconesInfo();

        // Sliders de valores numéricos
        ['sliderArea', 'sliderPeDireito', 'sliderTarifa'].forEach(id => {
            const slider = document.getElementById(id);
            if (slider) {
                slider.addEventListener('input', () => this.atualizarResultado());
            }
        });

        // Input direto para área
        const inputArea = document.getElementById('inputArea');
        if (inputArea) {
            inputArea.addEventListener('change', () => {
                const valor = parseFloat(inputArea.value) || 20;
                document.getElementById('sliderArea').value = valor;
                this.atualizarResultado();
            });
        }

        // Input direto para pé direito
        const inputPeDireito = document.getElementById('inputPeDireito');
        if (inputPeDireito) {
            inputPeDireito.addEventListener('change', () => {
                const valor = parseFloat(inputPeDireito.value) || 2.7;
                document.getElementById('sliderPeDireito').value = valor;
                this.atualizarResultado();
            });
        }

        // Input direto para tarifa
        const inputTarifa = document.getElementById('inputTarifa');
        if (inputTarifa) {
            inputTarifa.addEventListener('change', () => {
                const valor = parseFloat(inputTarifa.value) || 1.2;
                document.getElementById('sliderTarifa').value = valor;
                this.atualizarResultado();
            });
        }

        // Radio buttons
        document.querySelectorAll('input[name="atividade"]').forEach(radio => {
            radio.addEventListener('change', () => this.atualizarResultado());
        });
        document.querySelectorAll('input[name="corParedes"]').forEach(radio => {
            radio.addEventListener('change', () => this.atualizarResultado());
        });
        document.querySelectorAll('input[name="luzNatural"]').forEach(radio => {
            radio.addEventListener('change', () => this.atualizarResultado());
        });
    }

    /**
     * Obtém valores dos inputs
     */
    obterValoresEntrada() {
        return {
            area: parseFloat(document.getElementById('inputArea').value) || 20,
            atividade: document.querySelector('input[name="atividade"]:checked').value || 'sala',
            corParedes: document.querySelector('input[name="corParedes"]:checked').value || 'clara',
            peDireito: parseFloat(document.getElementById('inputPeDireito').value) || 2.7,
            luzNatural: document.querySelector('input[name="luzNatural"]:checked').value || 'muita',
            tarifa: parseFloat(document.getElementById('inputTarifa').value) || 1.2
        };
    }

    /**
     * Calcula o lux recomendado ajustado
     */
    calcularLuxRecomendado(atividade, luzNatural) {
        const luxBase = LUX_RECOMENDADO[atividade] || 150;
        const fatorLuz = FATORES_LUZ_NATURAL[luzNatural] || 1.0;
        return Math.round(luxBase * fatorLuz);
    }

    /**
     * Calcula lumens totais necessários
     */
    calcularLumensNecessarios(area, luxRecomendado, corParedes, peDireito) {
        const fatorReflexao = FATORES_REFLEXAO[corParedes] || 0.5;
        
        // Ajuste por pé direito: cômodos mais altos precisam de mais luz
        const fatorPeDireito = peDireito / 2.7; // Normaliza por pé direito padrão
        
        // Lumens = Área × Lux / (Fator de Reflexão × Fator de Altura)
        const lumensNecessarios = (area * luxRecomendado) / (fatorReflexao * (1 - 0.1 * (fatorPeDireito - 1)));
        
        return Math.round(lumensNecessarios);
    }

    /**
     * Define a configuração de luminárias e potência
     */
    definirConfiguracaoLuminarias(lumensNecessarios) {
        // Estratégia: usar maior quantidade de luminárias pequenas é mais eficiente
        // Começar com lâmpadas menores
        
        let melhorConfig = null;
        let menorPotencia = Infinity;

        // Testar diferentes combinações de tipos de lâmpadas
        for (let wattPrincipal of TIPOS_LAMPADAS) {
            const lumensPorLampada = wattPrincipal * LUMENS_POR_WATT;
            const quantidadeMinima = Math.ceil(lumensNecessarios / lumensPorLampada);

            if (quantidadeMinima > 0 && quantidadeMinima <= 10) {
                const potenciaTotal = wattPrincipal * quantidadeMinima;

                if (potenciaTotal < menorPotencia) {
                    menorPotencia = potenciaTotal;
                    melhorConfig = {
                        quantidade: quantidadeMinima,
                        wattagem: wattPrincipal,
                        potenciaTotal: potenciaTotal,
                        lumensReais: lumensPorLampada * quantidadeMinima
                    };
                }
            }
        }

        return melhorConfig || {
            quantidade: 2,
            wattagem: 9,
            potenciaTotal: 18,
            lumensReais: 1800
        };
    }

    /**
     * Calcula consumo mensal e custo
     */
    calcularConsumoECusto(potenciaTotal, tarifa) {
        const consumoDiario = (potenciaTotal * HORAS_FUNCIONAMENTO_DIA) / 1000; // kWh
        const consumoMensal = consumoDiario * 30; // Considerando mês de 30 dias
        const custoMensal = consumoMensal * tarifa;
        const custoAnual = custoMensal * 12;

        return {
            consumoDiario: consumoDiario,
            consumoMensal: consumoMensal,
            custoMensal: custoMensal,
            custoAnual: custoAnual
        };
    }

    /**
     * Atualiza todos os resultados
     */
    atualizarResultado() {
        const valores = this.obterValoresEntrada();

        // Calcula lux recomendado
        const luxRecomendado = this.calcularLuxRecomendado(valores.atividade, valores.luzNatural);

        // Calcula lumens necessários
        const lumensNecessarios = this.calcularLumensNecessarios(
            valores.area,
            luxRecomendado,
            valores.corParedes,
            valores.peDireito
        );

        // Define configuração de luminárias
        const configLuminarias = this.definirConfiguracaoLuminarias(lumensNecessarios);

        // Calcula consumo e custo
        const consumoECusto = this.calcularConsumoECusto(
            configLuminarias.potenciaTotal,
            valores.tarifa
        );

        // Atualiza DOM com resultados
        this.atualizarDOM(luxRecomendado, configLuminarias, consumoECusto);

        // Atualiza explicação (V2)
        this.explicacao.renderizarExplicacao(
            this.gerarExplicacao(valores, luxRecomendado, lumensNecessarios, configLuminarias, consumoECusto)
        );
    }

    /**
     * Atualiza elementos DOM com os resultados calculados
     */
    atualizarDOM(luxRecomendado, configLuminarias, consumoECusto) {
        // Lux Recomendado
        document.getElementById('resultadoLux').textContent = formatarNumero(luxRecomendado, 0);

        // Potência Total
        document.getElementById('resultadoPotencia').textContent = formatarNumero(configLuminarias.potenciaTotal, 0);

        // Número de Luminárias
        document.getElementById('resultadoQuantidade').textContent = configLuminarias.quantidade;

        // Consumo Mensal
        document.getElementById('resultadoConsumo').textContent = formatarNumero(consumoECusto.consumoMensal, 1);

        // Custo Mensal
        const custoMensalFormatado = consumoECusto.custoMensal.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
        document.getElementById('resultadoCusto').textContent = custoMensalFormatado;

        // Custo Anual
        const custoAnualFormatado = consumoECusto.custoAnual.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
        document.getElementById('resultadoCustoAnual').textContent = custoAnualFormatado;

        // Tabela de detalhamento
        this.atualizarTabelaLuminarias(configLuminarias);
    }

    /**
     * Atualiza tabela com detalhamento de luminárias
     */
    atualizarTabelaLuminarias(configLuminarias) {
        const corpoTabela = document.getElementById('corpoTabelaLuminarias');
        if (!corpoTabela) return;

        corpoTabela.innerHTML = '';

        // Determinar descrição do tipo de lâmpada
        let tipoLampada = '';
        const wattagem = configLuminarias.wattagem;
        if (wattagem <= 9) {
            tipoLampada = 'LED (Quente)';
        } else if (wattagem <= 12) {
            tipoLampada = 'LED (Branco Neutro)';
        } else {
            tipoLampada = 'LED (Branco Frio)';
        }

        const linha = document.createElement('tr');
        linha.innerHTML = `
            <td>${configLuminarias.quantidade}</td>
            <td>${configLuminarias.wattagem}W</td>
            <td>${tipoLampada}</td>
        `;
        corpoTabela.appendChild(linha);
    }

    /**
     * Gera texto de explicação para V2
     */
    gerarExplicacao(valores, luxRecomendado, lumensNecessarios, configLuminarias, consumoECusto) {
        return {
            titulo: 'Explicação do Cálculo de Iluminação',
            secoes: [
                {
                    titulo: '1️⃣ Determinação do Lux Recomendado',
                    conteudo: `
                        Para um ambiente do tipo <strong>${valores.atividade}</strong>, a norma NBR 5413 recomenda 
                        <strong>${LUX_RECOMENDADO[valores.atividade]} lux</strong>. Como há 
                        <strong>${valores.luzNatural === 'muita' ? 'muita' : valores.luzNatural === 'media' ? 'média' : valores.luzNatural === 'pouca' ? 'pouca' : 'nenhuma'}</strong> 
                        luz natural, aplicamos um fator de redução de 
                        <strong>${Math.round((1 - FATORES_LUZ_NATURAL[valores.luzNatural]) * 100)}%</strong>, 
                        resultando em <strong>${luxRecomendado} lux</strong> necessários.
                    `
                },
                {
                    titulo: '2️⃣ Cálculo de Lumens Necessários',
                    conteudo: `
                        Para uma área de <strong>${valores.area} m²</strong> com paredes <strong>${valores.corParedes}</strong> 
                        e pé-direito de <strong>${valores.peDireito} m</strong>, calculamos:<br>
                        <strong>Lumens = ${valores.area} m² × ${luxRecomendado} lux = ${lumensNecessarios} lm</strong>
                    `
                },
                {
                    titulo: '3️⃣ Seleção de Luminárias',
                    conteudo: `
                        Para gerar <strong>${lumensNecessarios} lumens</strong>, recomendamos 
                        <strong>${configLuminarias.quantidade} lâmpadas de ${configLuminarias.wattagem}W</strong>, 
                        totalizando <strong>${configLuminarias.potenciaTotal}W</strong> de potência instalada.
                    `
                },
                {
                    titulo: '4️⃣ Estimativa de Custo Mensal',
                    conteudo: `
                        Considerando <strong>${HORAS_FUNCIONAMENTO_DIA} horas/dia</strong> de funcionamento médio 
                        e uma tarifa de <strong>R$ ${valores.tarifa.toFixed(2)}/kWh</strong>, 
                        o custo mensal estimado é de <strong>${consumoECusto.custoMensal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</strong>
                        (<strong>${consumoECusto.consumoMensal.toFixed(1)} kWh/mês</strong>).
                    `
                }
            ]
        };
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

const app = new IluminacaoApp();
