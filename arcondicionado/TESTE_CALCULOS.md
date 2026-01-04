# 📊 Tabela de Testes - Dimensionamento de Ar Condicionado

## Valores de Referência do Sistema

- **BTU por m³**: 600 BTU/m³
- **BTU por pessoa**: 600 BTU/pessoa
- **BTU por equipamento**: 600 BTU/equipamento
- **Fatores de Insolação**: Baixa (1.0), Média (1.15), Alta (1.3)
- **Fatores de Isolamento**: Bom (0.8), Médio (1.0), Ruim (1.2)
- **Altura padrão**: 2.7m (usada quando não especificada)

## Fórmula do Sistema

```
Volume (m³) = Área (m²) × Altura (m)
BTU Volume = Volume × 600 BTU/m³
BTU Pessoas = Pessoas × 600 BTU/pessoa
BTU Equipamentos = Equipamentos × 600 BTU/equipamento
BTU Base = BTU Volume + BTU Pessoas + BTU Equipamentos
BTU Final = BTU Base × Fator Insolação × Fator Isolamento
```

## Tabela de Testes

### Cenário 1: Ambiente Pequeno (Quarto)
| Parâmetro | Valor | Cálculo |
|-----------|-------|---------|
| Área | 12 m² | - |
| Altura | 2.7 m | - |
| Pessoas | 1 | - |
| Equipamentos | 1 (TV) | - |
| Insolação | Baixa (1.0) | - |
| Isolamento | Médio (1.0) | - |
| **Volume** | **32.4 m³** | 12 × 2.7 |
| **BTU Volume** | **19,440 BTU** | 32.4 × 600 |
| **BTU Pessoas** | **600 BTU** | 1 × 600 |
| **BTU Equipamentos** | **600 BTU** | 1 × 600 |
| **BTU Base** | **20,640 BTU** | 19,440 + 600 + 600 |
| **BTU Final** | **20,640 BTU** | 20,640 × 1.0 × 1.0 |
| **Modelo Recomendado** | **24,000 BTU** | Arredondado para cima |
| **Referência Internet** | **9,000-12,000 BTU** | Para 10-15 m², baixa insolação |
| **✅ Status** | ⚠️ **Acima** | Sistema está mais conservador |

### Cenário 2: Ambiente Médio (Sala)
| Parâmetro | Valor | Cálculo |
|-----------|-------|---------|
| Área | 20 m² | - |
| Altura | 2.7 m | - |
| Pessoas | 2 | - |
| Equipamentos | 3 (TV, computador, geladeira) | - |
| Insolação | Média (1.15) | - |
| Isolamento | Médio (1.0) | - |
| **Volume** | **54 m³** | 20 × 2.7 |
| **BTU Volume** | **32,400 BTU** | 54 × 600 |
| **BTU Pessoas** | **1,200 BTU** | 2 × 600 |
| **BTU Equipamentos** | **1,800 BTU** | 3 × 600 |
| **BTU Base** | **35,400 BTU** | 32,400 + 1,200 + 1,800 |
| **BTU Final** | **40,710 BTU** | 35,400 × 1.15 × 1.0 |
| **Modelo Recomendado** | **48,000 BTU** | Arredondado para cima |
| **Referência Internet** | **12,000-18,000 BTU** | Para 16-20 m², média insolação |
| **✅ Status** | ⚠️ **Muito acima** | Sistema está muito conservador |

### Cenário 3: Ambiente Grande (Sala de Estar)
| Parâmetro | Valor | Cálculo |
|-----------|-------|---------|
| Área | 30 m² | - |
| Altura | 2.7 m | - |
| Pessoas | 3 | - |
| Equipamentos | 4 | - |
| Insolação | Alta (1.3) | - |
| Isolamento | Ruim (1.2) | - |
| **Volume** | **81 m³** | 30 × 2.7 |
| **BTU Volume** | **48,600 BTU** | 81 × 600 |
| **BTU Pessoas** | **1,800 BTU** | 3 × 600 |
| **BTU Equipamentos** | **2,400 BTU** | 4 × 600 |
| **BTU Base** | **52,800 BTU** | 48,600 + 1,800 + 2,400 |
| **BTU Final** | **82,368 BTU** | 52,800 × 1.3 × 1.2 |
| **Modelo Recomendado** | **2 × 60,000 BTU** | 120,000 BTU total |
| **Referência Internet** | **18,000-30,000 BTU** | Para 26-30 m², alta insolação |
| **✅ Status** | ⚠️ **Muito acima** | Sistema está muito conservador |

### Cenário 4: Ambiente Pequeno com Isolamento Bom
| Parâmetro | Valor | Cálculo |
|-----------|-------|---------|
| Área | 15 m² | - |
| Altura | 2.7 m | - |
| Pessoas | 1 | - |
| Equipamentos | 1 | - |
| Insolação | Baixa (1.0) | - |
| Isolamento | Bom (0.8) | - |
| **Volume** | **40.5 m³** | 15 × 2.7 |
| **BTU Volume** | **24,300 BTU** | 40.5 × 600 |
| **BTU Pessoas** | **600 BTU** | 1 × 600 |
| **BTU Equipamentos** | **600 BTU** | 1 × 600 |
| **BTU Base** | **25,500 BTU** | 24,300 + 600 + 600 |
| **BTU Final** | **20,400 BTU** | 25,500 × 1.0 × 0.8 |
| **Modelo Recomendado** | **24,000 BTU** | Arredondado para cima |
| **Referência Internet** | **9,000-12,000 BTU** | Para 10-15 m² |
| **✅ Status** | ⚠️ **Acima** | Sistema está mais conservador |

### Cenário 5: Comparação com Referência Simplificada (600 BTU/m²)
| Área | BTU/m² | BTU Calculado | Referência 600 BTU/m² | Diferença |
|------|--------|---------------|----------------------|-----------|
| 10 m² | 2,700 m³ | 1,620 BTU (volume) | 6,000 BTU | -73% |
| 20 m² | 5,400 m³ | 3,240 BTU (volume) | 12,000 BTU | -73% |
| 30 m² | 8,100 m³ | 4,860 BTU (volume) | 18,000 BTU | -73% |

**Observação**: O sistema usa **600 BTU/m³** (volume), não **600 BTU/m²** (área). Isso explica a diferença.

### Cenário 6: Cálculo Correto Considerando Volume
| Área | Altura | Volume | BTU Volume | + Pessoas (2) | + Equip (2) | Base | Final (Média) | Modelo |
|------|--------|--------|------------|---------------|-------------|------|---------------|--------|
| 12 m² | 2.7m | 32.4 m³ | 19,440 | +1,200 | +1,200 | 21,840 | 25,116 | 30,000 |
| 20 m² | 2.7m | 54 m³ | 32,400 | +1,200 | +1,200 | 34,800 | 40,020 | 48,000 |
| 30 m² | 2.7m | 81 m³ | 48,600 | +1,200 | +1,200 | 50,400 | 57,960 | 60,000 |

## Análise Comparativa

### Diferenças Identificadas

1. **Método de Cálculo**:
   - **Internet**: Geralmente usa **BTU/m²** (600-800 BTU/m²)
   - **Sistema**: Usa **BTU/m³** (600 BTU/m³)
   - **Impacto**: Para altura padrão de 2.7m, o sistema calcula aproximadamente **1,620 BTU/m²** (600 × 2.7), que é **2-3x maior** que as referências

2. **Fatores de Ajuste**:
   - **Internet**: Ajustes simples por insolação
   - **Sistema**: Multiplica fatores de insolação E isolamento, podendo resultar em valores muito altos

3. **Pessoas e Equipamentos**:
   - **Internet**: +600 BTU por pessoa/equipamento (igual ao sistema)
   - **Sistema**: ✅ Correto

## Recomendações

### Opção 1: Ajustar para BTU/m² (Recomendado)
- Mudar de **600 BTU/m³** para **600-700 BTU/m²**
- Manter fatores de ajuste
- Isso alinharia melhor com as referências da internet

### Opção 2: Manter BTU/m³ mas Ajustar Fatores
- Reduzir o fator base de **600 BTU/m³** para **400-450 BTU/m³**
- Isso resultaria em aproximadamente **1,080-1,215 BTU/m²** (mais próximo de 600-800)

### Opção 3: Manter Sistema Atual
- Sistema está mais conservador (superdimensionado)
- Garante conforto mesmo em condições extremas
- Pode ser desejável para segurança

## Conclusão

O sistema atual está **mais conservador** que as referências da internet, calculando valores **2-3x maiores**. Isso pode ser intencional para garantir conforto, mas pode resultar em equipamentos superdimensionados e custos mais altos.

**Recomendação**: Considerar ajustar para usar **BTU/m²** em vez de **BTU/m³**, ou reduzir o fator base para alinhar melhor com as práticas da indústria.

