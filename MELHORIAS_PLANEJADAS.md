# Plano de Melhorias - Engenharia NATA

## Status das Melhorias Planejadas

### ✅ JÁ IMPLEMENTADO
- **Mutuo**: Gráficos de evolução (referência para outros apps)
- **Hélice**: Gráfico básico de Passo × Velocidade (precisa melhorias)

### 🔴 ALTA PRIORIDADE - IMEDIATO

#### 1. Gráficos e Visualizações

**1.1 Hélice - Melhorias no Gráfico Existente**
- [ ] Adicionar linha de "RPM máximo do motor" (zona de operação ideal)
- [ ] Mostrar zona de slip esperada (%)
- [ ] Adicionar marcador do ponto atual (passo/velocidade selecionados)
- [ ] Gráfico interativo que atualiza em tempo real

**1.2 Ar Condicionado - Novos Gráficos**
- [ ] Gráfico de barras: Distribuição de carga térmica por ambiente
- [ ] Gráfico de pizza: Proporção de custo (Unidade Externa vs Internas)
- [ ] Tabela comparativa: Modelos de equipamentos com EER/COP

**1.3 Energia Solar - Novos Gráficos**
- [ ] Gráfico de linha: Autonomia da bateria ao longo dos dias sem sol
- [ ] Gráfico de área: Produção solar vs consumo ao longo do dia
- [ ] Mapa de calor: Sazonalidade de geração solar (eficiência por mês)

**1.4 Bitola - Novos Gráficos**
- [ ] Gráfico de linha: Queda de tensão vs distância
- [ ] Tabela comparativa: Diferentes bitolas com peso/custo
- [ ] Visualização do circuito: Diagrama esquemático simples

**1.5 Aquecedor Solar - Novos Gráficos**
- [ ] Gráfico de radiação solar: Insolação média por mês
- [ ] Timeline: Meses do ano vs eficiência do sistema
- [ ] Gráfico de consumo: Demanda diária vs cobertura solar

#### 2. Parâmetros Faltantes - Alta Prioridade

**2.1 Bitola**
- [ ] Tipo de isolamento (PVC, Silicone, etc.)
- [ ] Temperatura ambiente de instalação
- [ ] Fator de agrupamento (múltiplos cabos juntos)
- [ ] Tipo de proteção (eletroduto, bandeja, livre ao ar)

**2.2 Ar Condicionado**
- [ ] Ventilação natural (m³/h de ar externo)
- [ ] Exposição solar (fachada norte, nordeste, etc.)
- [ ] Isolamento das paredes (espessura, material, coeficiente U)
- [ ] Umidade relativa desejada (padrão: 45-55%, mas configurável)

**2.3 Energia Solar**
- [ ] Ângulo de inclinação dos painéis
- [ ] Eficiência dos inversores (%)
- [ ] Temperatura máxima do local
- [ ] Orientação azimute (Norte = 0°)
- [ ] Sombreamento (árvores, prédios próximos em %)

### 🟡 MÉDIA PRIORIDADE - CURTO PRAZO

#### 3. Funcionalidades de UX

**3.1 Exportação PDF**
- [ ] Botão "Exportar Relatório PDF" em todos os apps
- [ ] Incluir: parâmetros, resultados, gráficos, data/hora, recomendações

**3.2 Comparar Cenários**
- [ ] Botão "Comparar Cenários" em cada app
- [ ] Salvar múltiplos cálculos
- [ ] Comparação lado-a-lado

**3.3 Histórico de Cálculos**
- [ ] Salvar últimos 5-10 cálculos no localStorage
- [ ] Permitir carregar cálculo anterior rapidamente

**3.4 Sobre Este Cálculo**
- [ ] Botão "i" (informação) explicando:
  - Fórmulas utilizadas
  - Normas/padrões seguidos (NBR, IEC, etc.)
  - Limitações do app
  - Recomendações de segurança

### 🟢 BAIXA PRIORIDADE - MÉDIO PRAZO

#### 4. Parâmetros Adicionais

**4.1 Aquecedor Solar**
- [ ] Tipo de tubulação (cobre, aço inox, CPVC)
- [ ] Sistema de circulação (termossifão vs bombeado)
- [ ] Presença de sistema auxiliar (resistência elétrica, gás)
- [ ] Padrão de uso (consumo uniforme vs picos)

**4.2 Hélice**
- [ ] Potência do Motor (kW)
- [ ] Tipo de uso (esporte, pesca, cruzeiro)

## Ordem de Implementação Sugerida

### Fase 1 Imediato
1. Melhorar gráfico do Hélice (zona de operação, slip)
2. Adicionar gráficos no Ar Condicionado
3. Adicionar parâmetros críticos no Bitola

### Fase 2 Curto Prazo
4. Adicionar gráficos no Energia Solar
5. Adicionar gráficos no Bitola
6. Adicionar parâmetros no Ar Condicionado
7. Implementar exportação PDF básica

### Fase 3 Médio Prazo
8. Adicionar gráficos no Aquecedor Solar
9. Implementar Comparar Cenários
10. Implementar Histórico de Cálculos
11. Adicionar "Sobre Este Cálculo"

### Fase 4 (Longo Prazo - 2-3 meses)
12. Adicionar parâmetros restantes
13. Validação com normas técnicas
14. Recomendações automáticas de produtos

## Notas Técnicas

- **Biblioteca de Gráficos**: Chart.js (já em uso no Mutuo e Hélice)
- **Exportação PDF**: Usar jsPDF ou html2pdf.js
- **Armazenamento**: localStorage para histórico e comparações
- **Padrão Visual**: Manter consistência com o design atual

