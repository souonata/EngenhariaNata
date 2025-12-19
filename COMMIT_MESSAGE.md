# Mensagem de Commit

## Correções e Melhorias Implementadas

### 🔧 Correção Crítica: Compatibilidade com file:///
- **Problema**: Scripts com `type="module"` não funcionavam quando abertos diretamente do sistema de arquivos devido a políticas CORS
- **Solução**: 
  - Removido `type="module"` de todos os HTMLs
  - Convertido `ajustarValorUtil.js` para função global (removido export ES6)
  - Adicionado script `ajustarValorUtil.js` antes dos scripts principais em todos os apps

### 🎯 Melhorias nos Sliders
- **Throttle melhorado**: Implementado trailing edge para garantir que o último evento seja sempre processado
- **Listener 'change' adicional**: Adicionado em todos os sliders para garantir que valores finais sejam sempre atualizados quando o usuário solta o slider
- **Correção**: Sliders não travavam mais em valores anteriores ao limite quando movidos rapidamente

### 📊 Correções de Exibição
- **Bitola**: Corrigida formatação de área mínima e bitola comercial (removido uso de sufixos k/M/m)
- **Aquecimento**: Termossifões agora exibidos em formato de lista ao invés de texto corrido

### 📝 Arquivos Modificados
- `assets/js/site-config.js` (v1.2.0): Throttle melhorado com trailing edge
- `assets/js/ajustarValorUtil.js` (v1.1.0): Convertido para função global
- `arcondicionado/arcondicionado-script.js` (v1.1.0): Listeners change adicionados, logs de debug removidos
- `arcondicionado/arcondicionado.html`: Scripts atualizados
- `bitola/bitola-script.js` (v1.1.0): Formatação corrigida
- `bitola/bitola.html`: Scripts atualizados
- `aquecimento/aquecimento-script.js` (v1.1.0): Lista de termossifões
- `aquecimento/aquecimento.html`: Layout e scripts atualizados
- `helice/helice-script.js` (v1.4.3): Import removido
- `helice/helice.html`: Scripts atualizados
- `solar/config-script.js` (v1.0.9): Import removido
- `solar/config.html`: Scripts atualizados

### ✅ Verificações
- Cache-busting atualizado em todos os arquivos HTML
- Console.log de debug removidos
- Estrutura dos apps verificada e completa

