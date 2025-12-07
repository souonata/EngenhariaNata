# Glossário breve — termos úteis (simples)

Aqui estão definições curtas para ajudar visitantes não técnicos a entender o site e os apps.

- kWh — quilo-watt-hora, unidade de energia usada para capacidade de baterias (ex.: 4.8 kWh significa 4,8 kW por 1 hora).
- Painel (solar) — dispositivo que converte luz do sol em eletricidade; tem potência em watts (ex.: 400 W).
- Bateria — armazena energia elétrica; neste site comparamos baterias AGM (chumbo-ácido) e LiFePO₄ (lítio).
- Inversor — equipamento que transforma tensão CC (bateria) em CA (tomada de casa).
- Autonomia — quantas horas/dias a bateria pode alimentar o consumo sem carregar.
- DoD (Depth of Discharge) — profundidade de descarga: quanto da bateria é utilizado; menor DoD tende a aumentar vida útil.
- Slider — controle deslizante na interface para ajustar valores (ex.: peso, preço, capacidade).
- localStorage — pequena área de armazenamento no navegador; o app usa `configSolar` para guardar as configurações do Solar e `idiomaPreferido` para lembrar o idioma.

Se quiser uma explicação mais técnica, veja o código fonte (cada app tem comentários educativos) ou abra um issue com o termo que deseja entender melhor.
- `window` = janela do navegador
- `console` = console (para debugar)
- `addEventListener` = adicionar ouvinte de evento
- `querySelector` = buscar elemento
- `getElementById` = pegar elemento por ID

### HTML
- `<div>` = divisão (caixa genérica)
- `<span>` = espaço (texto inline)
- `<button>` = botão
- `<input>` = entrada
- `<a>` = âncora (link)
- `<img>` = imagem
- `<svg>` = gráfico vetorial
- `<header>` = cabeçalho
- `<footer>` = rodapé
- `<section>` = seção
- `<article>` = artigo
- `<nav>` = navegação
- `<main>` = conteúdo principal
- `<aside>` = conteúdo lateral

### CSS
- `:hover` = ao passar o mouse
- `:active` = ao clicar
- `:focus` = ao focar (campo selecionado)
- `@media` = regra de responsividade
- `@keyframes` = animação
- `linear-gradient()` = gradiente linear
- `rgba()` = cor com transparência

---

## 🎯 **Conceitos Importantes**

### Mobile-First
Estratégia de design que começa pelo celular e depois adapta para telas maiores.

### Responsividade
Capacidade de um site se adaptar a diferentes tamanhos de tela (celular, tablet, desktop).

### Cache Busting
Técnica para forçar o navegador a baixar arquivos atualizados usando `?v=X.X.X` — incremente o número quando modificar CSS/JS.

### i18n (Internacionalização)
Sistema para traduzir aplicações para múltiplos idiomas.

### Sistema de Amortização
Método de pagamento de empréstimos:
- **SAC**: Amortização constante, parcelas decrescentes
- **Price**: Parcelas fixas (mais comum)
- **Americano**: Só juros + principal no final

---

## 📖 **Referências Adicionais**

Para aprender mais, consulte:
- `copilot-instructions.md` - Documentação completa do projeto
- `sobre/` - Visão geral e guias de desenvolvimento
- `<section>` = seção
- `<article>` = artigo

### CSS
- Todas as propriedades CSS são em inglês e não podem ser traduzidas

---

## 💡 **Dica de Ouro**

Quando você ver uma palavra em inglês no código:

1. **É uma palavra reservada?** (JavaScript: function, const, if | HTML: div, span)
   - ✋ **NÃO MUDE!** A linguagem não vai entender

2. **É um nome escolhido pelo programador?** (classes: .app-icon, funções: updateTime)
   - 👍 **PODE TRADUZIR!** Isso ajuda a entender o código

3. **Na dúvida?** Procure neste glossário! 📚

---

## 🎮 **Exercício Prático**

Tente ler este código e traduzir só o que pode:

```javascript
function calcularSoma(primeiroNumero, segundoNumero) {
    const resultado = primeiroNumero + segundoNumero;
    return resultado;
}
```

**Pode traduzir:**
- `calcularSoma` = nome da função (escolhido pelo programador)
- `primeiroNumero` = nome da variável
- `segundoNumero` = nome da variável  
- `resultado` = nome da variável

**NÃO pode traduzir:**
- `function` = palavra reservada do JavaScript
- `const` = palavra reservada do JavaScript
- `return` = palavra reservada do JavaScript

---

✨ **Lembre-se**: Programar é como aprender uma nova língua. Algumas palavras você traduz, outras você aprende o significado em inglês!
