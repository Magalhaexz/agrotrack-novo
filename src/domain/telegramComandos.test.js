import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretarComandoTelegram, gerarRespostaComandoTelegram } from './telegramComandos.js';

test('interpreta os comandos novos, com e sem @username do bot', () => {
  assert.equal(interpretarComandoTelegram('/start'), 'start');
  assert.equal(interpretarComandoTelegram('/start@HerdonAlertasBot'), 'start');
  assert.equal(interpretarComandoTelegram('/ajuda'), 'ajuda');
  assert.equal(interpretarComandoTelegram('/status'), 'status');
  assert.equal(interpretarComandoTelegram('/contas'), 'contas');
  assert.equal(interpretarComandoTelegram('/alertas@HerdonAlertasBot'), 'alertas');
});

test('devolve null para comandos do Sprint 8 (telegramIntent.js cuida)', () => {
  assert.equal(interpretarComandoTelegram('/relatorio'), null);
  assert.equal(interpretarComandoTelegram('/prioridades'), null);
  assert.equal(interpretarComandoTelegram('/pagamentos'), null);
  assert.equal(interpretarComandoTelegram('/estoque'), null);
  assert.equal(interpretarComandoTelegram('/tarefas'), null);
  assert.equal(interpretarComandoTelegram('/lotes'), null);
});

test('devolve null para texto livre e para código HERDON (fluxo de vínculo continua intacto)', () => {
  assert.equal(interpretarComandoTelegram('oi tudo bem'), null);
  assert.equal(interpretarComandoTelegram('HERDON-482913'), null);
  assert.equal(interpretarComandoTelegram(''), null);
  assert.equal(interpretarComandoTelegram(null), null);
});

test('devolve "desconhecido" para comando de barra não mapeado', () => {
  assert.equal(interpretarComandoTelegram('/teste'), 'desconhecido');
  assert.equal(interpretarComandoTelegram('/qualquercoisa'), 'desconhecido');
});

test('/start responde com orientação de vínculo', () => {
  const resposta = gerarRespostaComandoTelegram('start');
  assert.match(resposta, /HERDON-000000/);
  assert.match(resposta, /\/ajuda/);
});

test('/ajuda lista os comandos novos e os do Sprint 8', () => {
  const resposta = gerarRespostaComandoTelegram('ajuda');
  assert.match(resposta, /\/status/);
  assert.match(resposta, /\/alertas/);
  assert.match(resposta, /\/contas/);
  assert.match(resposta, /\/relatorio/);
});

test('/status confirma que o bot está ativo', () => {
  assert.match(gerarRespostaComandoTelegram('status'), /ativo/i);
});

test('/contas varia conforme vínculo', () => {
  assert.match(gerarRespostaComandoTelegram('contas', { vinculado: true }), /vinculado ao HERDON/);
  assert.match(gerarRespostaComandoTelegram('contas', { vinculado: false }), /ainda não está vinculado/);
});

test('/alertas sem vínculo pede o código', () => {
  assert.match(gerarRespostaComandoTelegram('alertas', { vinculado: false }), /ainda não está vinculado/);
});

test('/alertas com falha de carregamento avisa para tentar depois', () => {
  assert.match(gerarRespostaComandoTelegram('alertas', { vinculado: true, alertasErro: true }), /Tente novamente em instantes/);
});

test('/alertas com vínculo e sem alertas confirma que está tudo em dia', () => {
  assert.match(gerarRespostaComandoTelegram('alertas', { vinculado: true, alertas: [] }), /Nenhum alerta pendente/);
});

test('/alertas com vínculo resume total, prioridades e até 5 alertas', () => {
  const alertas = [
    { prioridade: 'critico', titulo: 'A' },
    { prioridade: 'critico', titulo: 'B' },
    { prioridade: 'atencao', titulo: 'C' },
    { prioridade: 'decisao', titulo: 'D' },
    { prioridade: 'decisao', titulo: 'E' },
    { prioridade: 'decisao', titulo: 'F' },
    { prioridade: 'informativo', titulo: 'ignorado' },
  ];
  const resposta = gerarRespostaComandoTelegram('alertas', { vinculado: true, alertas });
  assert.match(resposta, /total: 6/);
  assert.match(resposta, /Crítico: 2/);
  assert.match(resposta, /Atenção: 1/);
  assert.match(resposta, /Decisão: 3/);
  assert.match(resposta, /\+1 outro/);
  assert.doesNotMatch(resposta, /ignorado/);
});

test('comando desconhecido pede para usar /ajuda', () => {
  assert.match(gerarRespostaComandoTelegram('desconhecido'), /Comando não reconhecido/);
});
