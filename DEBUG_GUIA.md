# Guia de Debug - Problema com Sliders e Resultados

## Passo 1: Abrir o Console do Navegador

1. Pressione **F12** ou **Ctrl+Shift+I** (Windows/Linux) ou **Cmd+Option+I** (Mac)
2. Vá para a aba **Console**

## Passo 2: Verificar Logs de Inicialização

Ao carregar a página, você deve ver no console:

```
[Ar Condicionado] DOMContentLoaded iniciado
[Ar Condicionado] Sliders encontrados: {sliderArea: true, sliderAltura: true, ...}
[Ar Condicionado] Anexando listener ao sliderArea
[Ar Condicionado] Chamando atualizarResultados() na inicialização
[Ar Condicionado] atualizarResultados() chamado
```

**Se não aparecer**: O script não está sendo executado. Verifique:
- Se há erros JavaScript no console
- Se o arquivo `arcondicionado-script.js` está sendo carregado (verifique na aba Network)

## Passo 3: Verificar se os Elementos Existem

No console, execute este código:

```javascript
// Verifica se os sliders existem
console.log('sliderArea:', document.getElementById('sliderArea'));
console.log('sliderAltura:', document.getElementById('sliderAltura'));

// Verifica se os elementos de resultado existem
console.log('custoSistemaMultisplit:', document.getElementById('custoSistemaMultisplit'));
console.log('btuTotalMultisplit:', document.getElementById('btuTotalMultisplit'));
console.log('unidadeExternaMultisplit:', document.getElementById('unidadeExternaMultisplit'));
console.log('unidadesInternasMultisplit:', document.getElementById('unidadesInternasMultisplit'));
```

**Se algum retornar `null`**: O elemento não existe no HTML. Verifique se o ID está correto.

## Passo 4: Testar Movimento do Slider

1. Mova o slider de área
2. No console, deve aparecer:
   ```
   [Ar Condicionado] sliderArea alterado: [valor]
   [Ar Condicionado] atualizarResultados() chamado
   [Ar Condicionado] Valores de entrada: {...}
   [Ar Condicionado] resultadoMultisplit calculado: {...}
   [Ar Condicionado] Elementos de resultado encontrados: {...}
   [Ar Condicionado] Atualizando custoSistemaMultisplit: [valor formatado]
   [Ar Condicionado] atualizarResultados() concluído com sucesso
   ```

**Se não aparecer o log do slider**: O event listener não está funcionando. Pode ser problema com o throttle.

## Passo 5: Testar Cálculo Manual

No console, execute:

```javascript
// Simula chamada direta da função
if (typeof atualizarResultados === 'function') {
    atualizarResultados();
} else {
    console.error('Função atualizarResultados não encontrada!');
}
```

## Passo 6: Verificar Erros

Se houver erros, eles aparecerão no console com prefixo `[Ar Condicionado]`. Os erros mais comuns são:

- **TypeError: Cannot read properties of null**: Elemento DOM não encontrado
- **TypeError: Cannot read properties of undefined**: Variável não definida
- **ReferenceError**: Função ou variável não existe

## Passo 7: Verificar se throttle está funcionando

No console, execute:

```javascript
// Verifica se throttle está disponível
console.log('throttle:', typeof throttle);

// Se não estiver disponível, pode ser problema com site-config.js
```

## Coletando Informações para Debug

Execute este código no console e copie o resultado:

```javascript
const debugInfo = {
    timestamp: new Date().toISOString(),
    sliders: {
        sliderArea: !!document.getElementById('sliderArea'),
        sliderAltura: !!document.getElementById('sliderAltura'),
        sliderPessoas: !!document.getElementById('sliderPessoas'),
        sliderEquipamentos: !!document.getElementById('sliderEquipamentos')
    },
    elementosResultado: {
        custoSistemaMultisplit: !!document.getElementById('custoSistemaMultisplit'),
        btuTotalMultisplit: !!document.getElementById('btuTotalMultisplit'),
        unidadeExternaMultisplit: !!document.getElementById('unidadeExternaMultisplit'),
        unidadesInternasMultisplit: !!document.getElementById('unidadesInternasMultisplit')
    },
    funcoes: {
        atualizarResultados: typeof atualizarResultados,
        throttle: typeof throttle,
        calcularSistemaMultisplit: typeof calcularSistemaMultisplit
    }
};
console.log('=== DEBUG INFO ===');
console.log(JSON.stringify(debugInfo, null, 2));
```

Copie essa informação e envie ao desenvolvedor.

