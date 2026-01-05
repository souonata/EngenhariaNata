# Padrão de Migração ES6 - Engenharia NATA

## 📊 Status da Migração
- **Migrado:** 7/10 apps (70%)
- **Pendente:** 3/10 apps (30%)

### ✅ Apps Migrados (ES6 Modular)
1. **bugs** (v1.0.0) - Sistema de reporte de bugs
2. **sobre** (v1.3.8) - Página institucional com traduções completas
3. **helice** (v1.2.2) - Calculadora de hélice náutica com gráficos
4. **bitola** (v1.2.7) - Calculadora de bitola de fios elétricos
5. **mutuo** (v1.2.7) - Calculadora de empréstimos (3 sistemas)
6. **index** (v1.0.0) - Landing page com relógio em tempo real
7. **arcondicionado** (v1.0.6) - Calculadora de BTU multi-split

### ⏳ Apps Pendentes (Original)
1. **aquecimento** (2211 linhas) - Aquecedor solar térmico
2. **solar** (3052 linhas) - Painéis fotovoltaicos off-grid
3. **fazenda** (~1700 linhas) - Planejamento de fazenda

---

## 🏗️ Estrutura Base da Classe ES6

```javascript
// ============================================
// IMPORTS (SEMPRE NAMED IMPORTS)
// ============================================
import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero, formatarMoeda } from '../src/utils/formatters.js';

// ============================================
// CLASSE PRINCIPAL
// ============================================
class NomeApp extends App {
    constructor() {
        super({
            appName: 'nomeapp',  // ⚠️ OBRIGATÓRIO: nome do app para i18n
            callbacks: {
                aoInicializar: () => this.inicializarNomeApp(),
                aoTrocarIdioma: () => this.atualizarAposTrocaIdioma()
            }
        });
        
        // Estado dos botões de incremento
        this.estadoBotoes = {
            estaSegurando: false,
            animationId: null,
            targetId: null,
            step: 0,
            tempoInicio: 0,
            valorInicial: 0,
            delayTimeout: null  // ⚠️ IMPORTANTE: para delay de 300ms
        };
    }
    
    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    inicializarNomeApp() {
        console.log('✅ Inicializando NomeApp...');
        
        // Configurar todos os eventos
        this.configurarSliders();
        this.configurarBotoesIncremento();
        this.configurarInputsTexto();
        this.configurarInfoIcons();
        
        // Se houver gráficos Chart.js
        if (typeof Chart !== 'undefined') {
            this.inicializarGraficos();
        }
        
        // Cálculo inicial
        this.atualizarResultados();
        
        console.log('✅ NomeApp inicializado com sucesso!');
    }
    
    // ============================================
    // CONFIGURAÇÃO DE BOTÕES DE INCREMENTO
    // ============================================
    configurarBotoesIncremento() {
        const botoes = document.querySelectorAll('.arrow-btn');
        
        botoes.forEach(botao => {
            const targetId = botao.getAttribute('data-target');
            const step = parseFloat(botao.getAttribute('data-step'));
            
            // ⚠️ IMPORTANTE: mousedown/touchstart para segurar
            botao.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.iniciarIncremento(targetId, step);
            });
            
            botao.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.iniciarIncremento(targetId, step);
            });
            
            // ⚠️ IMPORTANTE: parar em todas as situações
            botao.addEventListener('mouseup', () => this.pararIncremento());
            botao.addEventListener('touchend', () => this.pararIncremento());
            botao.addEventListener('mouseleave', () => this.pararIncremento());
        });
    }
    
    iniciarIncremento(targetId, step) {
        if (this.estadoBotoes.estaSegurando) return;
        
        this.estadoBotoes.estaSegurando = true;
        this.estadoBotoes.targetId = targetId;
        this.estadoBotoes.step = step;
        
        const slider = document.getElementById(targetId);
        if (!slider) return;
        
        // ⚠️ LIÇÃO 9: Primeiro incremento IMEDIATO
        this.ajustarValor(targetId, step);
        
        // ⚠️ LIÇÃO 8: Aguardar 300ms antes de contínuo
        this.estadoBotoes.delayTimeout = setTimeout(() => {
            // ⚠️ LIÇÃO 10: Capturar valorInicial APÓS primeiro incremento
            this.estadoBotoes.valorInicial = parseFloat(slider.value);
            this.estadoBotoes.tempoInicio = performance.now();
            this.animarIncremento();
        }, 300);
    }
    
    animarIncremento() {
        if (!this.estadoBotoes.estaSegurando) return;
        
        const slider = document.getElementById(this.estadoBotoes.targetId);
        if (!slider) return;
        
        const tempoDecorrido = performance.now() - this.estadoBotoes.tempoInicio;
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        const range = max - min;
        
        // ⚠️ LIÇÃO 8: Velocidade linear - 3 segundos para percorrer todo range
        const velocidade = (range / 3000) * this.estadoBotoes.step / Math.abs(this.estadoBotoes.step);
        
        // ⚠️ LIÇÃO 10: Calcular a partir do valorInicial
        let novoValor = this.estadoBotoes.valorInicial + (velocidade * tempoDecorrido);
        
        // Limitar e arredondar
        novoValor = Math.max(min, Math.min(max, novoValor));
        const step = parseFloat(slider.step) || 1;
        novoValor = Math.round(novoValor / step) * step;
        
        slider.value = novoValor;
        
        // Atualizar input correspondente
        const inputId = this.estadoBotoes.targetId.replace('slider', 'input');
        const inputElement = document.getElementById(inputId);
        if (inputElement) {
            inputElement.value = novoValor;
        }
        
        this.atualizarResultados();
        
        // Continuar se não atingiu limites
        if ((this.estadoBotoes.step > 0 && novoValor < max) || 
            (this.estadoBotoes.step < 0 && novoValor > min)) {
            this.estadoBotoes.animationId = requestAnimationFrame(() => this.animarIncremento());
        } else {
            this.pararIncremento();
        }
    }
    
    pararIncremento() {
        this.estadoBotoes.estaSegurando = false;
        
        // ⚠️ IMPORTANTE: Limpar AMBOS os timeouts
        if (this.estadoBotoes.delayTimeout) {
            clearTimeout(this.estadoBotoes.delayTimeout);
            this.estadoBotoes.delayTimeout = null;
        }
        
        if (this.estadoBotoes.animationId) {
            cancelAnimationFrame(this.estadoBotoes.animationId);
            this.estadoBotoes.animationId = null;
        }
    }
    
    // ============================================
    // CONFIGURAÇÃO DE INFO ICONS
    // ============================================
    configurarInfoIcons() {
        const infoIcons = document.querySelectorAll('.info-icon');
        
        infoIcons.forEach(icon => {
            icon.addEventListener('click', (e) => {
                // ⚠️ LIÇÃO 9: Usar .closest() para encontrar container
                const grupoEntrada = icon.closest('.grupo-entrada');
                if (!grupoEntrada) return;
                
                // ⚠️ LIÇÃO 9: Procurar .descricao-info dentro do grupo
                const descricaoInfo = grupoEntrada.querySelector('.descricao-info');
                if (!descricaoInfo) return;
                
                // Toggle display block/none
                if (descricaoInfo.style.display === 'none' || descricaoInfo.style.display === '') {
                    descricaoInfo.style.display = 'block';
                } else {
                    descricaoInfo.style.display = 'none';
                }
            });
        });
    }
    
    // ============================================
    // ATUALIZAÇÃO APÓS TROCA DE IDIOMA
    // ============================================
    atualizarAposTrocaIdioma() {
        console.log('🌐 Atualizando após troca de idioma...');
        this.atualizarResultados();
    }
}

// ============================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ============================================
const app = new NomeApp();

// ⚠️ LIÇÃO 4: Inicialização MANUAL com verificação de readyState
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app.inicializar();
    });
} else {
    app.inicializar();
}
```

---

## 🎯 10 Lições Essenciais (Aprendidas no arcondicionado)

### ✅ Lição 1: Named Imports SEMPRE
```javascript
// ❌ ERRADO
import App from '../src/core/app.js';
import i18n from '../src/core/i18n.js';

// ✅ CORRETO
import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero, formatarMoeda } from '../src/utils/formatters.js';
```

### ✅ Lição 2: appName Obrigatório
```javascript
constructor() {
    super({
        appName: 'nomeapp',  // ⚠️ OBRIGATÓRIO para i18n funcionar
        callbacks: { ... }
    });
}
```

### ✅ Lição 3: Nomes de Métodos Corretos
```javascript
// ❌ ERRADO
callbacks: {
    aoInicializar: () => this.inicializar(),
    aoTrocarIdioma: () => this.aoTrocarIdioma()
}

// ✅ CORRETO
callbacks: {
    aoInicializar: () => this.inicializarNomeApp(),
    aoTrocarIdioma: () => this.atualizarAposTrocaIdioma()
}
```

### ✅ Lição 4: Inicialização Manual
```javascript
const app = new NomeApp();

// ⚠️ IMPORTANTE: NÃO é automático!
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app.inicializar();  // ⚠️ Chamada MANUAL
    });
} else {
    app.inicializar();  // ⚠️ Chamada MANUAL
}
```

### ✅ Lição 5: IDs HTML Exatos
```javascript
// HTML: <div id="resultadoBtuTotal">
// ❌ ERRADO
document.getElementById('btuTotal')

// ✅ CORRETO
document.getElementById('resultadoBtuTotal')
```

### ✅ Lição 6: Chart.js ANTES do Módulo
```html
<!-- ✅ ORDEM CORRETA -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script type="module" src="app-script-new.js?v=1.0.0"></script>
```

### ✅ Lição 7: Cache Busting
```html
<!-- Incrementar versão após CADA mudança -->
<script type="module" src="app-script-new.js?v=1.0.0"></script>
<script type="module" src="app-script-new.js?v=1.0.1"></script>
<script type="module" src="app-script-new.js?v=1.0.2"></script>
```

### ✅ Lição 8: Delay de 300ms nos Botões
```javascript
// Primeiro incremento imediato
this.ajustarValor(targetId, step);

// Depois aguardar 300ms para contínuo
this.estadoBotoes.delayTimeout = setTimeout(() => {
    this.estadoBotoes.valorInicial = parseFloat(slider.value);
    this.estadoBotoes.tempoInicio = performance.now();
    this.animarIncremento();
}, 300);
```

### ✅ Lição 9: Info Icons com .closest()
```javascript
// ❌ ERRADO
const descricaoInfo = document.querySelector('.descricao-info');

// ✅ CORRETO
const grupoEntrada = icon.closest('.grupo-entrada');
const descricaoInfo = grupoEntrada.querySelector('.descricao-info');
```

### ✅ Lição 10: valorInicial APÓS Incremento
```javascript
// ❌ ERRADO - captura ANTES
this.estadoBotoes.valorInicial = parseFloat(slider.value);
this.ajustarValor(targetId, step);

// ✅ CORRETO - captura DEPOIS
this.ajustarValor(targetId, step);
setTimeout(() => {
    this.estadoBotoes.valorInicial = parseFloat(slider.value);
    // ... continuar animação
}, 300);
```

---

## 📝 Estrutura de Arquivos

```
app/
├── app.html                    # HTML principal
├── app-styles.css              # Estilos específicos
├── app-script.js               # ❌ Original (manter por enquanto)
└── app-script-new.js           # ✅ ES6 Migrado

src/
├── core/
│   ├── app.js                  # Classe base App
│   └── i18n.js                 # Sistema de internacionalização
├── utils/
│   └── formatters.js           # Formatação de números/moeda
└── i18n/
    └── app.json                # Traduções PT-BR e IT-IT

config/
└── versions.json               # Controle de versões
```

---

## 🔄 Processo de Migração

### 1️⃣ Preparação
- [ ] Ler script original completo
- [ ] Identificar todos os sliders, inputs, botões
- [ ] Listar IDs HTML necessários
- [ ] Verificar se usa Chart.js
- [ ] Mapear funções de cálculo principais

### 2️⃣ Criação do ES6
- [ ] Criar `app-script-new.js`
- [ ] Importar dependências corretas (named imports)
- [ ] Criar classe extends App com appName
- [ ] Implementar métodos de inicialização
- [ ] Adicionar botões de incremento (300ms + valorInicial)
- [ ] Configurar info icons (.closest())
- [ ] Migrar funções de cálculo

### 3️⃣ Traduções
- [ ] Criar `src/i18n/app.json`
- [ ] Mapear todas as strings i18n do HTML
- [ ] Adicionar PT-BR completo
- [ ] Adicionar IT-IT completo
- [ ] Incluir tooltips e descrições

### 4️⃣ Atualização HTML
- [ ] Se Chart.js: adicionar CDN ANTES do module
- [ ] Adicionar script module: `<script type="module" src="app-script-new.js?v=1.0.0"></script>`
- [ ] Verificar todos os IDs correspondem ao JS
- [ ] Testar com Ctrl+Shift+R (hard refresh)

### 5️⃣ Validação
- [ ] ✅ Imports funcionando
- [ ] ✅ App inicializa
- [ ] ✅ Troca de idioma funciona
- [ ] ✅ Sliders respondem
- [ ] ✅ Botões +/- funcionam (clique único e segurar)
- [ ] ✅ Inputs manuais aceitam valores
- [ ] ✅ Info icons mostram/escondem
- [ ] ✅ Cálculos corretos
- [ ] ✅ Resultados exibidos
- [ ] ✅ Gráficos renderizam (se houver)

### 6️⃣ Finalização
- [ ] Atualizar `versions.json`
- [ ] Incrementar cache busting após cada fix
- [ ] Documentar bugs encontrados e correções
- [ ] Manter script original até validação completa

---

## 🐛 Bugs Comuns e Soluções

| Bug | Causa | Solução |
|-----|-------|---------|
| Import error | Default import | Usar named imports `{ App }` |
| App não inicializa | appName ausente | Adicionar `appName: 'nomeapp'` |
| Callbacks não funcionam | Nomes errados | `inicializarNomeApp()`, `atualizarAposTrocaIdioma()` |
| Nada acontece | Não chamou inicializar() | `app.inicializar()` manual com readyState |
| IDs não encontrados | Nome diferente do HTML | Verificar IDs exatos no HTML |
| Resultados vazios | IDs errados nos selectors | `getElementById()` com nome exato |
| Chart is not defined | Ordem de scripts | Chart.js CDN ANTES do module |
| Cache não atualiza | Versão não incrementada | `?v=1.0.X` após cada mudança |
| Botões muito rápidos | Sem delay | Adicionar 300ms setTimeout |
| "Voltada" ao segurar | valorInicial antes increment | Capturar valorInicial APÓS primeiro increment |
| Info icons não funcionam | Seletor errado | `.closest('.grupo-entrada').querySelector('.descricao-info')` |

---

## 📊 Status dos Apps Migrados

| App | Versão | Status | Detalhes |
|-----|--------|--------|----------|
| **bugs** | 1.0.0 | ✅ Completo | Sistema de reporte, Google Forms integrado |
| **sobre** | 1.3.8 | ✅ Completo | Página institucional, traduções PT-BR e IT-IT |
| **helice** | 1.2.2 | ✅ Completo | Calculadora hélice, Chart.js, 2 gráficos |
| **bitola** | 1.2.7 | ✅ Completo | Calculadora fios elétricos, múltiplas normas |
| **mutuo** | 1.2.7 | ✅ Completo | 3 sistemas empréstimo, conversão currency |
| **index** | 1.0.0 | ✅ Completo | Landing page, relógio tempo real |
| **arcondicionado** | 1.0.6 | ✅ Completo | AC BTU, Chart.js, multi-split, 6 iterações debug |

---

## 🎓 Próximos Passos (Apps Pendentes)

Os 3 apps restantes seguirão o mesmo padrão quando forem migrados:

### aquecimento (2211 linhas)
- Aquecedor solar térmico
- Cálculos complexos regionais
- Matrizes Brasil/Itália
- Sistema de autonomia

### solar (3052 linhas)
- Painéis fotovoltaicos off-grid
- 2 páginas (solar + config)
- Chart.js dinâmico
- Cálculo painéis/baterias/inversores

### fazenda (~1700 linhas)
- Planejamento fazenda
- Database-driven
- Regional data
- Múltiplos cálculos agrícolas

---

## 📚 Referências

- [Documentação App.js](../src/core/app.js)
- [Documentação i18n.js](../src/core/i18n.js)
- [Formatters Utils](../src/utils/formatters.js)
- [Chart.js Docs](https://www.chartjs.org/)
- [ES6 Modules MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)

---

**Última atualização:** Janeiro 2026  
**Progresso:** 7/10 apps (70%) migrados para ES6 modular
