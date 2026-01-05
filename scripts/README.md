# Scripts de Migração

Esta pasta contém scripts e documentação para auxiliar na migração dos apps para o novo esquema modular.

## Arquivos

### Documentação
- **migration-guide.md** - Guia completo de migração com padrões e exemplos

### Scripts de Verificação
- **migration-checker.js** - Verifica se um app específico foi migrado corretamente
- **check-all-migrations.js** - Verifica o status de migração de todos os apps

## Uso

### Verificar um app específico

```bash
node scripts/migration-checker.js <nome-do-app>
```

Exemplo:
```bash
node scripts/migration-checker.js bitola
```

Ou usando npm:
```bash
cd scripts
npm run check-migration bitola
```

### Verificar todos os apps

```bash
node scripts/check-all-migrations.js
```

Ou usando npm:
```bash
cd scripts
npm run check-all-migrations
```

## O que o checker verifica

### ✅ Sucessos
- Imports corretos (App, i18n, formatters, input-handlers)
- Estrutura de classe correta (extends App)
- Callbacks configurados (aoInicializar, aoTrocarIdioma)
- Uso de configurarInputComSlider
- Uso de obterValorReal
- Uso de limparValorReal
- Listeners de slider configurados

### ⚠️ Avisos
- Leituras diretas de slider (considere usar obterValorReal)
- Funções não encontradas mas não críticas

### ❌ Erros
- Imports obrigatórios faltando
- Classe não estende App corretamente
- Callbacks não configurados
- configurarInputComSlider não está sendo usado

## Status de Migração

### Apps Migrados ✅
- [x] index - Página inicial
- [x] sobre - Sobre o projeto
- [x] bitola - Calculadora de bitola de fios
- [x] arcondicionado - Dimensionador de ar condicionado
- [x] aquecimento - Dimensionador de aquecedor solar térmico
- [x] helice - Calculadora de passo de hélice
- [x] mutuo - Calculadora de empréstimos
- [x] bugs - Página de bugs/feedback

### Apps Pendentes ⏳
- [ ] fazenda - Dimensionador de fazenda auto-sustentável (1708 linhas)
- [ ] solar - Dimensionador de sistema fotovoltaico (3052 linhas)

## Próximos Passos

1. Consulte o **migration-guide.md** para entender o padrão
2. Escolha um app para migrar (recomenda-se começar pelo mais simples)
3. Crie o arquivo `[nome]-script-new.js` seguindo o guia
4. Execute `migration-checker.js` para verificar a migração
5. Corrija os erros apontados
6. Teste o app no navegador
7. Atualize o HTML para usar o novo script

## Benefícios da Migração

### Inputs Melhorados
- ✅ Aceita valores fora dos limites do slider
- ✅ Funciona com Enter (não precisa blur)
- ✅ Sincronização inteligente com slider
- ✅ Armazena valor real no dataset

### Código Mais Limpo
- 🎯 Utilitários reutilizáveis
- 🎯 Lógica centralizada
- 🎯 Fácil manutenção
- 🎯 Consistência entre apps

### Melhor UX
- 🚀 Interface mais responsiva
- 🚀 Menos cliques necessários
- 🚀 Comportamento previsível
- 🚀 Sem limitações artificiais

## Exemplos de Referência

Consulte os seguintes arquivos para ver implementações completas:

1. **bitola/bitola-script-new.js** - Exemplo mais recente e completo
2. **helice/helice-script-new.js** - Múltiplos inputs e gráfico
3. **arcondicionado/arcondicionado-script-new.js** - App complexo com múltiplas seções
4. **mutuo/mutuo-script-new.js** - Formatação de moeda e tabelas

## Dúvidas?

Consulte o `migration-guide.md` para:
- Estrutura completa do arquivo
- Padrões de código
- Checklist de migração
- Exemplos detalhados
