# Developer Notes — Engenharia NATA (short)

Pequeno resumo para contribuintes e estudantes: o repositório reúne apps simples em HTML/CSS/JS puro. O objetivo aqui é ser conciso — mantenha a documentação técnica separada quando precisar de detalhes.

Arquitetura (resumida):
- index.html → tela inicial / launcher
- Pastas de apps: `mutuo/`, `helice/`, `solar/`, `bitola/`, `arcondicionado/`, `aquecimento/`, `fazenda/`, `sobre/` (cada uma contém `app.html`, `app-script.js`, `app-styles.css`)
- `scripts/count-lines.ps1` → Script PowerShell para contar linhas de código (exclui comentários), usado para atualizar estatísticas na página "Sobre o Projeto"

Pontos importantes:
- Idioma do usuário salvo em `localStorage` na chave `idiomaPreferido` (pt-BR / it-IT)
- Configurações do Solar são salvas em `localStorage` na chave `configSolar`

Scripts utilitários:
- `scripts/count-lines.ps1` — Script PowerShell para contar linhas de código (exclui comentários e linhas vazias). Use para atualizar estatísticas na página "Sobre o Projeto" após modificações significativas no código. Execução: `powershell -ExecutionPolicy Bypass -File scripts\count-lines.ps1`
- `scripts/pre-commit-checks.ps1` — Script PowerShell para executar verificações automáticas antes de fazer commit (console.log, código morto, estrutura de arquivos, etc.). Execução: `powershell -ExecutionPolicy Bypass -File scripts\pre-commit-checks.ps1`
- `scripts/pre-commit-checks.md` — Documentação completa da rotina de verificações pré-commit com checklist manual

Boas práticas (mínimas):
- Use cache-busting `?v=X.Y.Z` ao atualizar CSS/JS para evitar problemas de cache.
- Evite deixar `console.log` ou código morto no repositório público.
- Preserve comentários que ajudem novos leitores a entender o projeto.
- Após modificar código significativamente, execute `scripts/count-lines.ps1` para atualizar estatísticas na página "Sobre o Projeto".

## Convenções de Código

### Sistema de Versionamento e Cache
**SEMPRE** use cache busting nos links CSS/JS:
```html
<link rel="stylesheet" href="arquivo.css?v=1.0.0">
<script src="arquivo.js?v=1.0.0"></script>
```
Incremente `?v=X.X.X` quando modificar arquivos. Meta tags anti-cache obrigatórias em todas as páginas HTML.

### Limpeza de Código (Clean Code)
- **NUNCA** deixe `console.log` no código de produção.
- **NUNCA** deixe trechos de código comentados (dead code).
- Remova funções não utilizadas.
- Mantenha o código limpo e legível.

### Comentários Extremamente Detalhados
Este projeto usa **documentação inline educacional em português**. NUNCA remova comentários existentes. Ao adicionar código:
- **TODAS as linhas devem ser comentadas** explicando o que fazem e por quê
- Blocos de comentário `/* ========== */` para seções principais
- Comentários linha por linha para funções complexas
- Explique **POR QUÊ** cada decisão, não apenas O QUÊ
- Use português claro e didático, como se estivesse ensinando um iniciante
- Exemplo do padrão: veja `mutuo-script.js`, `helice-script.js`, `solar-script.js` - todas as funções principais têm comentários linha por linha
- Para funções matemáticas/financeiras, explique as fórmulas e dê exemplos práticos

### Internacionalização (i18n)
A calculadora usa sistema custom de tradução PT-BR/IT-IT:
- **Idioma padrão**: PT-BR (Português do Brasil)
- **HTML**: `data-i18n="translation-key"` para texto estático
- **JavaScript**: dicionário `traducoes` objeto com duas keys `'pt-BR'` e `'it-IT'`
- Moeda auto-switch: BRL (pt-BR) ↔ EUR (it-IT)
- Sempre forneça traduções completas ao adicionar texto novo
- **Inicialização**: `trocarIdioma('pt-BR')` no DOMContentLoaded

IMPORTANT NOTE: The project uses a single, standardized localStorage key for language persistence: `idiomaPreferido`. Avoid creating per-app language keys (e.g. `idiomaSolar`).

Accessibility:
- Decorative SVG icons should include `aria-hidden="true"` and meaningful images (logos) should include `role="img"` + a `<title>`.

### Formatação de Números
- Português: `100.000,50` (ponto = milhares, vírgula = decimal)
- Italiano: `100.000,50` (mesmo formato)
- Use `toLocaleString(idiomaAtual)` para formatação automática
- Função `obterValorNumericoFormatado()` para parsing

### Mobile-First + Responsividade
Base = iPhone (375×667px), escala para tablets (768×1024px):
```css
/* Base mobile */
.elemento { width: 375px; }

/* Tablet+ */
@media (min-width: 768px) {
    .elemento { width: 768px; }
}
```

## Padrões Importantes

### Estrutura de App Individual
```
app-folder/
  ├── app-name.html           # Página principal
  ├── app-name-script.js      # Lógica
  └── app-name-styles.css     # Estilos
```

### Links e Navegação
Sempre use caminhos relativos da raiz: `href="mutuo/mutuo.html"` ou `href="sobre/sobre.html"`

### Gradientes e Visual Branding
- **Background dos Apps**: Cor sólida `#4e7262` (Verde Engenharia Nata) para padronização visual com a tela inicial.
- **Tela Inicial**: Imagem de fundo ou gradiente conforme `index-styles.css`.
- Logo "ENGENHARIA NATA" no dock: fonte Courier New, cor `#00ff88`, efeito glow
- Ícones SVG com gradientes personalizados por app:
  - Verde (`#4CAF50` → `#2E7D32`) para finanças (Mutuo)
  - Azul claro (`#64B5F6` → `#2196F3`) para informação (About Me)

### Botão Home Fixo (Padrão Universal)
Todos os apps devem ter botão home centralizado no rodapé:
```css
.home-button-fixed {
    position: fixed;
    bottom: 30px;           /* 20px no mobile */
    left: 50%;
    transform: translateX(-50%);  /* Centraliza horizontalmente */
    width: 60px;            /* 50px no mobile */
    height: 60px;
    background: linear-gradient(135deg, #667eea 0%, #2d9fa3ff 100%);
    border-radius: 50%;
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
    z-index: 1000;
}

.home-button-fixed:hover {
    transform: translateX(-50%) scale(1.1);  /* Mantém centralizado ao escalar */
    box-shadow: 0 12px 30px rgba(91, 243, 172, 0.6);
}

/* Ajuste de padding no body para não cobrir conteúdo */
@media (max-width: 480px) {
    body {
        padding-bottom: 110px; /* Espaço extra para o botão home */
    }
}
```

**HTML padrão:**
```html
<!-- Botão de retorno à tela inicial (fixo centralizado no rodapé) -->
<!-- Fica sempre visível enquanto rola a página -->
<a href="../index.html" class="home-button-fixed">
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
    </svg>
</a>
```

### Controles de Formulário com Setas
Padrão de botões incrementais/decrementais (veja `mutuo-script.js`):
- `ajustarValor(targetId, step)` com limites máximos de segurança
- `mousedown` → inicia repetição após 500ms, depois 100ms/ciclo
- `mouseup`/`mouseleave` → limpa intervalos

### Chart.js Integration
Calculadora usa Chart.js 3.x para gráficos de linha/área:
- Datasets: juros acumulados (vermelho), amortização (verde)
- Sempre inclua `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>` antes do app script

## Fórmulas Financeiras dos Sistemas de Amortização

### Tabela Price (Sistema Francês / Ammortamento alla Francese)
**Uso**: Brasil (empréstimos pessoais, consignados), Itália (mutui - mais comum)
**Característica**: Parcelas fixas (PMT constante)
**Nomes usados no app**: "Tabela Price" (PT) / "Francese" (IT)

```javascript
// Fórmula da parcela fixa (PMT)
const fator = Math.pow(1 + taxaMensal, numeroParcelas);
const parcelaFixa = valorEmprestimo * (taxaMensal * fator) / (fator - 1);

// Para cada parcela:
const juros = saldoDevedor * taxaMensal;
const amortizacao = parcelaFixa - juros;
saldoDevedor -= amortizacao;
```

**Comportamento**: No início, paga mais juros e menos amortização. Com o tempo inverte: menos juros, mais amortização.

### SAC (Sistema de Amortização Constante / Ammortamento all'Italiana)
**Uso**: Brasil (financiamento imobiliário), Itália
**Característica**: Amortização constante
**Nomes usados no app**: "SAC" (PT) / "Italiana" (IT)

```javascript
// Amortização fixa
const amortizacaoConstante = valorEmprestimo / numeroParcelas;

// Para cada parcela:
const juros = saldoDevedor * taxaMensal;
const valorParcela = amortizacaoConstante + juros;
saldoDevedor -= amortizacaoConstante;
```

**Comportamento**: Parcelas começam altas e diminuem ao longo do tempo. Paga menos juros no total.

### Sistema Americano (Alemão / Tedesco)
**Uso**: Raro no Brasil, ocasional na Itália para investidores
**Característica**: Paga só juros durante o período, principal no final
**Nomes usados no app**: "Sistema Americano" (PT) / "Tedesco" (IT)

```javascript
const jurosMensal = valorEmprestimo * taxaMensal;

// Parcelas 1 a n-1: apenas juros
valorParcela = jurosMensal;
amortizacao = 0;
saldoDevedor = valorEmprestimo;

// Última parcela: principal + juros
valorParcela = valorEmprestimo + jurosMensal;
amortizacao = valorEmprestimo;
saldoDevedor = 0;
```

**Comportamento**: Maior total de juros. Requer capacidade de pagar valor integral no final.

### Conversão de Taxas
```javascript
// Taxa anual → mensal (juros compostos)
taxaMensal = Math.pow(1 + taxaAnual / 100, 1/12) - 1;

// Taxa mensal → mensal
taxaMensal = taxa / 100;

// Taxa diária → mensal (assumindo 30 dias)
taxaMensal = Math.pow(1 + taxaDiaria / 100, 30) - 1;
```

## Comandos e Debugging

**Sem build step**: abrir `index.html` direto no navegador (Live Server recomendado no VS Code).

### Testar Localmente
```powershell
# Abrir diretamente no navegador padrão (PowerShell)
Start-Process "index.html"

# Ou usar Live Server do VS Code (recomendado para hot reload)
# Extensão: ritwickdey.LiveServer
```

### Testar em Mobile Real
```powershell
# Opção 1: ngrok (após instalar)
npx http-server -p 8080
ngrok http 8080

# Opção 2: GitHub Pages (push para repo)
# Acesse: https://usuario.github.io/repo-name/
```

### Browser Compatibility Testing
- **Target browsers**: Chrome 90+, Safari 14+, Firefox 88+, Edge 90+
- **Recursos críticos**: CSS Grid, Flexbox, `toLocaleString()`, Chart.js
- **Fallbacks**: Não implementados (assume navegadores modernos)

### Debugging i18n
```javascript
// Verificar traduções carregadas
console.log(traducoes[idiomaAtual]);

// Verificar elementos não traduzidos
document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (!traducoes[idiomaAtual][key]) {
        console.warn(`Missing translation: ${key} for ${idiomaAtual}`);
    }
});
```

## Estrutura de Adicionar Novo App

Para adicionar um novo aplicativo ao portfólio:

### 1. Criar Pasta e Arquivos
```
novo-app/
  ├── novo-app.html
  ├── novo-app-script.js
  └── novo-app-styles.css
```

### 2. Modelo Mínimo HTML
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>Novo App</title>
    <link rel="stylesheet" href="novo-app-styles.css?v=1.0.0">
</head>
<body>
    <!-- Conteúdo aqui -->
    
    <!-- Botão de retorno à tela inicial (fixo centralizado no rodapé) -->
    <!-- Fica sempre visível enquanto rola a página -->
    <a href="../index.html" class="home-button-fixed">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
    </a>
    
    <script src="novo-app-script.js?v=1.0.0"></script>
</body>
</html>
```

### 3. Adicionar Ícone em `index.html`
```html
<a href="novo-app/novo-app.html" class="app-icon">
    <div class="icon">
        <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="gradient-novo" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#FF6B6B;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#C44569;stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="60" height="60" rx="12" fill="url(#gradient-novo)"/>
            <text x="30" y="40" font-size="28" text-anchor="middle">🎯</text>
        </svg>
    </div>
    <span class="app-name">Novo App</span>
</a>
```

### 4. CSS Base (copiar estrutura de mutuo-styles.css)
- Reset global (`* { margin: 0; padding: 0; box-sizing: border-box; }`)
- Body com background `#4e7262` (Verde Engenharia Nata)
- Recipiente centralizado (`max-width: 900px`)
- Botão home fixo centralizado (ver seção "Botão Home Fixo")
- Media queries para tablet (`@media (min-width: 768px)`)
- Padding bottom extra para mobile (`padding-bottom: 110px`)

## Regras de Edição

1. **Preserve TODOS os comentários** educacionais existentes - eles são parte essencial do projeto
2. **Ao adicionar código novo, comente CADA linha** explicando o que faz e por quê
3. **Use português** para todos os comentários e nomes de variáveis/funções quando possível
4. Incremente versões de cache (`?v=X.X.X`) ao modificar CSS/JS
5. Teste em português E italiano antes de finalizar (se bilíngue)
6. Mobile-first: valide em 375px width primeiro
7. Mantenha acessibilidade: use labels/aria quando apropriado
8. Limite valores com segurança (veja `ajustarValor()` - MAX_VALOR, MAX_TAXA)
9. Use `toLocaleString(idiomaAtual)` para formatação automática de números
10. O dimensionamento de baterias usa capacidade em kWh por padrão (ex.: 48V x 100Ah ≈ 4.8 kWh para LiFePO4)
11. A página de configuração do Solar permite ajustar especificações — sliders de peso até **180 kg**, inversor mínimo **1 kW**
12. Sempre destrua gráficos Chart.js antes de recriar (`chart.destroy()`)
13. **Botão home sempre centralizado** usando `left: 50%` + `transform: translateX(-50%)`
14. Use seletor CSS correto `.app-icon` (não `.icone-app`) para ícones na home
15. **Limpeza**: Remova `console.log` e código comentado antes de finalizar
16. **Documentação**: Mantenha README.md, GLOSSARIO.md e copilot-instructions.md atualizados
17. **Badges DEV**: Apps em desenvolvimento devem ter badge "DEV" no ícone (classe `icon-dev`) e marca d'água dentro do app (`.watermark-dev` e `.dev-badge-header`)
18. **Apps com badge DEV**: Fazenda (em desenvolvimento). Ar Condicionado e Aquecedor Solar estão completos.
19. **Memorial de Cálculo**: Todos os apps educativos devem incluir seção de memorial didático que explica passo a passo os cálculos realizados. O memorial deve incluir:
    - **Fórmulas utilizadas** — Todas as fórmulas matemáticas e físicas aplicadas
    - **Valores de referência** — Constantes físicas, fatores de segurança e valores arbitrados utilizados (ex.: resistividade do cobre 0.0175 Ω·mm²/m, HSP 5h, eficiência 80%, etc.)
    - **Leis físicas** — Explicações leigas das leis físicas aplicadas (Lei de Ohm, conservação de energia, transferência de calor, etc.)
    - **Exemplos práticos** — Cálculos passo a passo com os valores atuais do usuário
    - **Resumo dos resultados** — Valores calculados organizados de forma clara
    - Implementar com seção escondida (`display: none`), botão "SAIBA MAIS!" e funções `toggleMemorial()` e `atualizarMemorialComValores()`
20. **Valores de Referência**: Sempre documente valores arbitrados ou de referência usados nos cálculos. Exemplos:
    - Resistividade do cobre: 0.0175 Ω·mm²/m (constante física)
    - HSP (Horas de Sol Pleno): 5h/dia (valor médio para Brasil)
    - Eficiência do sistema solar: 80% (considera perdas de 20%)
    - BTU por m²: 700 BTU/m² (padrão ASHRAE, ajustado por fator de altura)
    - Fator de Altura: Altura (m) ÷ 2.7 m (padrão residencial)
    - Sistema Multi-Split: dimensiona unidades internas (até 60k BTU cada) e externas (até 180k BTU cada)
    - Limites: 1-8 ambientes, 10-300 m² área total
    - Constante de conversão hélice: 1056 (padrão indústria náutica)
21. **Leis Físicas**: Sempre explique de forma leiga as leis físicas aplicadas nos cálculos. Consulte `GLOSSARIO.md` para explicações padrão de Lei de Ohm, Conservação de Energia, Transferência de Calor, etc.

## Versões Atuais dos Arquivos

Mantenha sempre atualizado ao modificar:

```
index.html                           → index-styles.css?v=1.2.2
                                     → index-script.js?v=1.2.0
                                     → site-config.js?v=1.0.0

mutuo/mutuo.html                     → mutuo-styles.css?v=1.2.5
                                     → mutuo-script.js?v=1.1.1 (2055 linhas, totalmente comentado)

helice/helice.html                   → helice-styles.css?v=1.5.6
                                     → helice-script.js?v=1.4.0 (1094 linhas, totalmente comentado)

solar/solar.html                     → solar-styles.css?v=1.2.0
                                     → solar-script.js?v=1.2.0 (com memorial de cálculo didático)

solar/config.html                    → config-script.js?v=1.0.5

bitola/bitola.html                   → bitola-styles.css?v=1.0.0
                                     → bitola-script.js?v=1.0.0

arcondicionado/arcondicionado.html   → arcondicionado-styles.css?v=1.0.0
                                     → arcondicionado-script.js?v=1.0.0

aquecimento/aquecimento.html         → aquecimento-styles.css?v=1.0.0
                                     → aquecimento-script.js?v=1.0.0

fazenda/fazenda.html                 → fazenda-styles.css?v=1.0.0
                                     → fazenda-script.js?v=1.0.0 (759 linhas, totalmente comentado)

sobre/sobre.html                     → sobre-styles.css?v=1.5.8
                                     → sobre-script.js?v=1.3.4
```

**Nota**: Todos os arquivos JavaScript principais foram refatorados com comentários detalhados em português para fins educacionais. O código mantém a funcionalidade original mas agora é muito mais didático e fácil de entender para iniciantes.
