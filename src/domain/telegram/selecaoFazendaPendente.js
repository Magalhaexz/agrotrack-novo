// Interpreta a resposta do usuário a uma lista de fazendas já apresentada
// (Parte 6, revisão do bug de seleção numérica). Puro, sem I/O: resolve
// contra a lista de opções EXATAMENTE como foi mostrada (nunca reconsulta o
// banco por uma nova ordem) — quem persiste/expira a pendência é o
// orquestrador (`api/_telegramBot.js`).
import { normalizarChave, resolverFazendaPorNome } from './resolvedores.js';

// "1", "opção 1" (já sem acento por `normalizarChave`), "fazenda 1", "usar 1",
// "usar fazenda 1". Âncorado nas duas pontas: "1.5" ou "-1" nunca casam (só
// dígitos puros no meio).
const RE_INDICE = /^(?:usar\s+)?(?:opcao\s+|fazenda\s+)?(\d+)$/;
// "usar fazenda NOME", "usar NOME", "fazenda NOME" → extrai NOME; sem
// prefixo, o texto inteiro é tratado como nome (ex.: "yellowstone").
const RE_NOME_COM_PREFIXO = /^(?:usar\s+fazenda|usar|fazenda)\s+(.+)$/i;

/**
 * @param {string} texto resposta do usuário
 * @param {Array<{indice:number, fazenda_id:number|string, nome:string}>} opcoes lista exibida
 * @returns {{status:'ok', opcao:object} | {status:'ambiguo', candidatos:object[]} | {status:'invalido'} | {status:'nao_reconhecido'}}
 */
function traduzir(r) {
  if (r.status === 'ok') return { status: 'ok', opcao: r.fazenda };
  if (r.status === 'ambiguo') return { status: 'ambiguo', candidatos: r.candidatas };
  return { status: 'nao_reconhecido' };
}

export function interpretarSelecaoFazenda(texto, opcoes) {
  const bruto = String(texto || '').trim();
  const lista = Array.isArray(opcoes) ? opcoes : [];
  if (!bruto || lista.length === 0) return { status: 'nao_reconhecido' };

  const mIndice = normalizarChave(bruto).match(RE_INDICE);
  if (mIndice) {
    const indice = Number(mIndice[1]);
    const opcao = lista.find((o) => o.indice === indice);
    return opcao ? { status: 'ok', opcao } : { status: 'invalido' };
  }

  // Tenta o texto INTEIRO primeiro — cobre fazendas cujo próprio nome já
  // começa com "Fazenda ...". Só remove o prefixo de comando
  // ("usar"/"fazenda") se o texto inteiro não resolveu nada, para não
  // truncar o nome real de uma fazenda que comece com essa palavra.
  const direto = resolverFazendaPorNome(lista, bruto);
  if (direto.status !== 'nao_encontrado') return traduzir(direto);

  const mNome = bruto.match(RE_NOME_COM_PREFIXO);
  if (mNome) {
    const comPrefixo = resolverFazendaPorNome(lista, mNome[1].trim());
    if (comPrefixo.status !== 'nao_encontrado') return traduzir(comPrefixo);
  }
  return { status: 'nao_reconhecido' };
}
