/**
 * Gera o arquivo de teste E2E para a importação do HERDON.
 * Dados 100% fictícios, sem relação com fazendas ou pessoas reais.
 */
import * as XLSX from 'xlsx';
import { writeFileSync } from 'fs';

const wb = XLSX.utils.book_new();

// ── Fazendas ──────────────────────────────────────────────────────────────────
const fazendas = [
  ['nome', 'cidade', 'estado', 'area_total_ha', 'observacoes'],
  ['Fazenda Modelo HERDON', 'Catalão', 'GO', '950', 'Conta de teste Sprint 20.1'],
];
const wsFazendas = XLSX.utils.aoa_to_sheet(fazendas);
XLSX.utils.book_append_sheet(wb, wsFazendas, 'Fazendas');

// ── Pastos ────────────────────────────────────────────────────────────────────
const pastos = [
  ['codigo_fazenda', 'nome', 'area_ha', 'observacoes'],
  ['Fazenda Modelo HERDON', 'Pasto Brejo Grande', '180', ''],
  ['Fazenda Modelo HERDON', 'Pasto Morro Azul', '220', ''],
];
const wsPastos = XLSX.utils.aoa_to_sheet(pastos);
XLSX.utils.book_append_sheet(wb, wsPastos, 'Pastos');

// ── Lotes ─────────────────────────────────────────────────────────────────────
// Lote 1: sistema pasto (vinculado ao pasto)
// Lote 2: confinamento (sem pasto)
const lotes = [
  ['codigo_lote', 'codigo_fazenda', 'data_entrada', 'quantidade_cabecas', 'peso_inicial_kg', 'observacoes'],
  ['HERDON-PASTO-01', 'Fazenda Modelo HERDON', '2024-01-15', '2', '310', 'Sistema pasto – Pasto Brejo Grande'],
  ['HERDON-CONF-02',  'Fazenda Modelo HERDON', '2024-02-01', '2', '285', 'Sistema confinamento'],
];
const wsLotes = XLSX.utils.aoa_to_sheet(lotes);
XLSX.utils.book_append_sheet(wb, wsLotes, 'Lotes');

// ── Animais ───────────────────────────────────────────────────────────────────
const animais = [
  ['brinco', 'codigo_lote', 'sexo', 'peso_inicial_kg', 'observacoes'],
  ['HRD-001', 'HERDON-PASTO-01', 'macho',  '315', ''],
  ['HRD-002', 'HERDON-PASTO-01', 'macho',  '305', ''],
  ['HRD-003', 'HERDON-CONF-02',  'fêmea', '290', ''],
  ['HRD-004', 'HERDON-CONF-02',  'fêmea', '280', ''],
];
const wsAnimais = XLSX.utils.aoa_to_sheet(animais);
XLSX.utils.book_append_sheet(wb, wsAnimais, 'Animais');

// ── Pesagens_Lotes ────────────────────────────────────────────────────────────
// 3 datas diferentes para HERDON-PASTO-01, 1 para HERDON-CONF-02
const pesagensLotes = [
  ['codigo_lote', 'data_pesagem', 'peso_medio_kg', 'quantidade_cabecas', 'observacoes'],
  ['HERDON-PASTO-01', '2024-03-01', '345', '2', ''],
  ['HERDON-PASTO-01', '2024-04-01', '378', '2', ''],
  ['HERDON-PASTO-01', '2024-05-01', '412', '2', ''],
  ['HERDON-CONF-02',  '2024-03-15', '320', '2', ''],
];
const wsPesLotes = XLSX.utils.aoa_to_sheet(pesagensLotes);
XLSX.utils.book_append_sheet(wb, wsPesLotes, 'Pesagens_Lotes');

// ── Pesagens_Animais ──────────────────────────────────────────────────────────
const pesagensAnimais = [
  ['brinco', 'codigo_lote', 'data_pesagem', 'peso_kg', 'observacoes'],
  ['HRD-001', 'HERDON-PASTO-01', '2024-03-01', '348', ''],
  ['HRD-002', 'HERDON-PASTO-01', '2024-03-01', '342', ''],
  ['HRD-003', 'HERDON-CONF-02',  '2024-03-15', '325', ''],
  ['HRD-004', 'HERDON-CONF-02',  '2024-03-15', '315', ''],
];
const wsPesAnimais = XLSX.utils.aoa_to_sheet(pesagensAnimais);
XLSX.utils.book_append_sheet(wb, wsPesAnimais, 'Pesagens_Animais');

// ── Escrever arquivo ──────────────────────────────────────────────────────────
const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
writeFileSync('scripts/herdon-teste-e2e.xlsx', buffer);
console.log('✓ scripts/herdon-teste-e2e.xlsx gerado com sucesso');
console.log('  Fazendas: 1');
console.log('  Pastos: 2');
console.log('  Lotes: 2 (1 pasto + 1 confinamento)');
console.log('  Animais: 4');
console.log('  Pesagens_Lotes: 4');
console.log('  Pesagens_Animais: 4');
