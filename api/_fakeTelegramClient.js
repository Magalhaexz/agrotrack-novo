// Helper de teste compartilhado (NÃO é um arquivo *.test.js — não roda como
// suíte). Fake mínimo do client Supabase para os testes do orquestrador do
// bot: chain from().select().eq().maybeSingle(), insert/update/delete em
// memória, e `.rpc()` que espelha a lógica das RPCs transacionais reais
// (migration 20260716180853) sobre as mesmas tabelas em memória. Extraído de
// `api/_telegramBot.test.js` para reuso pelas matrizes sistemáticas de
// idempotência/permissão/multi-fazenda, sem duplicar ~150 linhas de fake.

export function makeClient(tables) {
  class Q {
    constructor(table) { this.table = table; this.filters = []; this._op = 'select'; this._patch = null; }
    select() { return this; }
    order() { return this; }
    limit() { return this; }
    eq(c, v) { this.filters.push([c, v]); return this; }
    insert(row) {
      const arr = tables[this.table] || (tables[this.table] = []);
      (Array.isArray(row) ? row : [row]).forEach((r) => arr.push({ id: r.id ?? `gen_${arr.length + 1}`, ...r }));
      return Promise.resolve({ data: null, error: null });
    }
    update(patch) { this._op = 'update'; this._patch = patch; return this; }
    delete() { this._op = 'delete'; return this; }
    _match(r) { return this.filters.every(([c, v]) => String(r[c]) === String(v)); }
    _run(single) {
      const arr = tables[this.table] || [];
      if (this._op === 'update') {
        const matched = arr.filter((r) => this._match(r));
        matched.forEach((r) => Object.assign(r, this._patch));
        return { data: single ? (matched[0] || null) : matched, error: null };
      }
      if (this._op === 'delete') {
        const matched = arr.filter((r) => this._match(r));
        tables[this.table] = arr.filter((r) => !this._match(r));
        return { data: single ? (matched[0] || null) : matched, error: null };
      }
      const matched = arr.filter((r) => this._match(r));
      return { data: single ? (matched[0] || null) : matched, error: null };
    }
    maybeSingle() { return Promise.resolve(this._run(true)); }
    then(res, rej) { return Promise.resolve(this._run(false)).then(res, rej); }
  }

  function nextId(tabela) {
    const arr = tables[tabela] || (tables[tabela] = []);
    return `${tabela}_${arr.length + 1}`;
  }

  const rpcImpl = {
    registrar_saida_lote(p) {
      const lote = tables.lotes.find((l) => String(l.id) === String(p.p_lote_id));
      if (!lote) return { error: 'LOTE_NAO_ENCONTRADO' };
      if (p.p_qtd > lote.qtd) return { error: 'ANIMAIS_INSUFICIENTES' };
      const movId = nextId('movimentacoes_animais');
      tables.movimentacoes_animais.push({
        id: movId, owner_user_id: p.p_owner_user_id, lote_id: p.p_lote_id,
        destino_lote_id: p.p_tipo === 'transferencia_saida' ? p.p_destino_lote_id : null,
        tipo: p.p_tipo, qtd: p.p_qtd, peso_medio: p.p_peso_medio, valor_total: p.p_valor_total,
        custo_por_cabeca: p.p_custo_por_cabeca, data: p.p_data,
        comprador_fornecedor: p.p_comprador_fornecedor, obs: p.p_obs,
      });
      lote.qtd -= p.p_qtd;
      let finId = null;
      if ((p.p_tipo === 'venda' || p.p_tipo === 'abate') && (p.p_valor_total || 0) > 0) {
        finId = nextId('movimentacoes_financeiras');
        tables.movimentacoes_financeiras.push({
          id: finId, owner_user_id: p.p_owner_user_id, lote_id: p.p_lote_id, tipo: 'receita',
          categoria: p.p_tipo === 'abate' ? 'abate_animal' : 'venda_animal', valor: p.p_valor_total,
          data: p.p_data, status: 'realizado', descricao: p.p_obs, origem_id: movId, origem_tipo: 'movimentacao_animal',
        });
      }
      if (p.p_tipo === 'transferencia_saida') {
        const destino = tables.lotes.find((l) => String(l.id) === String(p.p_destino_lote_id));
        destino.qtd += p.p_qtd;
        if (p.p_peso_destino_final != null) destino.p_at = p.p_peso_destino_final;
      }
      return { data: [{ movimentacao_id: movId, financeiro_id: finId }] };
    },
    ajustar_lotacao_lote(p) {
      const lote = tables.lotes.find((l) => String(l.id) === String(p.p_lote_id));
      if (!lote) return { error: 'LOTE_NAO_ENCONTRADO' };
      const delta = p.p_nova_qtd - lote.qtd;
      const movId = nextId('movimentacoes_animais');
      tables.movimentacoes_animais.push({ id: movId, owner_user_id: p.p_owner_user_id, lote_id: p.p_lote_id, tipo: 'ajuste', qtd: delta, data: p.p_data, obs: p.p_motivo });
      lote.qtd = p.p_nova_qtd;
      return { data: [{ movimentacao_id: movId }] };
    },
    finalizar_lote(p) {
      const lote = tables.lotes.find((l) => String(l.id) === String(p.p_lote_id));
      if (!lote) return { error: 'LOTE_NAO_ENCONTRADO' };
      lote.status = p.p_status;
      lote.data_encerramento = p.p_data_encerramento;
      lote.data_venda = p.p_status === 'vendido' ? (p.p_data_venda || p.p_data_encerramento) : null;
      if (p.p_motivo) lote.motivo_encerramento = p.p_motivo;
      return { data: null };
    },
    mover_lote_para_pasto_bot(p) {
      const lote = tables.lotes.find((l) => String(l.id) === String(p.p_lote_id));
      if (!lote) return { error: 'LOTE_NAO_ENCONTRADO' };
      const historico = tables.lote_pastagens_historico || (tables.lote_pastagens_historico = []);
      historico.push({
        id: nextId('lote_pastagens_historico'), owner_user_id: p.p_owner_user_id, lote_id: p.p_lote_id,
        faz_id: lote.faz_id, pastagem_origem_id: lote.pastagem_id ?? null,
        pastagem_destino_id: p.p_pastagem_destino_id, data_movimentacao: p.p_data,
        quantidade_cabecas: p.p_quantidade_cabecas, motivo: p.p_motivo, observacoes: p.p_observacoes,
      });
      lote.pastagem_id = p.p_pastagem_destino_id;
      return { data: null };
    },
    editar_ultima_pesagem_lote(p) {
      const pesagem = tables.pesagens.find((x) => String(x.id) === String(p.p_pesagem_id));
      if (!pesagem) return { error: 'PESAGEM_NAO_ENCONTRADA' };
      pesagem.peso_medio = p.p_novo_peso;
      if (p.p_nova_data) pesagem.data = p.p_nova_data;
      const doLote = tables.pesagens.filter((x) => x.lote_id === pesagem.lote_id).sort((a, b) => String(b.data).localeCompare(String(a.data)));
      const lote = tables.lotes.find((l) => l.id === pesagem.lote_id);
      if (lote && doLote[0]) { lote.p_at = doLote[0].peso_medio; lote.ultima_pesagem = doLote[0].data; }
      return { data: null };
    },
    excluir_ultima_pesagem_lote(p) {
      const idx = tables.pesagens.findIndex((x) => String(x.id) === String(p.p_pesagem_id));
      if (idx === -1) return { error: 'PESAGEM_NAO_ENCONTRADA' };
      const [removida] = tables.pesagens.splice(idx, 1);
      const lote = tables.lotes.find((l) => l.id === removida.lote_id);
      const restantes = tables.pesagens.filter((x) => x.lote_id === removida.lote_id).sort((a, b) => String(b.data).localeCompare(String(a.data)));
      if (lote) {
        if (restantes[0]) { lote.p_at = restantes[0].peso_medio; lote.ultima_pesagem = restantes[0].data; } else { lote.ultima_pesagem = null; }
      }
      return { data: null };
    },
    criar_lote_completo(p) {
      const loteId = nextId('lotes');
      tables.lotes.push({
        id: loteId, owner_user_id: p.p_owner_user_id, nome: p.p_nome, faz_id: p.p_faz_id,
        pastagem_id: p.p_pastagem_id ?? null, entrada: p.p_data_entrada, status: 'ativo',
        raca: p.p_raca || '', sexo: p.p_sexo, qtd: p.p_qtd, p_ini: p.p_peso_inicial || 0, p_at: p.p_peso_inicial || 0,
        rendimento_carcaca: p.p_rendimento_carcaca ?? 52, obs: p.p_observacao || null,
      });
      if (p.p_qtd > 0) {
        tables.animais.push({ id: nextId('animais'), owner_user_id: p.p_owner_user_id, fazenda_id: p.p_faz_id, lote_id: loteId, identificacao: p.p_nome, tipo_registro: 'grupo', qtd: p.p_qtd, p_at: p.p_peso_inicial || 0 });
      }
      if ((p.p_peso_inicial || 0) > 0) {
        tables.pesagens.push({ id: nextId('pesagens'), owner_user_id: p.p_owner_user_id, lote_id: loteId, data: p.p_data_entrada, peso_medio: p.p_peso_inicial, tipo: 'lote', origem: 'telegram' });
      }
      if (p.p_pastagem_id) {
        const historico = tables.lote_pastagens_historico || (tables.lote_pastagens_historico = []);
        historico.push({ id: nextId('lote_pastagens_historico'), owner_user_id: p.p_owner_user_id, lote_id: loteId, faz_id: p.p_faz_id, pastagem_destino_id: p.p_pastagem_id });
      }
      return { data: loteId };
    },
    parear_telegram_por_codigo(p) {
      const codigos = tables.telegram_connection_codes || (tables.telegram_connection_codes = []);
      const codeRow = codigos.find((c) => c.code === p.p_code);
      const usavel = codeRow && !codeRow.used_at && new Date(codeRow.expires_at).getTime() > Date.now();
      if (!usavel) {
        return { data: [{ sucesso: false, connection_id: null, owner_user_id: null, fazenda_id: null }] };
      }
      const conexoes = tables.telegram_connections || (tables.telegram_connections = []);
      let conexao = conexoes.find((c) => String(c.user_id) === String(codeRow.user_id));
      if (conexao) {
        Object.assign(conexao, {
          owner_user_id: codeRow.owner_user_id, fazenda_id: codeRow.fazenda_id,
          telegram_chat_id: p.p_chat_id, telegram_username: p.p_username,
          telegram_first_name: p.p_first_name, telegram_last_name: p.p_last_name, is_active: true,
        });
      } else {
        conexao = {
          id: nextId('telegram_connections'), owner_user_id: codeRow.owner_user_id, user_id: codeRow.user_id,
          fazenda_id: codeRow.fazenda_id, telegram_chat_id: p.p_chat_id, telegram_username: p.p_username,
          telegram_first_name: p.p_first_name, telegram_last_name: p.p_last_name, is_active: true,
        };
        conexoes.push(conexao);
      }
      codeRow.used_at = new Date().toISOString();
      return { data: [{ sucesso: true, connection_id: conexao.id, owner_user_id: codeRow.owner_user_id, fazenda_id: codeRow.fazenda_id }] };
    },
  };

  return {
    from: (t) => new Q(t),
    rpc: (nome, params) => {
      const impl = rpcImpl[nome];
      if (!impl) return Promise.resolve({ data: null, error: { message: `RPC desconhecida no fake: ${nome}` } });
      const resultado = impl(params);
      if (resultado.error) return Promise.resolve({ data: null, error: { message: resultado.error } });
      return Promise.resolve({ data: resultado.data ?? null, error: null });
    },
  };
}

/** Tabelas base de uma conta (Santa Clara, 1 fazenda, 2 lotes) para os testes. */
export function baseTables(perfil = 'operador') {
  return {
    fazendas: [{ id: 1, nome: 'Santa Clara', owner_user_id: 'o1' }],
    lotes: [
      { id: 10, nome: 'Recria 01', status: 'ativo', qtd: 82, p_at: 312, faz_id: 1, owner_user_id: 'o1' },
      { id: 11, nome: 'Engorda 02', status: 'ativo', qtd: 64, p_at: 478, faz_id: 1, owner_user_id: 'o1' },
    ],
    animais: [
      { id: 1, lote_id: 10, qtd: 82, p_at: 312, owner_user_id: 'o1' },
      { id: 2, lote_id: 11, qtd: 64, p_at: 478, owner_user_id: 'o1' },
    ],
    profiles: [{ id: 'u1', perfil }],
    pesagens: [], movimentacoes_financeiras: [], estoque: [], movimentacoes_estoque: [],
    tarefas: [], sanitario: [], pastagens: [], alertas_tratativas: [],
    telegram_operacoes_pendentes: [], telegram_bot_auditoria: [], movimentacoes_animais: [],
    telegram_conversas: [], lote_pastagens_historico: [],
  };
}

export const conexao = () => ({ id: 'c1', owner_user_id: 'o1', user_id: 'u1', telegram_chat_id: '123', fazenda_id: 1 });
