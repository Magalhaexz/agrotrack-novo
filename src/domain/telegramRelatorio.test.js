import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarRelatorioDiarioTelegram } from './telegramRelatorio.js';

function alerta(prioridade, titulo) {
  return { id: `x-${titulo}`, tipo: 'x', prioridade, origem: 'financeiro', titulo, descricao: 'detalhe sensível não deve aparecer', acaoSugerida: 'Agir', pageId: 'dashboard' };
}

test('gerarRelatorioDiarioTelegram agrupa por prioridade e ignora informativo', () => {
  const alertas = [
    alerta('critico', '2 contas estão vencidas'),
    alerta('atencao', '1 pagamento vence hoje'),
    alerta('decisao', '1 lote está pronto para avaliar venda'),
    alerta('informativo', 'sinal de baixa relevância'),
  ];
  const texto = gerarRelatorioDiarioTelegram(alertas, { agora: new Date('2026-07-05T12:00:00Z') });

  assert.match(texto, /HERDON — Relatório de hoje \(05\/07\/2026\)/);
  assert.match(texto, /🔴 CRÍTICO/);
  assert.match(texto, /2 contas estão vencidas/);
  assert.match(texto, /🟡 ATENÇÃO/);
  assert.match(texto, /1 pagamento vence hoje/);
  assert.match(texto, /🟢 DECISÃO/);
  assert.match(texto, /1 lote está pronto para avaliar venda/);
  assert.doesNotMatch(texto, /sinal de baixa relevância/);
  assert.match(texto, /Abra o HERDON para ver detalhes e agir\.$/);
});

test('gerarRelatorioDiarioTelegram não expõe a descrição detalhada de cada alerta', () => {
  const texto = gerarRelatorioDiarioTelegram([alerta('critico', '1 conta está vencida')]);
  assert.doesNotMatch(texto, /detalhe sensível não deve aparecer/);
});

test('gerarRelatorioDiarioTelegram avisa quando não há prioridades pendentes', () => {
  const texto = gerarRelatorioDiarioTelegram([]);
  assert.match(texto, /Nenhuma prioridade pendente hoje/);
});

test('gerarRelatorioDiarioTelegram limita a quantidade de itens por grupo', () => {
  const muitos = Array.from({ length: 9 }, (_, i) => alerta('atencao', `item ${i + 1}`));
  const texto = gerarRelatorioDiarioTelegram(muitos);
  assert.match(texto, /item 1/);
  assert.match(texto, /item 6/);
  assert.doesNotMatch(texto, /item 7\b/);
  assert.match(texto, /\+3 outro\(s\) alerta\(s\) nesta faixa/);
});

test('gerarRelatorioDiarioTelegram inclui nome da conta quando informado', () => {
  const texto = gerarRelatorioDiarioTelegram([alerta('critico', 'x')], { nomeConta: 'Fazenda Modelo' });
  assert.match(texto, /Relatório de hoje \(\d{2}\/\d{2}\/\d{4}\) — Fazenda Modelo/);
});
