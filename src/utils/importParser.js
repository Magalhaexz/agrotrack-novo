import * as XLSX from 'xlsx';

// ── Helpers de normalização ──────────────────────────────────────────────────

export function normalizeText(value) {
  return String(value ?? '').trim();
}

export function parseDate(value) {
  const text = normalizeText(value);
  if (!text) return null;

  // DD/MM/YYYY ou D/M/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
    const [d, m, y] = text.split('/');
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const dt = new Date(iso);
    return Number.isNaN(dt.getTime()) ? null : iso;
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const dt = new Date(text);
    return Number.isNaN(dt.getTime()) ? null : text;
  }

  // Número serial do Excel (dias desde 1900-01-01)
  // 25569 = número de dias de 1900-01-01 até 1970-01-01 (época Unix), considerando bug do bisexto de 1900
  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 1000) {
    const ms = (serial - 25569) * 86400000;
    const dt = new Date(ms);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toISOString().slice(0, 10);
    }
  }

  return null;
}

export function parsePositiveNumber(value) {
  const n = Number(normalizeText(value).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parsePositiveInteger(value) {
  const n = Number(normalizeText(value).replace(',', '.'));
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
}

// ── Definição do template (pura, sem I/O) ────────────────────────────────────

export function gerarTemplateSheets() {
  return [
    {
      name: 'Fazendas',
      columns: [
        { key: 'nome', header: 'nome' },
        { key: 'cidade', header: 'cidade' },
        { key: 'estado', header: 'estado' },
        { key: 'area_total_ha', header: 'area_total_ha' },
        { key: 'observacoes', header: 'observacoes' },
      ],
      rows: [{ nome: 'Fazenda São João', cidade: 'Uberlândia', estado: 'MG', area_total_ha: '500', observacoes: '' }],
    },
    {
      name: 'Pastos',
      columns: [
        { key: 'codigo_fazenda', header: 'codigo_fazenda' },
        { key: 'nome', header: 'nome' },
        { key: 'area_ha', header: 'area_ha' },
        { key: 'observacoes', header: 'observacoes' },
      ],
      rows: [{ codigo_fazenda: 'Fazenda São João', nome: 'Pasto Norte', area_ha: '100', observacoes: '' }],
    },
    {
      name: 'Lotes',
      columns: [
        { key: 'codigo_lote', header: 'codigo_lote' },
        { key: 'codigo_fazenda', header: 'codigo_fazenda' },
        { key: 'data_entrada', header: 'data_entrada' },
        { key: 'quantidade_cabecas', header: 'quantidade_cabecas' },
        { key: 'peso_inicial_kg', header: 'peso_inicial_kg' },
        { key: 'observacoes', header: 'observacoes' },
      ],
      rows: [{
        codigo_lote: 'Lote A', codigo_fazenda: 'Fazenda São João',
        data_entrada: '2024-01-15', quantidade_cabecas: '50', peso_inicial_kg: '300', observacoes: '',
      }],
    },
    {
      name: 'Animais',
      columns: [
        { key: 'brinco', header: 'brinco' },
        { key: 'codigo_lote', header: 'codigo_lote' },
        { key: 'sexo', header: 'sexo' },
        { key: 'peso_inicial_kg', header: 'peso_inicial_kg' },
        { key: 'observacoes', header: 'observacoes' },
      ],
      rows: [{ brinco: 'BR-001', codigo_lote: 'Lote A', sexo: 'macho', peso_inicial_kg: '280', observacoes: '' }],
    },
    {
      name: 'Pesagens_Lotes',
      columns: [
        { key: 'codigo_lote', header: 'codigo_lote' },
        { key: 'data_pesagem', header: 'data_pesagem' },
        { key: 'peso_medio_kg', header: 'peso_medio_kg' },
        { key: 'quantidade_cabecas', header: 'quantidade_cabecas' },
        { key: 'observacoes', header: 'observacoes' },
      ],
      rows: [{ codigo_lote: 'Lote A', data_pesagem: '2024-03-01', peso_medio_kg: '320', quantidade_cabecas: '50', observacoes: '' }],
    },
    {
      name: 'Pesagens_Animais',
      columns: [
        { key: 'brinco', header: 'brinco' },
        { key: 'codigo_lote', header: 'codigo_lote' },
        { key: 'data_pesagem', header: 'data_pesagem' },
        { key: 'peso_kg', header: 'peso_kg' },
        { key: 'observacoes', header: 'observacoes' },
      ],
      rows: [{ brinco: 'BR-001', codigo_lote: 'Lote A', data_pesagem: '2024-03-01', peso_kg: '310', observacoes: '' }],
    },
  ];
}

// ── Geração do XLSX real ─────────────────────────────────────────────────────

export function gerarTemplateArrayBuffer() {
  const wb = XLSX.utils.book_new();
  const sheets = gerarTemplateSheets();

  for (const sheet of sheets) {
    const headers = sheet.columns.map((c) => c.header);
    const exampleRows = sheet.rows.map((row) => sheet.columns.map((c) => row[c.key] ?? ''));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
    ws['!cols'] = sheet.columns.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

// ── Parsing da planilha enviada ──────────────────────────────────────────────

function sheetToObjects(rows) {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map((h) => normalizeText(String(h)).toLowerCase());
  return rows
    .slice(1)
    .filter((row) => row.some((cell) => normalizeText(String(cell ?? ''))))
    .map((row) =>
      Object.fromEntries(headers.map((h, i) => [h, normalizeText(String(row[i] ?? ''))]))
    );
}

export function parsePlanilha(arrayBuffer) {
  try {
    const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: false });

    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      return { ok: false, parsed: null, error: 'Nenhuma aba encontrada. Use o modelo oficial baixado pelo HERDON.' };
    }

    const abasHerdon = ['Fazendas', 'Pastos', 'Lotes'];
    const temAbaHerdon = abasHerdon.some((nome) => wb.SheetNames.includes(nome));
    if (!temAbaHerdon) {
      return { ok: false, parsed: null, error: 'Arquivo não reconhecido como modelo do HERDON. Baixe o modelo oficial e preencha-o.' };
    }

    const getRaw = (name) => {
      const ws = wb.Sheets[name];
      if (!ws) return [];
      return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
    };

    return {
      ok: true,
      error: null,
      parsed: {
        fazendas: sheetToObjects(getRaw('Fazendas')),
        pastos: sheetToObjects(getRaw('Pastos')),
        lotes: sheetToObjects(getRaw('Lotes')),
        animais: sheetToObjects(getRaw('Animais')),
        pesagens_lotes: sheetToObjects(getRaw('Pesagens_Lotes')),
        pesagens_animais: sheetToObjects(getRaw('Pesagens_Animais')),
      },
    };
  } catch (err) {
    return {
      ok: false,
      parsed: null,
      error: `Não foi possível ler o arquivo: ${err?.message || 'formato não reconhecido'}. Use o modelo oficial baixado pelo HERDON.`,
    };
  }
}

// ── Validação de dados ───────────────────────────────────────────────────────

export function validarPlanilha(parsed, db) {
  const erros = {
    fazendas: [],
    pastos: [],
    lotes: [],
    animais: [],
    pesagens_lotes: [],
    pesagens_animais: [],
  };

  const norm = normalizeText;

  // Conjuntos de referência: db existente + dados do arquivo
  const fazendaNomes = new Set([
    ...(db?.fazendas || []).map((f) => norm(f.nome)),
    ...(parsed.fazendas || []).map((f) => norm(f.nome)),
  ]);

  const loteNomes = new Set([
    ...(db?.lotes || []).map((l) => norm(l.nome)),
    ...(parsed.lotes || []).map((l) => norm(l.codigo_lote)),
  ]);

  const brincoNomes = new Set([
    ...(db?.animais || []).map((a) => norm(a.identificacao)),
    ...(parsed.animais || []).map((a) => norm(a.brinco)),
  ]);

  // ── Fazendas ────────────────────────────────────────────────────────────────
  (parsed.fazendas || []).forEach((row, i) => {
    const linha = i + 2;
    if (!row.nome) {
      erros.fazendas.push({ linha, campo: 'nome', mensagem: 'O nome da fazenda é obrigatório' });
    }
  });

  // ── Pastos ──────────────────────────────────────────────────────────────────
  (parsed.pastos || []).forEach((row, i) => {
    const linha = i + 2;
    if (!row.nome) {
      erros.pastos.push({ linha, campo: 'nome', mensagem: 'O nome do pasto é obrigatório' });
    }
    if (!row.codigo_fazenda) {
      erros.pastos.push({ linha, campo: 'codigo_fazenda', mensagem: 'O código da fazenda é obrigatório' });
    } else if (!fazendaNomes.has(norm(row.codigo_fazenda))) {
      erros.pastos.push({ linha, campo: 'codigo_fazenda', mensagem: `Fazenda "${row.codigo_fazenda}" não encontrada — verifique se o nome está correto ou se está na aba Fazendas` });
    }
    if (row.area_ha && !parsePositiveNumber(row.area_ha)) {
      erros.pastos.push({ linha, campo: 'area_ha', mensagem: 'Área deve ser um número maior que zero' });
    }
  });

  // ── Lotes ───────────────────────────────────────────────────────────────────
  const loteCodigoLinhas = new Map();
  (parsed.lotes || []).forEach((row, i) => {
    const linha = i + 2;

    if (!row.codigo_lote) {
      erros.lotes.push({ linha, campo: 'codigo_lote', mensagem: 'O código do lote é obrigatório' });
    } else if (loteCodigoLinhas.has(norm(row.codigo_lote))) {
      erros.lotes.push({ linha, campo: 'codigo_lote', mensagem: `Código "${row.codigo_lote}" já aparece na linha ${loteCodigoLinhas.get(norm(row.codigo_lote))} — cada lote deve ter um código único` });
    } else {
      loteCodigoLinhas.set(norm(row.codigo_lote), linha);
    }

    if (!row.codigo_fazenda) {
      erros.lotes.push({ linha, campo: 'codigo_fazenda', mensagem: 'O código da fazenda é obrigatório' });
    } else if (!fazendaNomes.has(norm(row.codigo_fazenda))) {
      erros.lotes.push({ linha, campo: 'codigo_fazenda', mensagem: `Fazenda "${row.codigo_fazenda}" não encontrada — verifique se o nome está correto ou se está na aba Fazendas` });
    }

    if (!row.data_entrada) {
      erros.lotes.push({ linha, campo: 'data_entrada', mensagem: 'A data de entrada é obrigatória' });
    } else if (!parseDate(row.data_entrada)) {
      erros.lotes.push({ linha, campo: 'data_entrada', mensagem: `Data inválida: "${row.data_entrada}". Use o formato AAAA-MM-DD ou DD/MM/AAAA` });
    }

    if (!row.quantidade_cabecas) {
      erros.lotes.push({ linha, campo: 'quantidade_cabecas', mensagem: 'A quantidade de cabeças é obrigatória' });
    } else if (!parsePositiveInteger(row.quantidade_cabecas)) {
      erros.lotes.push({ linha, campo: 'quantidade_cabecas', mensagem: `"${row.quantidade_cabecas}" não é uma quantidade válida. Use um número inteiro maior que zero` });
    }

    if (!row.peso_inicial_kg) {
      erros.lotes.push({ linha, campo: 'peso_inicial_kg', mensagem: 'O peso inicial é obrigatório' });
    } else if (!parsePositiveNumber(row.peso_inicial_kg)) {
      erros.lotes.push({ linha, campo: 'peso_inicial_kg', mensagem: `"${row.peso_inicial_kg}" não é um peso válido. Use um número maior que zero` });
    }
  });

  // ── Animais ─────────────────────────────────────────────────────────────────
  const brincoLinhas = new Map();
  (parsed.animais || []).forEach((row, i) => {
    const linha = i + 2;

    if (!row.brinco) {
      erros.animais.push({ linha, campo: 'brinco', mensagem: 'O brinco (identificação) é obrigatório' });
    } else if (brincoLinhas.has(norm(row.brinco))) {
      erros.animais.push({ linha, campo: 'brinco', mensagem: `Brinco "${row.brinco}" já aparece na linha ${brincoLinhas.get(norm(row.brinco))} — cada animal deve ter um brinco único` });
    } else {
      brincoLinhas.set(norm(row.brinco), linha);
    }

    if (!row.codigo_lote) {
      erros.animais.push({ linha, campo: 'codigo_lote', mensagem: 'O lote é obrigatório' });
    } else if (!loteNomes.has(norm(row.codigo_lote))) {
      erros.animais.push({ linha, campo: 'codigo_lote', mensagem: `Lote "${row.codigo_lote}" não encontrado — verifique se o código está correto ou se está na aba Lotes` });
    }

    if (row.peso_inicial_kg && !parsePositiveNumber(row.peso_inicial_kg)) {
      erros.animais.push({ linha, campo: 'peso_inicial_kg', mensagem: `"${row.peso_inicial_kg}" não é um peso válido. Use um número maior que zero` });
    }
  });

  // ── Pesagens por Lote ───────────────────────────────────────────────────────
  const pesLotesChaves = new Map();
  (parsed.pesagens_lotes || []).forEach((row, i) => {
    const linha = i + 2;
    const dataValida = parseDate(row.data_pesagem);

    if (!row.codigo_lote) {
      erros.pesagens_lotes.push({ linha, campo: 'codigo_lote', mensagem: 'O lote é obrigatório' });
    } else if (!loteNomes.has(norm(row.codigo_lote))) {
      erros.pesagens_lotes.push({ linha, campo: 'codigo_lote', mensagem: `Lote "${row.codigo_lote}" não encontrado — verifique se o código está correto ou se está na aba Lotes` });
    }

    if (!row.data_pesagem) {
      erros.pesagens_lotes.push({ linha, campo: 'data_pesagem', mensagem: 'A data da pesagem é obrigatória' });
    } else if (!dataValida) {
      erros.pesagens_lotes.push({ linha, campo: 'data_pesagem', mensagem: `Data inválida: "${row.data_pesagem}". Use o formato AAAA-MM-DD ou DD/MM/AAAA` });
    }

    if (!row.peso_medio_kg) {
      erros.pesagens_lotes.push({ linha, campo: 'peso_medio_kg', mensagem: 'O peso médio é obrigatório' });
    } else if (!parsePositiveNumber(row.peso_medio_kg)) {
      erros.pesagens_lotes.push({ linha, campo: 'peso_medio_kg', mensagem: `"${row.peso_medio_kg}" não é um peso válido. Use um número maior que zero` });
    }

    if (row.quantidade_cabecas && !parsePositiveInteger(row.quantidade_cabecas)) {
      erros.pesagens_lotes.push({ linha, campo: 'quantidade_cabecas', mensagem: `"${row.quantidade_cabecas}" não é uma quantidade válida. Use um número inteiro maior que zero` });
    }

    // Duplicata dentro do arquivo
    if (row.codigo_lote && dataValida) {
      const chave = `${norm(row.codigo_lote)}|${dataValida}`;
      if (pesLotesChaves.has(chave)) {
        erros.pesagens_lotes.push({ linha, campo: 'codigo_lote', mensagem: `Já existe uma pesagem para o lote "${row.codigo_lote}" na data ${row.data_pesagem} neste arquivo (linha ${pesLotesChaves.get(chave)})` });
      } else {
        pesLotesChaves.set(chave, linha);
      }
    }

    // Conflito com pesagem já cadastrada no HERDON
    if (row.codigo_lote && dataValida) {
      const loteExist = (db?.lotes || []).find((l) => norm(l.nome) === norm(row.codigo_lote));
      if (loteExist) {
        const conflict = (db?.pesagens || []).some(
          (p) => Number(p.lote_id) === Number(loteExist.id) && String(p.tipo) === 'lote' && String(p.data) === dataValida
        );
        if (conflict) {
          erros.pesagens_lotes.push({
            linha,
            campo: 'data_pesagem',
            mensagem: `Já existe uma pesagem do lote "${row.codigo_lote}" em ${row.data_pesagem} cadastrada no HERDON. Remova esta linha ou ajuste a data.`,
          });
        }
      }
    }
  });

  // ── Pesagens por Animal ─────────────────────────────────────────────────────
  const pesAnimaisChaves = new Map();
  (parsed.pesagens_animais || []).forEach((row, i) => {
    const linha = i + 2;
    const dataValida = parseDate(row.data_pesagem);

    if (!row.brinco) {
      erros.pesagens_animais.push({ linha, campo: 'brinco', mensagem: 'O brinco do animal é obrigatório' });
    } else if (!brincoNomes.has(norm(row.brinco))) {
      erros.pesagens_animais.push({ linha, campo: 'brinco', mensagem: `Animal "${row.brinco}" não encontrado — verifique se o brinco está correto ou se está na aba Animais` });
    }

    if (!row.data_pesagem) {
      erros.pesagens_animais.push({ linha, campo: 'data_pesagem', mensagem: 'A data da pesagem é obrigatória' });
    } else if (!dataValida) {
      erros.pesagens_animais.push({ linha, campo: 'data_pesagem', mensagem: `Data inválida: "${row.data_pesagem}". Use o formato AAAA-MM-DD ou DD/MM/AAAA` });
    }

    if (!row.peso_kg) {
      erros.pesagens_animais.push({ linha, campo: 'peso_kg', mensagem: 'O peso do animal é obrigatório' });
    } else if (!parsePositiveNumber(row.peso_kg)) {
      erros.pesagens_animais.push({ linha, campo: 'peso_kg', mensagem: `"${row.peso_kg}" não é um peso válido. Use um número maior que zero` });
    }

    // Duplicata dentro do arquivo
    if (row.brinco && dataValida) {
      const chave = `${norm(row.brinco)}|${dataValida}`;
      if (pesAnimaisChaves.has(chave)) {
        erros.pesagens_animais.push({ linha, campo: 'brinco', mensagem: `Já existe uma pesagem para o animal "${row.brinco}" na data ${row.data_pesagem} neste arquivo (linha ${pesAnimaisChaves.get(chave)})` });
      } else {
        pesAnimaisChaves.set(chave, linha);
      }
    }

    // Conflito com pesagem já cadastrada no HERDON
    if (row.brinco && dataValida) {
      const animalExist = (db?.animais || []).find((a) => norm(a.identificacao) === norm(row.brinco));
      if (animalExist) {
        const conflict = (db?.pesagens || []).some(
          (p) => Number(p.animal_id) === Number(animalExist.id) && String(p.tipo) === 'animal' && String(p.data) === dataValida
        );
        if (conflict) {
          erros.pesagens_animais.push({
            linha,
            campo: 'data_pesagem',
            mensagem: `Já existe uma pesagem do animal "${row.brinco}" em ${row.data_pesagem} cadastrada no HERDON. Remova esta linha ou ajuste a data.`,
          });
        }
      }
    }
  });

  const totalErros = Object.values(erros).reduce((sum, arr) => sum + arr.length, 0);
  return { erros, temErros: totalErros > 0, totalErros };
}
