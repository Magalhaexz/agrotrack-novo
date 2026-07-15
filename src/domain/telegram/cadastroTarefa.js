// Cadastro de tarefa via linguagem natural (Assistente IA). Puro, sem I/O.
// Mesma tabela/campos de `EMPTY_TASK` em `src/pages/TarefasPage.jsx` — não é
// um cadastro por conversa em etapas (a IA extrai os campos da mensagem em
// uma única chamada); o slot que faltar vira pergunta de esclarecimento do
// próprio modelo, não um estado de conversa novo.
import { resolverLotePorNome, normalizarChave } from './resolvedores.js';
import { hojeLocalISO } from '../dataCivil.js';

const erro = (codigo, extra = {}) => ({ ok: false, erro: codigo, ...extra });

const PRIORIDADES = ['baixa', 'media', 'alta', 'critica'];
const CATEGORIAS = ['manejo', 'sanitario', 'manutencao', 'administrativo', 'estoque'];

function resolverResponsavelPorNome(funcionarios, nome) {
  const lista = Array.isArray(funcionarios) ? funcionarios : [];
  const alvo = normalizarChave(nome);
  if (!alvo) return { status: 'nao_encontrado', candidatos: [] };
  const casa = (f) => normalizarChave(f?.nome) === alvo;
  const exatos = lista.filter(casa);
  if (exatos.length === 1) return { status: 'ok', funcionario: exatos[0] };
  if (exatos.length > 1) return { status: 'ambiguo', candidatos: exatos };
  const parciais = lista.filter((f) => normalizarChave(f?.nome).includes(alvo));
  if (parciais.length === 1) return { status: 'ok', funcionario: parciais[0] };
  if (parciais.length > 1) return { status: 'ambiguo', candidatos: parciais };
  return { status: 'nao_encontrado', candidatos: [] };
}

/**
 * @param {object} db — já recortado pela fazenda ativa da conexão.
 * @param {object} dados — { titulo, data_vencimento, descricao?, lote?, responsavel?, categoria?, prioridade? }
 * @param {{ fazendaId?: number|null }} ctx
 */
export function prepararCadastroTarefa(db, dados, ctx = {}) {
  const titulo = String(dados?.titulo || '').trim();
  if (!titulo) return erro('TITULO_VAZIO');
  const dataVencimento = dados?.data_vencimento || null;
  if (!dataVencimento) return erro('DATA_VENCIMENTO_VAZIA');

  const prioridade = PRIORIDADES.includes(dados?.prioridade) ? dados.prioridade : 'media';
  const categoria = CATEGORIAS.includes(dados?.categoria) ? dados.categoria : 'manejo';

  let loteId = null;
  let loteNome = null;
  if (dados?.lote) {
    const r = resolverLotePorNome(db.lotes, dados.lote, { somenteAtivos: true });
    if (r.status === 'ambiguo') return erro('LOTE_AMBIGUO', { candidatos: r.candidatos });
    if (r.status !== 'ok') return erro('LOTE_NAO_ENCONTRADO');
    loteId = r.lote.id;
    loteNome = r.lote.nome;
  }

  let responsavelId = null;
  let responsavelNome = null;
  if (dados?.responsavel) {
    const r = resolverResponsavelPorNome(db.funcionarios, dados.responsavel);
    if (r.status === 'ambiguo') return erro('RESPONSAVEL_AMBIGUO', { candidatos: r.candidatos });
    if (r.status !== 'ok') return erro('RESPONSAVEL_NAO_ENCONTRADO');
    responsavelId = r.funcionario.id;
    responsavelNome = r.funcionario.nome;
  }

  return {
    ok: true,
    resumo: [
      'Confirme a tarefa:',
      '',
      `Título: ${titulo}`,
      `Vencimento: ${dataVencimento}`,
      `Prioridade: ${prioridade}`,
      loteNome ? `Lote: ${loteNome}` : null,
      responsavelNome ? `Responsável: ${responsavelNome}` : null,
      dados?.descricao ? `Descrição: ${dados.descricao}` : null,
    ].filter(Boolean),
    writes: [{
      tabela: 'tarefas',
      tipo: 'insert',
      registro: {
        titulo,
        descricao: dados?.descricao || '',
        prioridade,
        categoria,
        status: 'pendente',
        responsavel_id: responsavelId,
        lote_id: loteId,
        fazenda_id: ctx.fazendaId ?? null,
        data_vencimento: dataVencimento,
        created_at: new Date().toISOString(),
      },
    }],
  };
}

export function hojeParaTarefa() {
  return hojeLocalISO();
}
