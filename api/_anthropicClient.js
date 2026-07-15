/* global process */
// Único ponto de contato com a Claude API neste projeto (seção 28 do spec —
// "abstração do provedor de IA"). Tudo que faz sobre a mensagem devolvida pelo
// modelo é normalizar em uma de três formas: { type:'texto' }, { type:'ferramenta' }
// ou { type:'erro' } — nunca deixa uma exceção subir para o chamador, e nunca
// interpreta o conteúdo como instrução: quem decide se uma chamada de
// ferramenta é aceitável é `src/domain/telegram/interpretarMensagemIA.js`
// (`validarChamadaFerramenta`), não este arquivo.
import Anthropic from '@anthropic-ai/sdk';

function readEnv(name) {
  return String(process.env[name] || '').trim();
}

// claude-opus-4-8 é o padrão desta skill; TELEGRAM_IA_MODEL permite trocar
// (ex.: para um modelo mais barato) sem alterar código — decisão de custo do
// operador da conta, não do código.
const MODELO_PADRAO = 'claude-opus-4-8';
const MAX_TOKENS_PADRAO = 1024;

let clienteCache = null;
function obterCliente() {
  const apiKey = readEnv('ANTHROPIC_API_KEY');
  if (!apiKey) return null;
  if (!clienteCache) clienteCache = new Anthropic({ apiKey });
  return clienteCache;
}

/** true quando há uma chave configurada — usado para decidir se tenta a camada de IA. */
export function iaDisponivel() {
  return Boolean(readEnv('ANTHROPIC_API_KEY'));
}

/**
 * @param {{ system:string, messages:Array<{role,content}>, tools:Array }} req
 * @returns {Promise<{type:'texto',texto:string}|{type:'ferramenta',nome:string,parametros:object}|{type:'erro',motivo:string}>}
 */
export async function chamarClaudeParaTelegram({ system, messages, tools }) {
  const client = obterCliente();
  if (!client) return { type: 'erro', motivo: 'SEM_CHAVE_API' };

  const model = readEnv('TELEGRAM_IA_MODEL') || MODELO_PADRAO;
  const maxTokens = Number(readEnv('TELEGRAM_IA_MAX_TOKENS')) || MAX_TOKENS_PADRAO;
  const effort = readEnv('TELEGRAM_IA_EFFORT') || 'low';

  try {
    const resposta = await client.messages.create({
      model,
      max_tokens: maxTokens,
      output_config: { effort },
      system,
      messages,
      tools,
      tool_choice: { type: 'auto' },
    });

    if (resposta.stop_reason === 'refusal') return { type: 'erro', motivo: 'RECUSADO_PELO_MODELO' };

    const blocoFerramenta = resposta.content?.find((b) => b.type === 'tool_use');
    if (blocoFerramenta) {
      return { type: 'ferramenta', nome: blocoFerramenta.name, parametros: blocoFerramenta.input };
    }

    const blocoTexto = resposta.content?.find((b) => b.type === 'text');
    return { type: 'texto', texto: blocoTexto?.text || '' };
  } catch (e) {
    console.error('[telegram-ia] falha ao chamar a Claude API', { erro: e?.message, status: e?.status });
    if (e?.status === 429) return { type: 'erro', motivo: 'RATE_LIMIT' };
    if (e?.status === 401 || e?.status === 403) return { type: 'erro', motivo: 'CREDENCIAL_INVALIDA' };
    return { type: 'erro', motivo: 'ERRO_PROVEDOR' };
  }
}
