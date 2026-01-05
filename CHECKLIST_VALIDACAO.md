# ✅ Checklist de Validação - Apps Migrados ES6

## 📋 Validação Geral (Todos os Apps)

### 1. Imports e Estrutura Base
- [ ] ✅ Imports são **named imports**: `{ App }`, `{ i18n }`, `{ formatarNumero }`
- [ ] ✅ Classe extends `App`
- [ ] ✅ Constructor tem `appName: 'nomeapp'`
- [ ] ✅ Constructor tem `callbacks` com `aoInicializar` e `aoTrocarIdioma`
- [ ] ✅ Métodos dos callbacks existem e estão corretos
- [ ] ✅ Estado `estadoBotoes` inclui `delayTimeout`

### 2. Inicialização
- [ ] ✅ Arquivo termina com criação da instância: `const app = new NomeApp()`
- [ ] ✅ Verificação de `document.readyState`
- [ ] ✅ Chamada MANUAL `app.inicializar()` em ambos os casos
- [ ] ✅ Console log de inicialização funciona

### 3. HTML e Scripts
- [ ] ✅ HTML usa `<script type="module" src="app-script-new.js?v=X.X.X"></script>`
- [ ] ✅ Se usa Chart.js, CDN está ANTES do module script
- [ ] ✅ Versão `?v=X.X.X` corresponde ao versions.json
- [ ] ✅ Todos os IDs no JS correspondem exatamente aos IDs no HTML

### 4. Sistema de Idiomas
- [ ] ✅ Arquivo `src/i18n/app.json` existe
- [ ] ✅ JSON tem chaves `pt-BR` e `it-IT`
- [ ] ✅ Todas as strings `data-i18n` do HTML estão no JSON
- [ ] ✅ Trocar idioma atualiza interface corretamente
- [ ] ✅ Valores numéricos mantêm formato após troca

### 5. Sliders e Controles
- [ ] ✅ Todos os sliders têm `id` correto
- [ ] ✅ Inputs correspondentes seguem padrão `inputNome` ↔ `sliderNome`
- [ ] ✅ Sliders atualizam inputs
- [ ] ✅ Inputs manuais atualizam sliders (evento blur)
- [ ] ✅ Enter no input dispara blur

### 6. Botões de Incremento (+/-)
- [ ] ✅ Botões têm `data-target` e `data-step`
- [ ] ✅ Evento `mousedown` e `touchstart` iniciam incremento
- [ ] ✅ Evento `mouseup`, `touchend`, `mouseleave` param incremento
- [ ] ✅ **Primeiro incremento é IMEDIATO**
- [ ] ✅ **Delay de 300ms antes de contínuo**
- [ ] ✅ **valorInicial capturado APÓS primeiro incremento**
- [ ] ✅ Animação usa velocidade linear (range/3000)
- [ ] ✅ Percorre todo range em ~3 segundos quando mantido
- [ ] ✅ Não há "voltada" ao iniciar movimento contínuo

### 7. Info Icons
- [ ] ✅ Icons têm classe `.info-icon`
- [ ] ✅ Descrições têm classe `.descricao-info`
- [ ] ✅ Usa `.closest('.grupo-entrada')` para encontrar container
- [ ] ✅ Usa `.querySelector('.descricao-info')` dentro do grupo
- [ ] ✅ Toggle entre `display: 'block'` e `display: 'none'`
- [ ] ✅ Click no icon mostra/esconde descrição

### 8. Cálculos e Resultados
- [ ] ✅ Função `atualizarResultados()` existe
- [ ] ✅ É chamada em: init, slider change, input blur, troca idioma
- [ ] ✅ Todos os elementos de resultado têm ID correto
- [ ] ✅ `getElementById()` retorna elementos válidos (não null)
- [ ] ✅ Valores calculados são exibidos corretamente
- [ ] ✅ Formatação numérica usa vírgula (pt-BR) ou ponto (it-IT)

### 9. Gráficos Chart.js (se aplicável)
- [ ] ✅ Chart.js CDN carregado ANTES do module
- [ ] ✅ Canvas têm IDs únicos e corretos
- [ ] ✅ Variáveis de gráfico declaradas (ex: `graficoNome`)
- [ ] ✅ Método `inicializarGraficos()` ou similar existe
- [ ] ✅ Gráficos são destruídos antes de recriar
- [ ] ✅ Gráficos atualizam com mudança de valores
- [ ] ✅ Gráficos atualizam com troca de idioma

### 10. Cache e Debugging
- [ ] ✅ Versão incrementada após cada mudança
- [ ] ✅ Testado com Ctrl+Shift+R (hard refresh)
- [ ] ✅ Console.log não tem erros vermelhos
- [ ] ✅ Warnings (amarelo) são esperados e documentados

---

## 📱 Apps Específicos

### ✅ bugs (v1.0.0)
- [x] Google Forms integration funciona
- [x] Campos obrigatórios validam
- [x] Select de categoria funciona
- [x] Botão enviar redireciona corretamente
- [x] Traduções PT-BR e IT-IT completas

### ✅ sobre (v1.3.8)
- [x] Página institucional renderiza
- [x] Seções colapsáveis funcionam
- [x] Links externos abrem
- [x] Imagens/ícones carregam
- [x] Traduções extensivas PT-BR e IT-IT

### ✅ helice (v1.2.2)
- [x] 2 gráficos Chart.js (eficiência, velocidade)
- [x] Canvas IDs: `graficoEficiencia`, `graficoVelocidade`
- [x] Cálculos de hélice náutica corretos
- [x] Sliders: diâmetro, passo, RPM, velocidade
- [x] Botões +/- com 300ms delay funcionam

### ✅ bitola (v1.2.7)
- [x] Select de normas (NBR, NEC, IEC)
- [x] Cálculo de bitola por corrente
- [x] Cálculo de queda de tensão
- [x] Recomendações de segurança
- [x] Múltiplas unidades (mm², AWG)

### ✅ mutuo (v1.2.7)
- [x] 3 sistemas: SAC, Price, Americano
- [x] Conversão entre moedas (BRL ↔ EUR)
- [x] Tabela de amortização
- [x] Gráficos de evolução (se houver)
- [x] Cálculos financeiros precisos

### ✅ index (v1.0.0)
- [x] Landing page carrega
- [x] Relógio tempo real funciona
- [x] Links para todos os apps
- [x] Animações/transições
- [x] Responsivo mobile

### ✅ arcondicionado (v1.0.6)
- [x] 2 gráficos Chart.js (custo, BTU)
- [x] Canvas IDs: `graficoCustoArCondicionado`, `graficoBTUArCondicionado`
- [x] Cálculo BTU multi-split
- [x] Sliders: área, pessoas, temperatura, insolação
- [x] Botões +/- funcionam perfeitamente (6 iterações debug)
- [x] Info icons funcionam
- [x] Sem "voltada" ao segurar botão

---

## 🐛 Problemas Conhecidos por App

### bugs
- ✅ Sem problemas conhecidos

### sobre
- ✅ Sem problemas conhecidos

### helice
- ⚠️ Gráficos podem não renderizar sem Chart.js CDN
- ✅ Corrigido: Chart.js adicionado antes do module

### bitola
- ✅ Sem problemas conhecidos

### mutuo
- ⚠️ Conversão de moeda usa taxa fixa (atualizar periodicamente)
- ℹ️ Documentado: Taxa em site-config.js

### index
- ✅ Sem problemas conhecidos

### arcondicionado
- ✅ Todos os bugs corrigidos após 6 iterações
- ✅ Comportamento de botões otimizado

---

## 🧪 Testes Manuais Obrigatórios

### Para CADA app migrado:

#### 1. Teste de Inicialização
1. Abrir app no navegador
2. Abrir Console (F12)
3. Verificar: `✅ Inicializando NomeApp...`
4. Verificar: `✅ NomeApp inicializado com sucesso!`
5. Sem erros vermelhos no console

#### 2. Teste de Idioma
1. Click no botão 🇧🇷 PT
2. Verificar textos em português
3. Click no botão 🇮🇹 IT
4. Verificar textos em italiano
5. Valores numéricos mantêm formato

#### 3. Teste de Sliders
1. Arrastar cada slider
2. Verificar input atualiza
3. Verificar resultados atualizam
4. Valores dentro do range

#### 4. Teste de Inputs Manuais
1. Click em input
2. Digitar valor válido
3. Pressionar Enter ou click fora
4. Verificar slider atualiza
5. Verificar resultados atualizam

#### 5. Teste de Botões +/-
1. **Click único**: incrementa/decrementa 1 passo
2. **Segurar 1s**: aguarda 300ms → inicia movimento contínuo
3. **Segurar 3s**: percorre boa parte do range
4. **Soltar**: para imediatamente
5. **Não há "voltada"** ao iniciar movimento contínuo

#### 6. Teste de Info Icons
1. Click em cada ℹ️
2. Verificar descrição aparece
3. Click novamente
4. Verificar descrição desaparece

#### 7. Teste de Gráficos (se houver)
1. Verificar gráficos renderizam
2. Mudar valores
3. Verificar gráficos atualizam
4. Trocar idioma
5. Verificar labels em novo idioma

#### 8. Teste de Cache
1. Fazer mudança no código
2. Incrementar versão: `?v=1.0.X`
3. Pressionar Ctrl+Shift+R
4. Verificar mudança aplicada

---

## 📊 Critérios de Aceitação

Um app está **COMPLETO** quando:

- [ ] ✅ Todos os 10 itens da validação geral passam
- [ ] ✅ Todos os testes manuais passam
- [ ] ✅ Console não tem erros críticos
- [ ] ✅ Funcionalidade idêntica ao original
- [ ] ✅ Performance igual ou melhor
- [ ] ✅ Código organizado e comentado
- [ ] ✅ Versão atualizada em versions.json
- [ ] ✅ Documentado em PADRAO_MIGRACAO_ES6.md

---

## 🎯 Status Atual

### ✅ Apps Validados e Completos (7/10)
1. **bugs** - 100% validado
2. **sobre** - 100% validado
3. **helice** - 100% validado
4. **bitola** - 100% validado
5. **mutuo** - 100% validado
6. **index** - 100% validado
7. **arcondicionado** - 100% validado (6 iterações debug)

### ⏳ Apps Pendentes (3/10)
- **aquecimento** - Mantém script original
- **solar** - Mantém script original
- **fazenda** - Mantém script original

---

**Última atualização:** Janeiro 2026  
**Progresso:** 7/10 apps (70%) validados e funcionais
