# 🔧 Como Obter os Entry IDs do Google Forms

Para que o formulário funcione corretamente e envie os dados automaticamente, você precisa obter os **Entry IDs** dos campos do seu Google Form.

## Método 1: Inspecionar o Formulário (Mais Rápido)

1. Abra o seu Google Form no navegador:
   ```
   https://docs.google.com/forms/d/e/1FAIpQLSc3Qo7Otct-L7mN2qS9r967oBol6n6gnsEJz2nfkz89sSpBcQ/viewform
   ```

2. Pressione **F12** (ou clique com botão direito → "Inspecionar") para abrir as Ferramentas de Desenvolvedor

3. Vá na aba **Network** (Rede)

4. Preencha o formulário com dados de teste e clique em **Enviar**

5. Na aba Network, procure por uma requisição chamada `formResponse`

6. Clique nela e vá na aba **Payload** ou **Form Data**

7. Você verá os Entry IDs, por exemplo:
   - `entry.987654321` = Descrição do Bug
   - `entry.111222333` = Contato

8. Copie esses IDs e cole no arquivo `bugs-script.js` nas linhas 13-16

## Método 2: Ver o Código-Fonte do Formulário

1. Abra o seu Google Form no navegador

2. Pressione **Ctrl+U** (ou clique com botão direito → "Ver código-fonte da página")

3. Pressione **Ctrl+F** para buscar

4. Procure por `entry.` (com ponto)

5. Você encontrará os Entry IDs nos atributos `name` dos inputs, por exemplo:
   ```html
   <input name="entry.123456789" ...>
   ```

## Método 3: Usar Planilha do Google Sheets

1. No Google Form, clique em **"Ver respostas"** → **"Criar planilha"**

2. Na planilha criada, veja os nomes das colunas

3. Os nomes das colunas contêm os Entry IDs, por exemplo:
   - `Descrição do Bug [entry.987654321]`
   - `Contato [entry.111222333]`

## Configurar no Código

Depois de obter os Entry IDs, abra `bugs/bugs-script.js` e atualize as linhas 13-16:

```javascript
const GOOGLE_FORM_ENTRY_IDS_MANUAL = {
    description: 'entry.987654321', // Substitua pelo ID real do campo "Descrição"
    contact: 'entry.111222333'      // Substitua pelo ID real do campo "Contato"
};
```

## ⚠️ Importante

- Os Entry IDs são únicos para cada campo do formulário
- Se você adicionar ou remover campos do Google Form, os IDs podem mudar
- Sem os Entry IDs corretos, o formulário não conseguirá enviar os dados automaticamente

## Testar

Depois de configurar os Entry IDs:

1. Abra `bugs/bugs.html` no navegador
2. Preencha o formulário
3. Clique em "Enviar Relatório"
4. Verifique se você recebeu a resposta no Google Forms

