/**
 * Wix Velo — Custom Site API (HTTP Functions)
 * ---------------------------------------------------------------------------
 * Onde colar este arquivo no editor do Wix:
 *   Painel do site → Dev Mode (ligar, se ainda não estiver) → Backend & Public
 *   → Backend → criar um arquivo chamado exatamente "http-functions.js"
 *   (colar todo o conteúdo abaixo nesse arquivo).
 *
 * Antes de publicar, crie o segredo no Secrets Manager do site:
 *   Painel do site → Configurações → Ferramentas de desenvolvedor → Secrets Manager
 *   → "Novo segredo" → nome exatamente: OPENAI_API_KEY → cole sua chave da OpenAI.
 *   (Não é preciso o app "Members Area" só para LER o segredo com getSecret(),
 *   apenas se você for criar/gerenciar segredos por API em vez do painel.)
 *
 * Depois de publicar o site, o endpoint fica disponível em:
 *   https://www.pipelife-studio.com/_functions/trends   (POST)
 *
 * O widget do catálogo (frontend) chama esse endpoint enviando a lista de
 * botânicos filtrados; este backend pede à OpenAI uma estimativa de 0 a 100
 * do "momentum" de interesse dos últimos 6 meses para cada um, e devolve só
 * os números — a chave da OpenAI nunca é enviada nem exposta ao navegador.
 *
 * CORS: liberado para qualquer origem (Access-Control-Allow-Origin: "*"),
 * porque o widget roda dentro de um iframe do Wix que normalmente tem uma
 * origem diferente do domínio do site. Este endpoint não expõe dados
 * sensíveis nem exige login, então isso é seguro; se preferir travar para um
 * domínio específico, troque "*" por "https://www.pipelife-studio.com" nas
 * duas constantes CORS_HEADERS abaixo.
 */

import { ok, response } from 'wix-http-functions';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const OPENAI_MODEL = 'gpt-4o-mini'; // troque aqui se quiser usar outro modelo da OpenAI

// Responde ao preflight CORS que o navegador manda antes do POST real.
export function options_trends(request) {
  return response({ status: 204, headers: CORS_HEADERS });
}

// POST https://<seu-dominio>/_functions/trends
// Body esperado: { names: string[], benefitLabel?: string, formatLabel?: string }
// Resposta: { scores: { [nomeEmIngles]: number 0-100 } }
export async function post_trends(request) {
  const jsonHeaders = { 'Content-Type': 'application/json', ...CORS_HEADERS };

  let body;
  try {
    body = await request.body.json();
  } catch (e) {
    return response({ status: 400, headers: jsonHeaders, body: { error: 'invalid_json_body' } });
  }

  const names = Array.isArray(body.names) ? body.names.filter(n => typeof n === 'string').slice(0, 70) : [];
  if (!names.length) {
    return response({ status: 200, headers: jsonHeaders, body: { scores: {} } });
  }
  const benefitLabel = body.benefitLabel || 'all health benefit areas';
  const formatLabel = body.formatLabel || 'all application formats';

  let apiKey;
  try {
    apiKey = await getSecret('OPENAI_API_KEY');
  } catch (e) {
    console.error('Não foi possível ler o segredo OPENAI_API_KEY. Ele foi criado no Secrets Manager?', e);
    return response({ status: 500, headers: jsonHeaders, body: { error: 'missing_secret' } });
  }
  if (!apiKey) {
    return response({ status: 500, headers: jsonHeaders, body: { error: 'missing_secret' } });
  }

  const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const prompt =
    'You are a market-intelligence analyst for botanical ingredients used in teas, extracts and dietary supplements ' +
    '(client: Martin Bauer Group, B2B). Estimate the momentum of consumer and B2B interest over the LAST 6 MONTHS up to ' +
    monthYear + ' for each botanical below, specifically within the application/benefit area "' + benefitLabel +
    '" and application format "' + formatLabel + '". Weigh recent search interest, new product launches, ' +
    'functional-food trends and seasonality. Return ONLY a JSON object of the shape {"scores": {"<name>": <0-100 integer>, ...}} ' +
    'mapping each botanical name EXACTLY as written to an integer momentum score from 0 to 100 ' +
    '(100 = strongest, fastest-rising interest; 0 = flat/declining). No prose, JSON only. ' +
    'Botanicals: ' + JSON.stringify(names);

  let aiResponse;
  try {
    aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });
  } catch (e) {
    console.error('Falha de rede ao chamar a OpenAI', e);
    return response({ status: 502, headers: jsonHeaders, body: { error: 'openai_unreachable' } });
  }

  if (!aiResponse.ok) {
    const errText = await aiResponse.text().catch(() => '');
    console.error('Erro retornado pela OpenAI', aiResponse.status, errText);
    return response({ status: 502, headers: jsonHeaders, body: { error: 'openai_error', status: aiResponse.status } });
  }

  let data;
  try {
    data = await aiResponse.json();
  } catch (e) {
    return response({ status: 502, headers: jsonHeaders, body: { error: 'openai_bad_response' } });
  }

  const text = (data && data.choices && data.choices[0] && data.choices[0].message)
    ? data.choices[0].message.content
    : '{}';

  let parsed = {};
  try { parsed = JSON.parse(text); } catch (e) { parsed = {}; }
  const raw = (parsed && typeof parsed.scores === 'object' && parsed.scores) ? parsed.scores : parsed;

  const scores = {};
  names.forEach(n => {
    let v = raw ? raw[n] : undefined;
    if (typeof v === 'string') v = parseInt(v, 10);
    if (typeof v === 'number' && !isNaN(v)) scores[n] = Math.max(0, Math.min(100, Math.round(v)));
  });

  return response({ status: 200, headers: jsonHeaders, body: { scores } });
}
