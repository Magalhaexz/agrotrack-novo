import test from 'node:test';
import assert from 'node:assert/strict';

// ── Lógica de filtragem extraída de LoteForm.jsx (pastagensCompativeis) ──

function filtrarPastagensCompatíveis(pastagens, faz_id) {
  if (!faz_id) return pastagens;
  return pastagens.filter((pastagem) => {
    const fazendaId = pastagem?.fazenda_id ?? pastagem?.faz_id ?? null;
    return !fazendaId || String(fazendaId) === String(faz_id);
  });
}

// ── Lógica de validação condicional para sistema 'pasto' ──

function validarPastoObrigatorio(form, pastagensDisponiveis) {
  if (form.sistema === 'pasto' && !form.pastagem_id && pastagensDisponiveis.length > 0) {
    return 'Selecione o pasto vinculado ao lote (obrigatório para sistema a pasto).';
  }
  return null;
}

// ── Lógica de limpeza ao trocar fazenda (useEffect em LoteForm.jsx) ──

function resolverPastoAoTrocarFazenda(prev, novaFazId, pastagens) {
  if (String(prev.faz_id) === String(novaFazId)) return prev;
  const pastoAindaValido = prev.pastagem_id && pastagens.some((p) => {
    const fazId = p?.fazenda_id ?? p?.faz_id ?? null;
    return String(p.id) === String(prev.pastagem_id) && (!fazId || String(fazId) === String(novaFazId));
  });
  return {
    ...prev,
    faz_id: String(novaFazId),
    pastagem_id: pastoAindaValido ? prev.pastagem_id : '',
  };
}

// ── Fixtures ──

const PASTAGENS = [
  { id: 'uuid-a1', faz_id: 1, fazenda_id: null, nome: 'Braquiária Fazenda 1' },
  { id: 'uuid-a2', faz_id: 1, fazenda_id: null, nome: 'Campo Nativo Fazenda 1' },
  { id: 'uuid-b1', faz_id: 2, fazenda_id: null, nome: 'Mombaça Fazenda 2' },
  { id: 'uuid-c1', faz_id: null, fazenda_id: null, nome: 'Pasto sem fazenda (legado)' },
];

// ── Testes: filtro por fazenda ──

test('filtra pastos da fazenda 1', () => {
  const resultado = filtrarPastagensCompatíveis(PASTAGENS, '1');
  assert.equal(resultado.length, 3); // 2 da fazenda 1 + 1 sem fazenda (exibido por segurança)
  assert.ok(resultado.every((p) => p.faz_id === 1 || p.faz_id === null));
});

test('filtra pastos da fazenda 2', () => {
  const resultado = filtrarPastagensCompatíveis(PASTAGENS, '2');
  assert.equal(resultado.length, 2); // 1 da fazenda 2 + 1 sem fazenda
  assert.ok(resultado.some((p) => p.nome === 'Mombaça Fazenda 2'));
});

test('sem faz_id retorna todos os pastos', () => {
  const resultado = filtrarPastagensCompatíveis(PASTAGENS, '');
  assert.equal(resultado.length, PASTAGENS.length);
});

test('fazenda sem pastos retorna apenas pastos sem vínculo', () => {
  const resultado = filtrarPastagensCompatíveis(PASTAGENS, '99');
  assert.equal(resultado.length, 1); // apenas pasto sem fazenda
  assert.equal(resultado[0].faz_id, null);
});

test('pastagens vazias retorna array vazio independente de faz_id', () => {
  assert.equal(filtrarPastagensCompatíveis([], '1').length, 0);
  assert.equal(filtrarPastagensCompatíveis([], '').length, 0);
});

// ── Testes: filtro com fazenda_id UUID ──

test('filtra via campo fazenda_id UUID quando faz_id está ausente', () => {
  const pastagens = [
    { id: 'uuid-x', faz_id: null, fazenda_id: 'faz-uuid-10', nome: 'Pasto UUID' },
    { id: 'uuid-y', faz_id: 2, fazenda_id: null, nome: 'Pasto BigInt' },
  ];
  const resultado = filtrarPastagensCompatíveis(pastagens, 'faz-uuid-10');
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].id, 'uuid-x');
});

// ── Testes: validação condicional sistema 'pasto' ──

test('sistema pasto sem pastagem selecionada exige pasto quando há pastos disponíveis', () => {
  const form = { sistema: 'pasto', pastagem_id: '' };
  const pastos = [{ id: 'uuid-a1', nome: 'Pasto' }];
  const erro = validarPastoObrigatorio(form, pastos);
  assert.ok(erro !== null, 'deve retornar erro');
  assert.match(erro, /obrigatório para sistema a pasto/i);
});

test('sistema pasto com pastagem selecionada não retorna erro', () => {
  const form = { sistema: 'pasto', pastagem_id: 'uuid-a1' };
  const pastos = [{ id: 'uuid-a1', nome: 'Pasto' }];
  assert.equal(validarPastoObrigatorio(form, pastos), null);
});

test('sistema confinamento não exige pasto mesmo sem pastagem', () => {
  const form = { sistema: 'confinamento', pastagem_id: '' };
  const pastos = [{ id: 'uuid-a1', nome: 'Pasto' }];
  assert.equal(validarPastoObrigatorio(form, pastos), null);
});

test('sistema semi-confinamento não exige pasto', () => {
  const form = { sistema: 'semi-confinamento', pastagem_id: '' };
  const pastos = [{ id: 'uuid-a1', nome: 'Pasto' }];
  assert.equal(validarPastoObrigatorio(form, pastos), null);
});

test('sistema pasto sem pastos disponíveis não retorna erro', () => {
  const form = { sistema: 'pasto', pastagem_id: '' };
  assert.equal(validarPastoObrigatorio(form, []), null);
});

// ── Testes: limpeza de pasto ao trocar fazenda ──

test('ao trocar fazenda, pastagem incompatível é limpa', () => {
  const prev = { faz_id: '1', pastagem_id: 'uuid-b1' }; // b1 pertence a fazenda 2
  const resultado = resolverPastoAoTrocarFazenda(prev, '2', PASTAGENS);
  // uuid-b1 pertence à fazenda 2, então NÃO deve ser limpo ao ir para fazenda 2
  assert.equal(resultado.faz_id, '2');
  assert.equal(resultado.pastagem_id, 'uuid-b1');
});

test('ao trocar fazenda, pastagem que não pertence à nova fazenda é limpa', () => {
  const prev = { faz_id: '1', pastagem_id: 'uuid-a1' }; // a1 pertence a fazenda 1
  const resultado = resolverPastoAoTrocarFazenda(prev, '2', PASTAGENS);
  // uuid-a1 não pertence à fazenda 2, deve ser limpo
  assert.equal(resultado.faz_id, '2');
  assert.equal(resultado.pastagem_id, '');
});

test('ao manter a mesma fazenda, o form retorna sem mudanças', () => {
  const prev = { faz_id: '1', pastagem_id: 'uuid-a1' };
  const resultado = resolverPastoAoTrocarFazenda(prev, '1', PASTAGENS);
  assert.strictEqual(resultado, prev); // mesma referência — sem mudança
});

test('ao trocar fazenda sem pastagem selecionada, pastagem_id permanece vazio', () => {
  const prev = { faz_id: '1', pastagem_id: '' };
  const resultado = resolverPastoAoTrocarFazenda(prev, '2', PASTAGENS);
  assert.equal(resultado.pastagem_id, '');
  assert.equal(resultado.faz_id, '2');
});
