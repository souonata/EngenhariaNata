# 📝 Como Configurar Google Forms - Passo a Passo

## Passo 1: Criar o Google Form

1. Acesse https://forms.google.com
2. Clique em **"Criar um formulário em branco"** ou use um template
3. Dê um nome ao formulário: "🐛 Reportar Bug - Engenharia NATA"

## Passo 2: Adicionar Campos

Adicione os seguintes campos na ordem:

### Campo 1: Descrição do Bug (Texto longo)
- Tipo: **Resposta curta** ou **Parágrafo** (recomendo Parágrafo)
- Título: "Descrição do Bug *"
- Marque como **Obrigatório**

### Campo 3: Contato (Email)
- Tipo: **Resposta curta**
- Título: "Contato para Resposta (Opcional)"
- Validação: Escolha **Número** ou deixe como texto
- Deixe como **Opcional**

### Campo 4: Data/Hora (Opcional - automático)
- Tipo: **Data** ou **Resposta curta**
- Título: "Data/Hora"
- Deixe como **Opcional** (será preenchido automaticamente se configurado)

## Passo 3: Obter o Link do Formulário

1. Clique no botão **"Enviar"** (canto superior direito)
2. Clique no ícone de **link** (🔗)
3. Copie o link completo
4. O link será algo como: `https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform`

## Passo 4: Obter os Entry IDs (Opcional - para envio automático)

**Método 1: Inspecionar o formulário**
1. Abra o formulário no navegador
2. Pressione **F12** para abrir as ferramentas de desenvolvedor
3. Vá na aba **Network** (Rede)
4. Preencha e envie o formulário
5. Procure por uma requisição para `formResponse`
6. Veja os parâmetros enviados - os nomes são os entry IDs (ex: `entry.123456789`)

**Método 2: Ver respostas em planilha**
1. No Google Form, clique em **"Ver respostas"** → **"Criar planilha"**
2. Na planilha, veja os nomes das colunas
3. Os nomes das colunas contêm os entry IDs

**Método 3: Usar ferramenta online**
- Use https://github.com/tanaikech/GetIDsOfGoogleForm para obter os IDs automaticamente

## Passo 5: Configurar Notificações por Email

1. No Google Form, clique no ícone de **⚙️ Configurações** (engrenagem)
2. Vá em **"Notificações"**
3. Marque **"Receber notificações por email"**
4. Escolha **"Uma notificação por email para cada resposta"**

## Passo 6: Configurar no Código

Abra `bugs/bugs-script.js` e configure:

```javascript
const USE_GOOGLE_FORMS = true;
const FORM_ACTION_URL = 'https://docs.google.com/forms/d/e/YOUR_FORM_ID/formResponse';

// Se você obteve os entry IDs, configure aqui (opcional)
const GOOGLE_FORM_ENTRY_IDS = {
    description: 'entry.987654321', // Substitua pelo ID real do campo "Descrição"
    contact: 'entry.111222333'      // Substitua pelo ID real do campo "Contato"
};
```

**Importante:** 
- Se você configurar os `GOOGLE_FORM_ENTRY_IDS`, o formulário enviará automaticamente
- Se não configurar, o usuário será redirecionado para o Google Form para preencher manualmente

## Passo 7: Testar

1. Abra `bugs/bugs.html` no navegador
2. Preencha o formulário
3. Clique em "Enviar Relatório"
4. Verifique se você recebeu o email de notificação

## ✅ Pronto!

Agora o formulário está configurado e funcionando com Google Forms!

## 📧 Ver Respostas

Você pode ver todas as respostas:
- No Google Form: Clique em **"Ver respostas"**
- Em uma planilha: Clique em **"Ver respostas"** → **"Criar planilha"**

## 💡 Dica

Para facilitar, você pode criar uma planilha Google Sheets vinculada ao formulário para ter uma visão melhor de todas as respostas em formato de tabela.

