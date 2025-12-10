# 🔒 Problemas de Acesso do PC da Empresa

## Erro: `ERR_TUNNEL_CONNECTION_FAILED`

Este erro ocorre quando o navegador não consegue estabelecer uma conexão segura (HTTPS) com o servidor, geralmente devido a políticas de segurança corporativa.

## 🔍 Causas Prováveis

### 1. **Firewall Corporativo Bloqueando**
- O firewall da empresa pode estar bloqueando conexões HTTPS para domínios externos
- Especialmente comum com domínios de hospedagem gratuita (`.infinityfree.me`)

### 2. **Proxy Corporativo**
- Empresas geralmente usam proxies para monitorar/controlar tráfego
- O proxy pode estar bloqueando ou interceptando a conexão SSL/TLS
- Certificados SSL podem não ser confiáveis pela política corporativa

### 3. **Certificado SSL Não Confiável**
- O InfinityFree usa certificados SSL gratuitos (Let's Encrypt)
- Algumas políticas corporativas bloqueiam certificados de CAs específicas
- O navegador pode estar rejeitando o certificado automaticamente

### 4. **Bloqueio de Domínios Específicos**
- Políticas podem bloquear domínios de hospedagem gratuita
- Filtros de conteúdo podem categorizar `.infinityfree.me` como não confiável

## ✅ Soluções Possíveis

### Para o Usuário (PC da Empresa)

#### 1. **Verificar Configurações de Proxy**
- Acesse: Configurações do Windows → Rede e Internet → Proxy
- Verifique se há proxy configurado
- Tente desabilitar temporariamente (se permitido pela política)

#### 2. **Tentar HTTP ao invés de HTTPS**
⚠️ **ATENÇÃO**: HTTP não é seguro, mas pode funcionar se HTTPS estiver bloqueado
- Tente acessar: `http://engnata.infinityfree.me` (sem o 's' em http)
- O navegador pode avisar sobre conexão não segura - aceite apenas se necessário

#### 3. **Usar Navegador Alternativo**
- Tente acessar com outro navegador (Firefox, Edge, etc.)
- Alguns navegadores podem ter configurações diferentes de proxy/SSL

#### 4. **Verificar Extensões de Segurança**
- Extensões de antivírus/firewall podem estar bloqueando
- Tente desabilitar temporariamente (se permitido)

#### 5. **Contatar TI da Empresa**
- Solicite liberação do domínio `engnata.infinityfree.me` no firewall
- Solicite adição do certificado SSL à lista de confiança
- Explique que é um site pessoal/educacional legítimo

### Para o Administrador do Site

#### 1. **Verificar Status do SSL**
- Verificar se o certificado SSL está válido e ativo
- Verificar se o site está acessível de outras redes

#### 2. **Considerar Migração para Domínio Próprio**
- Domínios próprios (ex: `engnata.eu`) geralmente têm menos bloqueios
- Certificados SSL de domínios próprios são mais confiáveis para empresas

#### 3. **Adicionar Redirecionamento HTTP → HTTPS**
- Garantir que HTTP redireciona para HTTPS
- Alguns firewalls podem permitir HTTP mas bloquear HTTPS

## 🔧 Verificações Técnicas

### Testar Acessibilidade

```bash
# Testar se o site está acessível (do PC da empresa)
ping engnata.infinityfree.me

# Testar conexão HTTPS
curl -I https://engnata.infinityfree.me

# Verificar certificado SSL
openssl s_client -connect engnata.infinityfree.me:443 -showcerts
```

### Verificar Certificado SSL Online
- Use ferramentas como: https://www.ssllabs.com/ssltest/
- Verifique se o certificado está válido e confiável

## 📋 Informações para Solicitar ao TI

Se precisar solicitar liberação ao departamento de TI da empresa, forneça:

1. **Domínio**: `engnata.infinityfree.me`
2. **IP do Servidor**: (verificar no painel do InfinityFree)
3. **Porta**: 443 (HTTPS)
4. **Protocolo**: HTTPS/TLS 1.2+
5. **Propósito**: Site pessoal/educacional com calculadoras de engenharia
6. **Certificado SSL**: Let's Encrypt (CA confiável)

## 🆘 Alternativas Temporárias

1. **Acessar de Rede Pessoal**
   - Use seu celular como hotspot
   - Acesse de casa ou outra rede não corporativa

2. **Usar VPN Pessoal**
   - Se permitido pela política da empresa
   - Conecte-se a uma VPN e tente acessar novamente

3. **Acessar Versão Local**
   - Baixe os arquivos do projeto
   - Abra `index.html` localmente no navegador
   - Funcionalidades offline funcionarão normalmente

## 📝 Notas Importantes

- ⚠️ **NÃO** desabilite políticas de segurança sem autorização
- ⚠️ **NÃO** ignore avisos de segurança sem entender os riscos
- ✅ Sempre siga as políticas de segurança da empresa
- ✅ Consulte o departamento de TI antes de fazer mudanças

---

**Última atualização**: Janeiro 2025

