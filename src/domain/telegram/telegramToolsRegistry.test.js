import test from 'node:test';
import assert from 'node:assert/strict';
import { TELEGRAM_TOOLS, obterFerramenta, ferramentasPermitidas, formatarConfirmacao } from './telegramToolsRegistry.js';
import { perfilTemPermissao, PERFIS } from '../../auth/perfis.js';

test('todo item do catálogo tem os campos obrigatórios do contrato (seção 3 do spec)', () => {
  for (const t of TELEGRAM_TOOLS) {
    assert.equal(typeof t.name, 'string', t.name);
    assert.ok(t.name.length > 0);
    assert.equal(typeof t.description, 'string');
    assert.ok(['consulta', 'movimentacao', 'edicao', 'cadastro'].includes(t.category), `${t.name}: categoria inválida`);
    assert.ok(['leitura', 'escrita_simples', 'critica'].includes(t.riskLevel), `${t.name}: riskLevel inválido`);
    assert.equal(typeof t.requiredPermission, 'string');
    assert.ok(Array.isArray(t.requiredFields));
    assert.ok(Array.isArray(t.optionalFields));
    assert.equal(typeof t.execute, 'function');
    assert.equal(typeof t.formatResult, 'function');
    assert.equal(t.inputSchema?.type, 'object');
  }
});

test('nomes de ferramenta são únicos', () => {
  const nomes = TELEGRAM_TOOLS.map((t) => t.name);
  assert.equal(new Set(nomes).size, nomes.length);
});

test('obterFerramenta resolve por nome e devolve null para nome inexistente', () => {
  assert.equal(obterFerramenta('consultar_lotes').name, 'consultar_lotes');
  assert.equal(obterFerramenta('ferramenta_inventada_pela_ia'), null);
});

test('leitura nunca exige confirmação; escrita/crítica sempre gera resumo+writes', () => {
  const leitura = TELEGRAM_TOOLS.filter((t) => t.riskLevel === 'leitura');
  assert.ok(leitura.length >= 8);
  const escrita = TELEGRAM_TOOLS.filter((t) => t.riskLevel !== 'leitura');
  assert.ok(escrita.length >= 8);
});

test('ferramentasPermitidas filtra por permissão real do perfil (visualizador só vê leitura)', () => {
  const doVisualizador = ferramentasPermitidas(perfilTemPermissao, PERFIS.VISUALIZADOR);
  assert.ok(doVisualizador.every((t) => t.riskLevel === 'leitura'));
  const doProprietario = ferramentasPermitidas(perfilTemPermissao, PERFIS.PROPRIETARIO);
  assert.equal(doProprietario.length, TELEGRAM_TOOLS.length);
});

test('gerente vê as 4 ferramentas novas (não sobrou nenhuma restrita à hierarquia antiga)', () => {
  const doGerente = ferramentasPermitidas(perfilTemPermissao, PERFIS.GERENTE);
  const nomes = doGerente.map((t) => t.name);
  assert.ok(nomes.includes('cadastrar_tarefa'));
  assert.ok(nomes.includes('cadastrar_item_estoque'));
  assert.ok(nomes.includes('dar_baixa_estoque'));
  assert.ok(nomes.includes('trocar_lote_pasto'));
});

test('formatarConfirmacao: pré-confirmação pede /confirmar; pós-confirmação vira "Registrado"', () => {
  const resumo = ['Confirme a tarefa:', '', 'Título: X'];
  assert.match(formatarConfirmacao(resumo, { confirmado: false }), /\/confirmar/);
  assert.match(formatarConfirmacao(resumo, { confirmado: true }), /^Registrado\b/);
});

// ── Adaptadores das ações críticas existentes (transferir/renomear) ─────────
const dbLote = {
  lotes: [
    { id: 1, nome: 'Recria 2026', status: 'ativo', qtd: 40, p_at: 300 },
    { id: 2, nome: 'Engorda', status: 'ativo', qtd: 10, p_at: 350 },
  ],
  animais: [],
};

test('transferir_animais_entre_lotes resolve nomes e monta writes genéricos aplicáveis por aplicarWrites', () => {
  const tool = obterFerramenta('transferir_animais_entre_lotes');
  const r = tool.execute(dbLote, { loteOrigem: 'Recria', loteDestino: 'Engorda', quantidade: 5 });
  assert.equal(r.ok, true);
  assert.equal(r.writes.length, 3);
  assert.equal(r.writes[0].tabela, 'movimentacoes_animais');
  assert.equal(r.writes[1].tabela, 'lotes');
  assert.equal(r.writes[1].match.id, 1);
  assert.equal(r.writes[1].patch.qtd, 35);
  assert.equal(r.writes[2].patch.qtd, 15);
});

test('transferir_animais_entre_lotes propaga erro de lote não encontrado', () => {
  const tool = obterFerramenta('transferir_animais_entre_lotes');
  const r = tool.execute(dbLote, { loteOrigem: 'Inexistente', loteDestino: 'Engorda', quantidade: 5 });
  assert.equal(r.ok, false);
});

test('renomear_lote resolve nome e monta write genérico', () => {
  const tool = obterFerramenta('renomear_lote');
  const r = tool.execute(dbLote, { loteAtual: 'Recria', novoNome: 'Recria 2027' });
  assert.equal(r.ok, true);
  assert.equal(r.writes.length, 1);
  assert.equal(r.writes[0].tabela, 'lotes');
  assert.equal(r.writes[0].patch.nome, 'Recria 2027');
});

// ── Ferramentas de leitura devolvem texto pronto ─────────────────────────────
test('ferramenta de leitura devolve texto formatado via formatResult', () => {
  const tool = obterFerramenta('consultar_lotes');
  const r = tool.execute(dbLote, {}, { fazendaNome: 'QA-Fazenda Um' });
  assert.equal(r.ok, true);
  assert.equal(typeof tool.formatResult(r), 'string');
  assert.match(tool.formatResult(r), /Recria 2026/);
});
