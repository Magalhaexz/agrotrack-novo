import { readFileSync } from 'fs';
import { parsePlanilha, validarPlanilha } from '../src/utils/importParser.js';

const buffer = readFileSync('scripts/herdon-teste-e2e.xlsx');
const resultado = parsePlanilha(buffer.buffer);

if (!resultado.ok) {
  console.error('✖ Leitura falhou:', resultado.error);
  process.exit(1);
}

console.log('✓ Leitura OK');
console.log('  Fazendas:', resultado.parsed.fazendas.length);
console.log('  Pastos:', resultado.parsed.pastos.length);
console.log('  Lotes:', resultado.parsed.lotes.length);
console.log('  Animais:', resultado.parsed.animais.length);
console.log('  Pesagens_Lotes:', resultado.parsed.pesagens_lotes.length);
console.log('  Pesagens_Animais:', resultado.parsed.pesagens_animais.length);

// Validar contra banco vazio (simulação de conta nova)
const emptyDb = { fazendas: [], lotes: [], animais: [], pesagens: [] };
const validacao = validarPlanilha(resultado.parsed, emptyDb);

console.log('\n--- Validação (banco vazio) ---');
if (!validacao.temErros) {
  console.log('✓ Sem erros — pronto para importar');
} else {
  console.error(`✖ ${validacao.totalErros} erro(s) encontrado(s):`);
  for (const [aba, erros] of Object.entries(validacao.erros)) {
    if (erros.length > 0) {
      console.error(`  Aba ${aba}:`);
      erros.forEach((e) => console.error(`    Linha ${e.linha} [${e.campo}]: ${e.mensagem}`));
    }
  }
  process.exit(1);
}

// Simular banco já populado e tentar reimportar (deve rejeitar pesagens duplicadas)
const dbComDados = {
  fazendas: [{ id: 1, nome: 'Fazenda Modelo HERDON' }],
  lotes: [
    { id: 10, nome: 'HERDON-PASTO-01' },
    { id: 11, nome: 'HERDON-CONF-02' },
  ],
  animais: [
    { id: 100, identificacao: 'HRD-001' },
    { id: 101, identificacao: 'HRD-002' },
    { id: 102, identificacao: 'HRD-003' },
    { id: 103, identificacao: 'HRD-004' },
  ],
  pesagens: [
    { id: 200, lote_id: 10, tipo: 'lote', data: '2024-03-01' },
    { id: 201, lote_id: 10, tipo: 'lote', data: '2024-04-01' },
    { id: 202, lote_id: 10, tipo: 'lote', data: '2024-05-01' },
    { id: 203, lote_id: 11, tipo: 'lote', data: '2024-03-15' },
    { id: 204, animal_id: 100, tipo: 'animal', data: '2024-03-01' },
    { id: 205, animal_id: 101, tipo: 'animal', data: '2024-03-01' },
    { id: 206, animal_id: 102, tipo: 'animal', data: '2024-03-15' },
    { id: 207, animal_id: 103, tipo: 'animal', data: '2024-03-15' },
  ],
};

const validacaoReimport = validarPlanilha(resultado.parsed, dbComDados);
console.log('\n--- Validação (reimportação com dados já existentes) ---');
const errosDuplicatas = [
  ...validacaoReimport.erros.pesagens_lotes,
  ...validacaoReimport.erros.pesagens_animais,
];
if (errosDuplicatas.length === 8) {
  console.log(`✓ ${errosDuplicatas.length} erros de duplicidade detectados (esperado: 8)`);
  console.log('✓ Bloco de duplicidade funcionando corretamente');
} else {
  console.warn(`⚠ Esperado 8 erros de duplicidade, obtido ${errosDuplicatas.length}`);
  errosDuplicatas.forEach((e) => console.warn(`  Linha ${e.linha} [${e.campo}]: ${e.mensagem}`));
}
