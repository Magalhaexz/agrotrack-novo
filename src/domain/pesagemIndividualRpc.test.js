import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Revisão crítica pré-commit: a RPC transacional (registrar_pesagem_individual/
// excluir_pesagem_individual) não pôde ser executada contra um Postgres real
// nesta sprint (sem branch Supabase disponível no plano atual, sem Docker/CLI
// local — decisão explícita do usuário de prosseguir sem teste ao vivo). Estes
// testes NÃO substituem execução real; são uma checagem estática do texto da
// migration para travar, em CI, contra regressões óbvias nos invariantes que
// a revisão exigiu (ex.: alguém reintroduzir a atualização de p_ini, ou
// remover o escopo por pesagem_principal_id). Se a migration for reescrita
// de forma equivalente mas com outro texto, este teste pode precisar de
// ajuste — ele verifica o comportamento documentado, não a única forma
// possível de escrevê-lo.
const sqlPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'supabase', 'migrations', '20260727120000_rpcs_transacionais_pesagem_individual.sql'
);
const sql = readFileSync(sqlPath, 'utf8');

test('migration existe e define as duas RPCs esperadas', () => {
  assert.match(sql, /create or replace function public\.registrar_pesagem_individual/);
  assert.match(sql, /create or replace function public\.excluir_pesagem_individual/);
});

test('nenhum "update public.lotes" da migration toca p_ini/peso_inicial', () => {
  // Peso inicial nunca é recalculado por pesagem — só p_at/peso_atual/
  // peso_medio_atual/ultima_pesagem. Regressão: se alguém adicionar
  // "p_ini = ..." a um desses UPDATEs, este teste quebra.
  let posicao = 0;
  let encontrados = 0;
  for (;;) {
    const idx = sql.indexOf('update public.lotes', posicao);
    if (idx === -1) break;
    encontrados += 1;
    const fimIdx = sql.indexOf(';', idx);
    const bloco = sql.slice(idx, fimIdx);
    assert.doesNotMatch(bloco, /\bp_ini\b/i);
    assert.doesNotMatch(bloco, /\bpeso_inicial\b/i);
    posicao = fimIdx;
  }
  assert.ok(encontrados >= 2, 'esperava pelo menos 2 UPDATEs em public.lotes (criar/editar e excluir)');
});

test('recálculo do peso do lote sempre ordena por "data desc, id desc" (não assume que o registro tocado é o mais recente)', () => {
  const ocorrencias = sql.match(/order by data desc, id desc/g) || [];
  assert.ok(ocorrencias.length >= 2, 'esperava a mesma regra de desempate em registrar_pesagem_individual e excluir_pesagem_individual');
});

test('reconciliação de filhos (update/delete) é sempre escopada por pesagem_principal_id — nunca só por lote+data', () => {
  // O ponto central da revisão: uma pesagem nova (p_pesagem_principal_id IS
  // NULL) nunca deve encontrar/mesclar com filhos de outra pesagem do mesmo
  // lote/data. O SELECT que procura "filho existente para atualizar" e o
  // DELETE de reconciliação precisam sempre filtrar por
  // (metadata->>'pesagem_principal_id')::bigint = p_pesagem_principal_id.
  const trechoBuscaExistente = sql.slice(sql.indexOf('v_existente := null;'), sql.indexOf('if v_existente.id is not null then'));
  assert.match(trechoBuscaExistente, /\(metadata->>'pesagem_principal_id'\)::bigint = p_pesagem_principal_id/);

  const trechoDelete = sql.slice(sql.indexOf('-- Reconciliação de edição'), sql.indexOf('-- ── Recalcula o peso atual do lote'));
  assert.match(trechoDelete, /delete from public\.pesagens/);
  assert.match(trechoDelete, /\(metadata->>'pesagem_principal_id'\)::bigint = p_pesagem_principal_id/);
});

test('excluir_pesagem_individual apaga filhos E principal na mesma função (nunca deixa peso órfão)', () => {
  const inicioFn = sql.indexOf('create or replace function public.excluir_pesagem_individual');
  const corpoFn = sql.slice(inicioFn);
  const idxDeleteFilhos = corpoFn.indexOf("coalesce(tipo, 'lote') = 'animal'");
  const idxDeletePrincipal = corpoFn.indexOf('delete from public.pesagens where id = p_pesagem_principal_id');
  assert.ok(idxDeleteFilhos >= 0 && idxDeletePrincipal >= 0 && idxDeleteFilhos < idxDeletePrincipal);
});

test('ambas as RPCs são security definer com search_path fixo e app_assert_owner_write como única porta de entrada', () => {
  const blocos = sql.split('create or replace function public.').slice(1);
  assert.equal(blocos.length, 2);
  blocos.forEach((bloco) => {
    assert.match(bloco, /security definer/);
    assert.match(bloco, /set search_path = public/);
    assert.match(bloco, /perform public\.app_assert_owner_write\(p_owner_user_id\)/);
  });
});
