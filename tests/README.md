# Tests — Testes Automatizados do Projeto

Esta pasta contém testes automatizados para validar funcionalidades críticas do projeto. Os testes são executados automaticamente via GitHub Actions em cada push ou pull request.

## 📋 Testes Disponíveis

### Testes Unitários (Node.js)

Testes de lógica de negócio que validam cálculos e conversões:

- **`mutuo_parsing_test.js`** — Validação de parsing de valores monetários formatados (ex.: "100.000,50" → 100000.50)
- **`mutuo_tax_conversion_test.js`** — Conversão de taxas de juros (anual → mensal, diária → mensal)
- **`mutuo_valorrapido_test.js`** — Cálculos rápidos de empréstimos (SAC, Price, Americano)
- **`solar_battery_sizing_test.js`** — Dimensionamento de baterias (cálculo de capacidade necessária)
- **`solar_gargalos_test.js`** — Cálculo de gargalos (vida útil vs autonomia)
- **`solar_locale_test.js`** — Formatação de números por idioma (pt-BR vs it-IT)
- **`home_button_i18n_test.js`** — Internacionalização do botão home

### Testes de Integridade (Smoke Tests)

Testes que verificam a estrutura e integridade dos arquivos:

- **`check-site-config.js`** / **`check-site-config.ps1`** — Verifica se `site-config.js` está correto e acessível
- **`check-ripple.js`** / **`check-ripple.ps1`** — Verifica consolidação do CSS do ripple:
  - `.ripple {` e `@keyframes ripple` existem apenas em `assets/css/ripple-styles.css`
  - Páginas HTML principais incluem `assets/css/ripple-styles.css`

## 🚀 Como Executar

### Executar Todos os Testes (Node.js)

```bash
# Na raiz do projeto
node tests/run-tests.js
```

Este comando executa todos os testes unitários e de integridade.

### Executar Testes Individuais

**PowerShell (Windows / PS Core):**
```powershell
# Teste de ripple
pwsh -NoProfile -ExecutionPolicy Bypass -File tests/check-ripple.ps1

# Teste de site-config
pwsh -NoProfile -ExecutionPolicy Bypass -File tests/check-site-config.ps1
```

**Node.js (cross-platform):**
```bash
# Teste de ripple
node tests/check-ripple.js

# Teste de site-config
node tests/check-site-config.js

# Teste individual (exemplo)
node tests/mutuo_parsing_test.js
```

## ✅ Execução Automática

Os testes são executados automaticamente via GitHub Actions (`.github/workflows/tests.yml`) em:
- Cada push para o repositório
- Cada pull request

Isso garante que mudanças no código não quebrem funcionalidades existentes.

## 📝 Adicionando Novos Testes

Ao adicionar novas funcionalidades, considere adicionar testes correspondentes:

1. Crie um arquivo `*_test.js` na pasta `tests/`
2. Use o padrão de asserção simples (sem dependências externas)
3. Adicione o teste ao `run-tests.js` se necessário
4. Execute localmente antes de fazer commit

**Exemplo de estrutura de teste:**
```javascript
// tests/novo_teste.js
function testarNovaFuncionalidade() {
    const resultado = calcularAlgo(10, 20);
    if (resultado !== 30) {
        throw new Error(`Esperado 30, obtido ${resultado}`);
    }
    console.log('✓ Teste passou');
}

testarNovaFuncionalidade();
```
