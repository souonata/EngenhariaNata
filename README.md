# Engenharia NATA

Portfólio de apps web educativos de engenharia e finanças, com foco em cálculos práticos, explicações didáticas e interface bilíngue (pt-BR / it-IT).

## Acesse!
- Site: `https://engnata.eu`

## Aplicativos

- `mutuo/` - Calculadora de empréstimos com SAC, Price e Americano
- `helice/` - Calculadora de hélice náutica
- `solar/` - Dimensionamento fotovoltaico off-grid
- `bitola/` - Calculadora de bitola de cabos elétricos
- `arcondicionado/` - Dimensionador de BTU e sistema multi-split
- `aquecimento/` - Dimensionador de aquecimento solar térmico
- `fazenda/` - Planejador de fazenda auto-sustentável
- `bugs/` - Formulário para reporte de problemas
- `sobre/` - Página institucional

## Tecnologias

- HTML5
- CSS3
- JavaScript ES modules
- Chart.js (CDN)
- localStorage
- Service Worker (`sw.js`)

## Executar localmente

O ambiente de desenvolvimento está em `local/`.

```bash
cd local
npm install
npm run dev
```

Opcionalmente, use o painel de controle local:

```bash
cd local
npm run control
```

## Estrutura principal

```text
EngenhariaNata/
├── index.html
├── assets/
├── src/
├── aquecimento/
├── arcondicionado/
├── bitola/
├── bugs/
├── fazenda/
├── helice/
├── mutuo/
├── sobre/
├── solar/
└── local/
```

## Popov IA local (Ollama + FastAPI)

O app `popov/` agora funciona como cliente de chat para um backend Python local que encaminha requisicoes ao Ollama (`gpt-oss:20b`) com streaming.

### 1. Preparar Ollama

```bash
ollama pull gpt-oss:20b
ollama run gpt-oss:20b
```

### 2. Subir API local

```bash
cd local/ollama_api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --host 0.0.0.0 --port 8000
```

Variaveis importantes em `.env`:

- `API_BEARER_TOKEN`: token unico (modo simples)
- `API_BEARER_TOKENS`: lista de tokens separados por virgula para convidados (prioridade sobre `API_BEARER_TOKEN`)
- `ALLOWED_ORIGINS`: dominios autorizados (ex.: `https://engnata.infinityfree.me`)
- `OLLAMA_URL`: normalmente `http://127.0.0.1:11434/api/chat`
- `OLLAMA_MODEL`: fixado por padrao em `gpt-oss:20b`

### 3. Publicar com Cloudflare Tunnel

Exemplo rapido:

```bash
cloudflared tunnel --url http://localhost:8000
```

Use a URL HTTPS gerada no botao `Configurar API` da pagina `popov/popov.html`.

### 4. Endpoint disponivel

- `GET /health`: teste de disponibilidade
- `POST /chat/stream`: stream SSE de resposta do modelo

`POST /chat/stream` exige:

- Header: `Authorization: Bearer <TOKEN>`
- Body JSON: `{ "message": "...", "conversation_id": "opcional" }`

### 5. OpenRouter + Open-CLAW (Windows 11)

Agora o backend `local/ollama_api` suporta dois provedores via `.env`:

- `LLM_PROVIDER=ollama` (comportamento atual)
- `LLM_PROVIDER=openrouter` (novo)

Guia completo (preparacao, setup de ambiente, Hunter-Alpha/Healer-Alpha, otimizacoes RTX 4060 8GB e troubleshooting):

- `local/SETUP-OPENROUTER-WINDOWS.md`

### Adicionando um Novo App

1. Crie uma pasta para o app (ex: `meuapp/`)
2. Crie os arquivos: `meuapp.html`, `meuapp-script.js`, `meuapp-styles.css`
3. Inclua `assets/js/site-config.js` no HTML antes do script do app
4. Use as funções globais de formatação e configuração
5. Adicione o app ao `index.html` e `sobre/sobre.html`
6. Execute `scripts/count-lines.ps1` para atualizar as estatísticas
7. Execute `scripts/sync-versions.ps1 -Mode ReadHTML` para atualizar `config/versions.json`
