# Mensagem de Commit

## Padronização de Ícones de Informação e Atualização de Referências

### ✨ Nova Funcionalidade: Sistema Padronizado de Ícones de Informação
- **Implementado sistema global de ícones de informação (ℹ️)** com descrições toggle em todos os controles de entrada
- **CSS Global**: Adicionadas classes `.info-icon` e `.descricao-info` em `assets/css/shared-styles.css` para padronização visual
- **JavaScript Global**: Criada função `inicializarIconeInfo(iconId, descricaoId, opcoes)` em `assets/js/site-config.js` para inicialização padronizada
- **Apps Atualizados**:
  - ✅ **Solar**: Ícones de informação em todos os controles principais (Consumo, Autonomia, Vida Útil, Preço kWh, Aumento Anual, Preço Bateria, Período de Análise)
  - ✅ **Bitola**: Ícones de informação em Potência, Distância, Tensão CC e Queda de Tensão
  - ✅ **Hélice**: Ícones de informação em Velocidade, Redução, RPM e Slip
- **Traduções Completas**: Todas as descrições traduzidas para PT-BR e IT-IT
- **UX Melhorada**: Descrições aparecem/desaparecem discretamente abaixo do label, acima do slider, com espaçamento adequado para evitar toques indesejados

### 🌍 Atualização de Referências Bibliográficas (Bitola - Italiano)
- **Normas Italianas Oficiais**: Atualizada seção de referências bibliográficas no memorial de cálculo para usar normas oficiais italianas quando o idioma está em italiano
- **CEI 64-8 (9ª edição, 2024)**: Referência oficial italiana para instalações elétricas de baixa tensão
- **CEI 20-29**: Norma italiana para condutores elétricos de cobre (equivalente à IEC 60228)
- **Fontes Italianas**: Atualizadas fontes de consulta para incluir CEI (ceinorme.it) e UNI (uni.com)
- **Descrição Tooltip**: Atualizada descrição de "Queda de Tensão Máxima" em italiano para referenciar CEI 64-8 ao invés de normas brasileiras

### 📝 Arquivos Modificados

#### Apps
- `bitola/bitola-script.js` (v1.2.0): 
  - Adicionadas traduções para ícones de informação
  - Adicionadas traduções completas de referências bibliográficas em italiano com normas oficiais
  - Inicialização de ícones de informação
- `bitola/bitola.html`: 
  - Estrutura HTML atualizada com ícones de informação e descrições
  - Seção de referências bibliográficas convertida para tradução dinâmica
- `helice/helice-script.js` (v1.6.0): 
  - Adicionadas traduções para ícones de informação
  - Inicialização de ícones de informação
- `helice/helice.html`: 
  - Estrutura HTML atualizada com ícones de informação e descrições
- `solar/solar-script.js` (v1.20.0): 
  - Já tinha ícones de informação implementados anteriormente
- `solar/solar.html`: 
  - Versão do ajustarValorUtil atualizada para 1.1.0

#### Assets Compartilhados
- `assets/css/shared-styles.css`: 
  - Classes globais `.info-icon` e `.descricao-info` já implementadas anteriormente
- `assets/js/site-config.js`: 
  - Função `inicializarIconeInfo()` já implementada anteriormente

#### Configuração e Documentação
- `config/versions.json`: 
  - Versões atualizadas: bitola.js (1.2.0), helice.js (1.6.0), solar.js (1.20.0), site-config (1.2.0), ajustarValorUtil (1.1.0)
- `README.md`: 
  - Adicionada menção ao sistema de ícones de informação padronizados
  - Adicionada função `inicializarIconeInfo` na documentação de funções globais

### ✅ Verificações Realizadas
- Cache-busting atualizado em arquivos modificados
- Traduções completas em PT-BR e IT-IT
- Estrutura HTML consistente entre apps
- Versões sincronizadas entre HTML e config/versions.json

### 📋 Próximos Passos (Opcional)
- Aplicar padrão de ícones de informação nos apps restantes: Mútuo, Ar Condicionado, Aquecimento
- Continuar padronização de referências bibliográficas em outros apps quando em italiano
