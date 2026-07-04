# Tendências com IA (OpenAI) — configuração segura no Wix

O widget já está pronto para usar IA nas Tendências. Faltam só passos que **só você pode
fazer**, porque envolvem sua chave de API — eu não devo (e não posso) manuseá-la.

## 1. Ative o Dev Mode e crie o arquivo de backend
1. No editor do Wix, ligue o **Dev Mode** (Wix Studio: ícone `</>` na lateral; Wix Editor:
   menu Dev Mode).
2. Vá em **Backend & Public → Backend**.
3. Crie um arquivo chamado exatamente `http-functions.js`.
4. Cole o conteúdo do arquivo `wix-backend/http-functions.js` (deste pacote) nele.

## 2. Cadastre sua chave da OpenAI (você faz isso, não eu)
1. Painel do site → **Configurações → Ferramentas de desenvolvedor → Secrets Manager**.
2. Clique em **Novo segredo**.
3. Nome: `OPENAI_API_KEY` (exatamente assim, é o nome que o código procura).
4. Valor: cole sua chave da OpenAI ali dentro do Wix — **nunca aqui no chat comigo**.

## 3. Publique o site
- Publique pelo menos uma vez para o endpoint ficar ativo em:
  `https://www.pipelife-studio.com/_functions/trends`

## 4. Pronto
O widget "Martin Bauer Botanical Finder" já chama esse endereço automaticamente quando
alguém clica em "Tendências". Se por algum motivo a chamada falhar (chave ainda não
cadastrada, limite da OpenAI, instabilidade), o widget cai sozinho para uma classificação
local baseada no índice de popularidade do catálogo — o recurso nunca fica quebrado, só
menos preciso, e isso aparece de forma discreta na própria tela ("índice do catálogo — IA
indisponível no momento").

## Sobre o CORS
O arquivo já libera qualquer origem (`Access-Control-Allow-Origin: *`) porque o widget roda
dentro de um iframe do Wix, que normalmente tem uma origem diferente do domínio do site.
O endpoint não expõe dados sensíveis nem exige login, então isso é seguro. Se preferir
travar para um domínio específico, troque `"*"` por `"https://www.pipelife-studio.com"`
nas constantes `CORS_HEADERS` do arquivo.

## Trocando de modelo / provedor
O modelo usado é `gpt-4o-mini` (rápido e barato para esse tipo de estimativa). Para trocar,
edite a constante `OPENAI_MODEL` no topo do arquivo.
