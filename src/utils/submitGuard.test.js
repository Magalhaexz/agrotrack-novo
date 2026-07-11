import test from 'node:test';
import assert from 'node:assert/strict';
import { criarTravaSubmissao } from './submitGuard.js';

// Cobre o fluxo pedido no sprint (Fase 5 — 7.2/7.3):
//   clique único · clique duplo · Enter repetido · resposta lenta · sucesso ·
//   falha · nova tentativa após falha · somente uma chamada a onSave ·
//   estado de ocupado (proxy do loading) · trava sempre libera no fim.
// A trava é agnóstica à origem do evento (clique ou Enter): qualquer segunda
// chamada concorrente, de onde vier, é ignorada — por isso "Enter repetido"
// e "clique duplo" são o mesmo cenário testado (concorrência), e ambos cobertos
// pelos mesmos testes abaixo.

test('clique único: executa a ação normalmente e retorna o resultado (onSave chamado 1x)', async () => {
  const trava = criarTravaSubmissao();
  let chamadas = 0;
  const onSave = () => { chamadas += 1; return Promise.resolve({ ok: true }); };

  const r = await trava.executar(onSave);
  assert.equal(chamadas, 1);
  assert.equal(r.ignorado, false);
  assert.deepEqual(r.resultado, { ok: true });
});

test('clique duplo (ou Enter repetido): a segunda chamada concorrente é ignorada, onSave roda 1x só', async () => {
  const trava = criarTravaSubmissao();
  let chamadas = 0;
  const onSave = () => new Promise((resolve) => {
    chamadas += 1;
    setTimeout(() => resolve('salvo'), 20); // resposta lenta
  });

  const [primeiro, segundo] = await Promise.all([trava.executar(onSave), trava.executar(onSave)]);
  assert.equal(chamadas, 1, 'onSave deve ser chamado exatamente uma vez');
  assert.equal(primeiro.ignorado, false);
  assert.equal(primeiro.resultado, 'salvo');
  assert.equal(segundo.ignorado, true, 'a segunda chamada concorrente deve ser ignorada');
});

test('três chamadas concorrentes (duplo clique + Enter): só a primeira executa', async () => {
  const trava = criarTravaSubmissao();
  let chamadas = 0;
  const onSave = () => new Promise((resolve) => { chamadas += 1; setTimeout(resolve, 15); });

  const resultados = await Promise.all([trava.executar(onSave), trava.executar(onSave), trava.executar(onSave)]);
  assert.equal(chamadas, 1);
  assert.equal(resultados.filter((r) => !r.ignorado).length, 1);
  assert.equal(resultados.filter((r) => r.ignorado).length, 2);
});

test('resposta lenta: estaOcupado() fica true durante a execução e false ao concluir', async () => {
  const trava = criarTravaSubmissao();
  assert.equal(trava.estaOcupado(), false);

  const promise = trava.executar(() => new Promise((resolve) => setTimeout(() => resolve('ok'), 15)));
  assert.equal(trava.estaOcupado(), true, 'deve ficar ocupado enquanto a Promise não resolve (proxy do loading)');

  await promise;
  assert.equal(trava.estaOcupado(), false, 'deve liberar assim que a ação conclui');
});

test('falha: o erro se propaga (para o form capturar e mostrar mensagem) e a trava libera', async () => {
  const trava = criarTravaSubmissao();
  const erro = new Error('Falha ao salvar pesagem');

  await assert.rejects(trava.executar(() => Promise.reject(erro)), erro);
  assert.equal(trava.estaOcupado(), false, 'trava deve liberar mesmo após erro, permitindo nova tentativa');
});

test('nova tentativa após falha: a segunda submissão executa normalmente e tem sucesso', async () => {
  const trava = criarTravaSubmissao();
  let tentativa = 0;
  const onSave = () => {
    tentativa += 1;
    if (tentativa === 1) return Promise.reject(new Error('rede instável'));
    return Promise.resolve('salvo na segunda tentativa');
  };

  await assert.rejects(trava.executar(onSave));
  assert.equal(trava.estaOcupado(), false);

  const segunda = await trava.executar(onSave);
  assert.equal(tentativa, 2);
  assert.equal(segunda.ignorado, false);
  assert.equal(segunda.resultado, 'salvo na segunda tentativa');
});

test('sucesso: libera a trava e permite nova submissão independente depois', async () => {
  const trava = criarTravaSubmissao();
  await trava.executar(() => Promise.resolve('ok'));
  assert.equal(trava.estaOcupado(), false);
  const segunda = await trava.executar(() => Promise.resolve('again'));
  assert.equal(segunda.ignorado, false);
  assert.equal(segunda.resultado, 'again');
});
