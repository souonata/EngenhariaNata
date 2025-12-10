# 🔒 Headers de Segurança Implementados

Este documento descreve os headers de segurança implementados no site para melhorar a segurança e confiabilidade.

## ✅ Headers Implementados

### 1. **Content-Security-Policy (CSP)**
**Proteção**: Previne ataques XSS, injection e carregamento de recursos não autorizados.

**Configuração**:
- `default-src 'self'`: Apenas recursos do próprio domínio por padrão
- `script-src`: Permite scripts próprios, inline (necessário para JSON-LD), Chart.js do jsdelivr e Google Forms
- `style-src`: Permite estilos próprios e inline
- `img-src`: Permite imagens próprias, data URIs e HTTPS
- `connect-src`: Permite conexões com Google Forms/APIs
- `frame-src`: Permite apenas Google Forms em iframes
- `object-src 'none'`: Bloqueia plugins (Flash, etc.)
- `upgrade-insecure-requests`: Força upgrade de HTTP para HTTPS

### 2. **X-Frame-Options: SAMEORIGIN**
**Proteção**: Previne clickjacking (embarque do site em iframes maliciosos).

**Valor**: `SAMEORIGIN` - permite iframes apenas do mesmo domínio.

### 3. **X-Content-Type-Options: nosniff**
**Proteção**: Previne MIME type sniffing, forçando o navegador a respeitar o Content-Type declarado.

### 4. **X-XSS-Protection: 1; mode=block**
**Proteção**: Ativa proteção XSS em navegadores antigos (Chrome, IE, Safari).

**Nota**: CSP é mais moderno, mas este header ajuda em navegadores antigos.

### 5. **Strict-Transport-Security (HSTS)**
**Proteção**: Força uso de HTTPS por 1 ano, prevenindo downgrade attacks.

**Configuração**:
- `max-age=31536000`: 1 ano
- `includeSubDomains`: Aplica a todos os subdomínios
- `preload`: Permite inclusão em lista de preload do HSTS

### 6. **Referrer-Policy: strict-origin-when-cross-origin**
**Proteção**: Controla quanto de informação do referrer é enviado em requisições.

**Comportamento**:
- Mesmo domínio: envia URL completa
- Cross-origin HTTPS: envia apenas origem (ex: `https://engnata.infinityfree.me`)
- Cross-origin HTTP: não envia referrer

### 7. **Permissions-Policy**
**Proteção**: Controla quais APIs do navegador podem ser usadas.

**Bloqueado**: geolocation, microphone, camera, payment, usb, magnetometer, gyroscope, accelerometer.

### 8. **Remoção de Headers Informativos**
**Proteção**: Remove informações do servidor (segurança por obscuridade).

**Removido**: `Server`, `X-Powered-By`

## 🛡️ Proteções Adicionais

### Bloqueio de Arquivos Sensíveis
- Arquivos ocultos (começando com `.`)
- Arquivos de backup/configuração (`.bak`, `.conf`, `.log`, `.sql`, etc.)

## 📊 Como Verificar

### 1. **Ferramentas Online**
- **SecurityHeaders.com**: https://securityheaders.com/?q=https://engnata.infinityfree.me
- **Mozilla Observatory**: https://observatory.mozilla.org/
- **SSL Labs**: https://www.ssllabs.com/ssltest/

### 2. **Via Navegador (DevTools)**
1. Abra o DevTools (F12)
2. Vá para a aba **Network**
3. Recarregue a página
4. Clique em qualquer requisição
5. Vá para a aba **Headers**
6. Procure por **Response Headers**

### 3. **Via Linha de Comando**
```bash
# Verificar headers de segurança
curl -I https://engnata.infinityfree.me

# Verificar apenas headers de segurança
curl -I https://engnata.infinityfree.me | grep -i "x-\|content-security\|strict-transport\|referrer\|permissions"
```

## ⚠️ Notas Importantes

### Content Security Policy (CSP)
- O CSP atual permite `'unsafe-inline'` e `'unsafe-eval'` para scripts, necessário para:
  - JSON-LD inline no HTML
  - Chart.js que pode usar eval
- **Recomendação futura**: Migrar para nonces ou hashes para remover `'unsafe-inline'`

### Strict-Transport-Security (HSTS)
- ⚠️ **CUIDADO**: Uma vez ativado, o navegador lembrará de usar HTTPS por 1 ano
- Se você remover HTTPS, os usuários terão problemas de acesso
- Certifique-se de que HTTPS está funcionando corretamente antes de ativar

### Compatibilidade
- Todos os headers são compatíveis com navegadores modernos
- Alguns headers (como X-XSS-Protection) são para compatibilidade com navegadores antigos
- CSP pode bloquear alguns recursos se não configurado corretamente

## 🔧 Troubleshooting

### Se o site parar de funcionar após adicionar headers:

1. **Verifique o console do navegador** (F12 → Console)
   - Procure por erros de CSP
   - Erros geralmente indicam qual recurso está sendo bloqueado

2. **Verifique os headers enviados**
   ```bash
   curl -I https://engnata.infinityfree.me
   ```

3. **Ajuste o CSP se necessário**
   - Se Chart.js não carregar, verifique `script-src`
   - Se Google Forms não funcionar, verifique `frame-src` e `connect-src`

4. **Teste em modo de relatório primeiro** (opcional)
   - Adicione `report-uri` ao CSP para receber relatórios de violações
   - Isso permite ver o que está sendo bloqueado sem quebrar o site

## 📚 Recursos Adicionais

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP: Security Headers](https://owasp.org/www-project-secure-headers/)
- [SecurityHeaders.com](https://securityheaders.com/)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)

---

**Última atualização**: Janeiro 2025

