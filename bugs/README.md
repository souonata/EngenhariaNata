# 🐛 Formulário de Reporte de Bugs

Formulário para reportar bugs e problemas encontrados nos apps da Engenharia NATA.

## 🚀 Opções de Configuração

Você tem duas opções para receber os relatórios de bugs:

### Opção 1: Google Forms (Recomendado - Mais Simples) ⭐

**Vantagens:**
- ✅ Não requer configuração de API
- ✅ Recebe notificações por email automaticamente
- ✅ Armazena respostas em planilha Google Sheets
- ✅ Totalmente gratuito e ilimitado

**Como configurar:**
1. Acesse https://forms.google.com
2. Crie um novo formulário
3. Adicione os campos:
   - **Descrição do Bug** (Texto longo - obrigatório)
   - **Contato** (Email - opcional)
4. Configure notificações: Configurações → Notificações → Marque "Receber notificações por email"
5. Copie o link do formulário (botão "Enviar" → ícone de link)
6. Abra `bugs/bugs-script.js` e configure:
   ```javascript
   const USE_GOOGLE_FORMS = true;
   const FORM_ACTION_URL = 'SEU_LINK_DO_GOOGLE_FORM_AQUI';
   ```

### Opção 2: EmailJS (Envio Direto para Gmail)

**Vantagens:**
- ✅ Envio direto para seu Gmail
- ✅ Mais controle sobre o formato do email
- ✅ Não redireciona o usuário

**Desvantagens:**
- ❌ Não suporta anexos no plano gratuito
- ❌ Requer configuração de API
- ❌ Limite de 200 emails/mês no plano gratuito

**Como configurar:**
1. Crie uma conta em https://www.emailjs.com/ (gratuito até 200 emails/mês)
2. No dashboard, vá em **Email Services** → **Add New Service** → Escolha **Gmail**
3. Faça login com sua conta Gmail e anote o **Service ID**
4. Vá em **Email Templates** → **Create New Template**
5. Use este template:

**Subject:**
```
🐛 Bug Report
```

**Content (HTML):**
```html
<h2>🐛 Novo Relatório de Bug</h2>
<p><strong>Descrição:</strong></p>
<p>{{description}}</p>
<p><strong>Contato:</strong> {{contact}}</p>
<p><strong>Data/Hora:</strong> {{timestamp}}</p>
<p><strong>URL:</strong> {{url}}</p>
<p><strong>User Agent:</strong> {{user_agent}}</p>
```

6. Anote o **Template ID**
7. Vá em **Account** → **General** e copie sua **Public Key**
8. Abra `bugs/bugs-script.js` e configure:
   ```javascript
   const EMAILJS_CONFIG = {
       SERVICE_ID: 'seu_service_id_aqui',
       TEMPLATE_ID: 'seu_template_id_aqui',
       PUBLIC_KEY: 'sua_public_key_aqui'
   };
   ```

## ✅ Pronto!

Agora o formulário está configurado e funcionando. Os relatórios de bugs serão enviados para seu Gmail ou Google Forms.

## 📝 Notas

- **Google Forms**: Recomendado para começar rapidamente
- **EmailJS**: Melhor para integração direta com Gmail, mas não suporta anexos no plano gratuito
