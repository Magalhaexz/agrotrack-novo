// Cadastro/renomeação de fazenda via linguagem natural (bot operacional
// determinístico). Puro, sem I/O. Mesmos campos de `FazendaModal.jsx`
// (nome obrigatório; cidade/estado/hectares/capacidade opcionais) — só os
// que o produtor realmente informa por chat.
//
// ponytail: não replica o esquema local_id/cloud_id de sincronização
// offline-first de `FazendasPage.jsx` — aquele mecanismo existe para
// reconciliar o app rodando sem rede no navegador; o bot roda sempre
// online, com o cliente de service role do webhook, então grava direto.
// Também NÃO valida o limite de fazendas do plano (`canCreateFarm`,
// `services/subscriptions.js`) — mesma lacuna já documentada (BM-30: a
// assinatura não é validada em RLS, só client-side); o bot criar uma
// fazenda acima do limite não abre um buraco novo de segurança, só herda
// o gap existente. Registrado como pendência real, não corrigido aqui.
import { normalizarChave } from './resolvedores.js';

const erro = (codigo, extra = {}) => ({ ok: false, erro: codigo, ...extra });

/**
 * @param {object} db — db da conta inteira (não recortado por fazenda —
 *   cadastro/renomeação de fazenda precisa ver todas para checar duplicidade).
 * @param {object} dados — { nome, cidade?, estado? }
 */
export function prepararCadastroFazenda(db, dados) {
  const nome = String(dados?.nome || '').trim();
  if (!nome) return erro('NOME_VAZIO');

  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
  const chaveNome = normalizarChave(nome);
  const duplicado = fazendas.some((f) => normalizarChave(f.nome) === chaveNome);
  if (duplicado) return erro('NOME_DUPLICADO');

  const cidade = String(dados?.cidade || '').trim();
  const estado = String(dados?.estado || '').trim().toUpperCase();

  return {
    ok: true,
    resumo: [
      'Confirme a nova fazenda:',
      '',
      `Nome: ${nome}`,
      cidade ? `Cidade: ${cidade}` : null,
      estado ? `Estado: ${estado}` : null,
    ].filter(Boolean),
    writes: [{
      tabela: 'fazendas',
      tipo: 'insert',
      registro: {
        nome,
        cidade,
        estado: estado || 'MG',
        hectares: 0,
        hectares_pastagem: 0,
        capacidade_lotacao: 0,
      },
    }],
  };
}

/**
 * @param {object} db — db da conta inteira.
 * @param {object} dados — { fazendaAtual, novoNome }
 */
export function prepararRenomearFazenda(db, { fazendaAtual, novoNome } = {}) {
  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
  const alvo = normalizarChave(fazendaAtual);
  const achados = fazendas.filter((f) => normalizarChave(f.nome).includes(alvo));
  if (achados.length === 0) return erro('FAZENDA_NAO_ENCONTRADA');
  if (achados.length > 1) return erro('FAZENDA_AMBIGUA', { candidatos: achados });
  const fazenda = achados[0];

  const nome = String(novoNome || '').trim();
  if (!nome) return erro('NOME_VAZIO');

  const chaveNova = normalizarChave(nome);
  if (chaveNova === normalizarChave(fazenda.nome)) return erro('NOME_IGUAL');
  const duplicado = fazendas.some((f) => Number(f.id) !== Number(fazenda.id) && normalizarChave(f.nome) === chaveNova);
  if (duplicado) return erro('NOME_DUPLICADO');

  return {
    ok: true,
    resumo: ['Confirme a alteração:', '', `Fazenda: ${fazenda.nome}`, `Novo nome: ${nome}`],
    writes: [{ tabela: 'fazendas', tipo: 'update', match: { id: fazenda.id }, patch: { nome } }],
  };
}

// ── Exclusão de fazenda (Sprint Paridade 1, bloco 5) ─────────────────────────
// Espelha a guarda real de `FazendasPage.jsx::excluirFazenda` — mesmos 5
// tipos de vínculo checados (lotes/animais/financeiro/estoque/sanitário). O
// app não verifica pastagens/tarefas/suplementação/equipe; o bot também não,
// de propósito, para não ficar mais restritivo que a própria fonte de
// verdade (ficaria inconsistente: um dado que o app deixa excluir a fazenda
// e o bot recusa). Sem inativação — o app não tem esse conceito para
// fazendas (só delete guardado).
function fazendaTemVinculos(db, fazendaId) {
  const chaves = new Set([String(fazendaId)]);
  const referencia = (item) => {
    const refs = [item?.faz_id, item?.fazenda_id, item?.fazendaId];
    return refs.some((ref) => chaves.has(String(ref ?? '')));
  };
  return ['lotes', 'animais', 'movimentacoes_financeiras', 'estoque', 'sanitario'].some(
    (colecao) => (Array.isArray(db?.[colecao]) ? db[colecao] : []).some(referencia)
  );
}

/**
 * @param {object} db — db da conta inteira.
 * @param {{ fazenda: string }} dados
 */
export function prepararExclusaoFazenda(db, { fazenda } = {}) {
  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
  const alvo = normalizarChave(fazenda);
  if (!alvo) return erro('FAZENDA_VAZIA');
  const exatas = fazendas.filter((f) => normalizarChave(f.nome) === alvo);
  const achadas = exatas.length > 0 ? exatas : fazendas.filter((f) => normalizarChave(f.nome).includes(alvo));
  if (achadas.length === 0) return erro('FAZENDA_NAO_ENCONTRADA');
  if (achadas.length > 1) return erro('FAZENDA_AMBIGUA', { candidatos: achadas });
  const alvoFazenda = achadas[0];

  if (fazendaTemVinculos(db, alvoFazenda.id)) return erro('FAZENDA_COM_VINCULOS');

  return {
    ok: true,
    resumo: [
      'Confirme a exclusão da fazenda:',
      '',
      `Fazenda: ${alvoFazenda.nome}`,
      '',
      'Esta ação não pode ser desfeita pelo bot.',
    ],
    writes: [{ tabela: 'fazendas', tipo: 'delete', match: { id: alvoFazenda.id } }],
  };
}
