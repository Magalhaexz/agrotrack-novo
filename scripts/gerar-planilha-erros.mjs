/**
 * Gera planilha com erros intencionais para validar mensagens de erro do wizard.
 * Dados 100% fictícios, sem relação com fazendas ou pessoas reais.
 */
import * as XLSX from 'xlsx';
import { writeFileSync } from 'fs';

const wb = XLSX.utils.book_new();

// ── Fazendas ── 1 válida
const fazendas = [
  ['nome', 'cidade', 'estado', 'area_total_ha', 'observacoes'],
  ['Fazenda Erros Test', 'Goiânia', 'GO', '100', ''],
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fazendas), 'Fazendas');

// ── Pastos ── erro 1: fazenda "Fazenda Inexistente" não existe na planilha
const pastos = [
  ['codigo_fazenda', 'nome', 'area_ha', 'observacoes'],
  ['Fazenda Erros Test',  'Pasto Bom',      '50', ''],
  ['Fazenda Inexistente', 'Pasto Fantasma',  '30', ''],  // ERRO: fazenda não cadastrada
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pastos), 'Pastos');

// ── Lotes ── erro 2: peso_inicial_kg negativo
const lotes = [
  ['codigo_lote', 'codigo_fazenda', 'data_entrada', 'quantidade_cabecas', 'peso_inicial_kg', 'observacoes'],
  ['ERROS-LOT-01', 'Fazenda Erros Test', '2024-01-01', '2', '-50', ''],  // ERRO: peso negativo
  ['ERROS-LOT-02', 'Fazenda Erros Test', '2024-01-01', '2', '300', ''],
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lotes), 'Lotes');

// ── Animais ── erro 3: brinco duplicado na planilha
const animais = [
  ['brinco', 'codigo_lote', 'sexo', 'peso_inicial_kg', 'observacoes'],
  ['ERR-DUP', 'ERROS-LOT-01', 'macho', '300', ''],
  ['ERR-DUP', 'ERROS-LOT-02', 'macho', '300', ''],  // ERRO: brinco duplicado
  ['ERR-003', 'ERROS-LOT-02', 'fêmea', '280', ''],
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(animais), 'Animais');

// ── Pesagens_Lotes ── erro 4: peso_medio_kg = 0
const pesagensLotes = [
  ['codigo_lote', 'data_pesagem', 'peso_medio_kg', 'quantidade_cabecas', 'observacoes'],
  ['ERROS-LOT-01', '2024-03-01', '0', '2', ''],   // ERRO: peso zero
  ['ERROS-LOT-02', '2024-03-01', '350', '2', ''],
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pesagensLotes), 'Pesagens_Lotes');

// ── Pesagens_Animais ── válidas
const pesagensAnimais = [
  ['brinco', 'codigo_lote', 'data_pesagem', 'peso_kg', 'observacoes'],
  ['ERR-003', 'ERROS-LOT-02', '2024-03-01', '285', ''],
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pesagensAnimais), 'Pesagens_Animais');

const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
writeFileSync('scripts/herdon-erros-test.xlsx', buffer);
writeFileSync('public/herdon-erros-test.xlsx', buffer);
console.log('✓ scripts/herdon-erros-test.xlsx + public/herdon-erros-test.xlsx gerados');
console.log('  Erros esperados:');
console.log('  Pastos    L3 [codigo_fazenda] — fazenda não encontrada');
console.log('  Lotes     L2 [peso_inicial_kg] — peso inválido (negativo)');
console.log('  Animais   L3 [brinco]          — brinco duplicado');
console.log('  Pes.Lotes L2 [peso_medio_kg]   — peso zero');
