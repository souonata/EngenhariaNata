# 🚀 Como Configurar Google Forms - Guia Rápido

## Passo 1: Criar o Google Form (5 minutos)

1. **Acesse:** https://forms.google.com
2. **Clique em:** "Criar um formulário em branco"
3. **Nome do formulário:** "🐛 Reportar Bug - Engenharia NATA"

## Passo 2: Adicionar Campos

### Campo 1: Descrição do Bug
- Clique em **"+"** para adicionar campo
- Escolha **"Parágrafo"** (texto longo)
- Título: `Descrição do Bug *`
- ✅ Marque **"Obrigatório"**

### Campo 2: Contato (Opcional)
- Clique em **"+"** para adicionar campo
- Escolha **"Resposta curta"**
- Título: `Contato para Resposta (Opcional)`
- ❌ Deixe como **Opcional**

## Passo 3: Configurar Notificações

1. Clique no ícone **⚙️** (Configurações) no topo
2. Vá na aba **"Notificações"**
3. ✅ Marque **"Receber notificações por email"**
4. Escolha **"Uma notificação por email para cada resposta"**

## Passo 4: Obter o Link do Formulário

1. Clique no botão **"Enviar"** (canto superior direito)
2. Clique no ícone de **link** (🔗)
3. **Copie o link completo**
   - Será algo como: `https://docs.google.com/forms/d/e/1ABC...XYZ/viewform`
4. **IMPORTANTE:** Você precisa mudar `/viewform` para `/formResponse`
   - Link correto: `https://docs.google.com/forms/d/e/1ABC...XYZ/formResponse`

## Passo 5: Configurar no Código

1. Abra o arquivo: `bugs/bugs-script.js`
2. Encontre estas linhas (por volta da linha 28-35):

```javascript
const USE_GOOGLE_FORMS = true;
const FORM_ACTION_URL = 'YOUR_GOOGLE_FORM_URL';
```

3. **Substitua** `YOUR_GOOGLE_FORM_URL` pelo link que você copiou (com `/formResponse`):

```javascript
const USE_GOOGLE_FORMS = true;
const FORM_ACTION_URL = 'https://docs.google.com/forms/d/e/1ABC...XYZ/formResponse';
```

## ✅ Pronto!

Agora o formulário está configurado! Quando alguém preencher o formulário de bugs, será redirecionado para o Google Form para enviar.

## 📧 Ver as Respostas

Você pode ver todas as respostas de duas formas:

### Opção 1: No Google Form
- Clique em **"Ver respostas"** no topo do formulário

### Opção 2: Em uma Planilha (Recomendado)
1. No Google Form, clique em **"Ver respostas"**
2. Clique no ícone do **Google Sheets** (📊)
3. Isso criará uma planilha com todas as respostas em formato de tabela

## 🔧 Envio Automático (Opcional - Avançado)

Se você quiser que o formulário envie automaticamente sem redirecionar o usuário, você precisa obter os "Entry IDs" dos campos. Veja o arquivo `CONFIGURAR_GOOGLE_FORMS.md` para instruções detalhadas.

**Mas não é necessário!** O método simples (redirecionar para o Google Form) funciona perfeitamente.

## 🎯 Resumo Rápido

1. ✅ Criar Google Form
2. ✅ Adicionar 2 campos (Descrição, Contato)
3. ✅ Configurar notificações por email
4. ✅ Copiar link do formulário (mudar para `/formResponse`)
5. ✅ Colar o link em `bugs-script.js` na variável `FORM_ACTION_URL`
6. ✅ Pronto!

