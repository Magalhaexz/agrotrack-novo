import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, Download, FileUp, Loader2, Upload } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast';
import { gerarNovoId } from '../utils/id';
import {
  gerarTemplateArrayBuffer,
  normalizeText,
  parseDate,
  parsePlanilha,
  parsePositiveNumber,
  validarPlanilha,
} from '../utils/importParser';
import { createOperationalRecord } from '../services/operationalPersistence';

import { hojeLocalISO } from '../domain/dataCivil.js';
// ── Constantes ───────────────────────────────────────────────────────────────

const ABA_LABELS = {
  fazendas: 'Fazendas',
  pastos: 'Pastos',
  lotes: 'Lotes',
  animais: 'Animais',
  pesagens_lotes: 'Pesagens por Lote',
  pesagens_animais: 'Pesagens por Animal',
};

const PASSOS_LABELS = ['Modelo', 'Envio', 'Revisão', 'Confirmação'];

// ── Componentes auxiliares ───────────────────────────────────────────────────

function StepBar({ passoAtual }) {
  const passos = ['template', 'upload', 'validacao', 'confirmacao'];
  const indexAtual = passos.indexOf(passoAtual);
  if (indexAtual === -1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
      {PASSOS_LABELS.map((label, i) => {
        const feito = i < indexAtual;
        const ativo = i === indexAtual;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
                background: feito ? 'var(--color-success, #16a34a)' : ativo ? 'var(--color-primary, #2563eb)' : 'var(--color-border, #e5e7eb)',
                color: feito || ativo ? '#fff' : 'var(--color-text-secondary)',
              }}>
                {feito ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 13, fontWeight: ativo ? 600 : 400, color: ativo ? 'var(--color-text)' : feito ? 'var(--color-success, #16a34a)' : 'var(--color-text-secondary)' }}>
                {label}
              </span>
            </div>
            {i < PASSOS_LABELS.length - 1 && (
              <div style={{ width: 32, height: 1, background: 'var(--color-border, #e5e7eb)', margin: '0 8px' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ErrosList({ erros }) {
  if (!erros || erros.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: 'var(--color-success, #16a34a)' }}>
        <CheckCircle2 size={16} />
        <span style={{ fontSize: 14 }}>Nenhum problema encontrado nesta aba</span>
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        Corrija os itens abaixo na planilha, salve o arquivo e envie novamente.
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
        {erros.map((e, i) => (
          <li key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13,
            padding: '10px 12px', background: 'rgba(239,68,68,0.05)',
            borderRadius: 8, border: '1px solid rgba(239,68,68,0.15)',
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1, color: '#dc2626' }} />
            <span>
              <strong>Linha {e.linha}</strong>
              {e.campo ? <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginLeft: 4 }}>({e.campo})</span> : null}
              {' — '}{e.mensagem}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProgressoBar({ atual, total, etapa }) {
  const pct = total > 0 ? Math.min(100, Math.round((atual / total) * 100)) : 0;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-text-secondary)' }}>
        <span>{etapa || 'Preparando…'}</span>
        <span>{atual} de {total}</span>
      </div>
      <div style={{ height: 8, background: 'var(--color-border, #e5e7eb)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: 'var(--color-primary, #2563eb)', borderRadius: 4,
          transition: 'width 0.25s ease',
        }} />
      </div>
    </div>
  );
}

function contarRegistros(parsed) {
  if (!parsed) return 0;
  return Object.values(parsed).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function ImportacaoPage({ db, setDb, session: sessionProp, onConfirmAction, onNavigate }) {
  const { hasPermission, session: authSession } = useAuth();
  const { showToast } = useToast();
  const session = sessionProp ?? authSession;

  const [passo, setPasso] = useState('template');
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [parsed, setParsed] = useState(null);
  const [erros, setErros] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('fazendas');
  const [isDragging, setIsDragging] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, etapa: '' });
  const [resultado, setResultado] = useState(null);
  const fileInputRef = useRef(null);

  // ── Download do modelo ─────────────────────────────────────────────────────

  function baixarModelo() {
    const data = gerarTemplateArrayBuffer();
    const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'herdon-modelo-importacao.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Leitura do arquivo ─────────────────────────────────────────────────────

  function processarArquivo(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) {
      showToast({ type: 'error', message: 'Use o modelo oficial baixado pelo HERDON (.xlsx)' });
      return;
    }
    setNomeArquivo(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const resultado = parsePlanilha(e.target.result);
      if (!resultado.ok) {
        showToast({ type: 'error', message: resultado.error });
        setNomeArquivo('');
        return;
      }
      const validacao = validarPlanilha(resultado.parsed, db);
      setParsed(resultado.parsed);
      setErros(validacao.erros);
      setPasso('validacao');
      setAbaAtiva('fazendas');
    };
    reader.readAsArrayBuffer(file);
  }

  function handleFileInput(e) {
    processarArquivo(e.target.files?.[0]);
    e.target.value = '';
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    processarArquivo(e.dataTransfer.files?.[0]);
  }

  // ── Helpers de validação ───────────────────────────────────────────────────

  function temErrosAtivos() {
    if (!erros) return false;
    return Object.values(erros).some((arr) => arr.length > 0);
  }

  function totalErros() {
    if (!erros) return 0;
    return Object.values(erros).reduce((sum, arr) => sum + arr.length, 0);
  }

  // ── Gravação ───────────────────────────────────────────────────────────────

  async function executarImportacao() {
    if (!hasPermission('dados:importar')) {
      showToast({ type: 'error', message: 'Você não tem permissão para importar dados.' });
      return;
    }

    const confirmar = onConfirmAction
      ? await onConfirmAction({
          title: 'Confirmar importação',
          message: 'Os dados serão inseridos no HERDON. Deseja continuar?',
          tone: 'warning',
        })
      : window.confirm('Confirmar importação?');

    if (!confirmar) return;

    setPasso('gravando');

    const novasFazendas = [];
    const novosPastos = [];
    const novosLotes = [];
    const novosAnimais = [];
    const novasPesagens = [];

    const fazendaIdPorNome = new Map();
    const loteIdPorCodigo = new Map();
    const animalIdPorBrinco = new Map();

    const norm = normalizeText;
    const falhas = [];

    // Pré-popular com dados existentes
    (db?.fazendas || []).forEach((f) => fazendaIdPorNome.set(norm(f.nome), f.id));
    (db?.lotes || []).forEach((l) => loteIdPorCodigo.set(norm(l.nome), l.id));
    (db?.animais || []).forEach((a) => animalIdPorBrinco.set(norm(a.identificacao), a.id));

    const total = contarRegistros(parsed);
    let ops = 0;

    function tick(etapa) {
      ops += 1;
      setProgresso({ atual: ops, total, etapa });
    }

    // 1. Fazendas
    for (const row of (parsed.fazendas || [])) {
      const nomeNorm = norm(row.nome);
      if (!nomeNorm) { tick('Fazendas'); continue; }
      if (fazendaIdPorNome.has(nomeNorm)) { tick('Fazendas'); continue; }
      try {
        const res = await createOperationalRecord('fazendas', {
          id: gerarNovoId(),
          nome: row.nome,
          cidade: row.cidade || null,
          estado: row.estado || null,
          area_total_ha: parsePositiveNumber(row.area_total_ha) || null,
          status: 'ativa',
          observacoes: row.observacoes || null,
        }, session);
        if (res.data?.id) {
          fazendaIdPorNome.set(nomeNorm, res.data.id);
          novasFazendas.push(res.data);
        } else {
          falhas.push(`Fazenda "${row.nome}" — não foi possível salvar`);
        }
      } catch { falhas.push(`Fazenda "${row.nome}"`); }
      tick('Fazendas');
    }

    // 2. Pastos
    for (const row of (parsed.pastos || [])) {
      const fazendaId = fazendaIdPorNome.get(norm(row.codigo_fazenda));
      if (!fazendaId || !row.nome) { tick('Pastos'); continue; }
      try {
        const res = await createOperationalRecord('pastagens', {
          faz_id: Number(fazendaId),
          nome: row.nome,
          area_ha: parsePositiveNumber(row.area_ha) || null,
          status: 'ativo',
          observacoes: row.observacoes || null,
          metadata: {},
        }, session);
        if (res.data) novosPastos.push(res.data);
        else falhas.push(`Pasto "${row.nome}" — não foi possível salvar`);
      } catch { falhas.push(`Pasto "${row.nome}"`); }
      tick('Pastos');
    }

    // 3. Lotes
    for (const row of (parsed.lotes || [])) {
      const codigoNorm = norm(row.codigo_lote);
      if (!codigoNorm) { tick('Lotes'); continue; }
      if (loteIdPorCodigo.has(codigoNorm)) { tick('Lotes'); continue; }
      const fazendaId = fazendaIdPorNome.get(norm(row.codigo_fazenda));
      const qtd = Number(String(row.quantidade_cabecas).replace(',', '.')) || 0;
      const pIni = parsePositiveNumber(row.peso_inicial_kg) || 0;
      const dataEntrada = parseDate(row.data_entrada) || hojeLocalISO();
      try {
        const res = await createOperationalRecord('lotes', {
          id: gerarNovoId(),
          nome: row.codigo_lote,
          faz_id: fazendaId || null,
          entrada: dataEntrada,
          qtd,
          p_ini: pIni,
          p_at: pIni,
          peso_atual: pIni,
          tipo: 'engorda',
          status: 'ativo',
          observacoes: row.observacoes || null,
        }, session);
        if (res.data?.id) {
          loteIdPorCodigo.set(codigoNorm, res.data.id);
          novosLotes.push(res.data);
        } else {
          falhas.push(`Lote "${row.codigo_lote}" — não foi possível salvar`);
        }
      } catch { falhas.push(`Lote "${row.codigo_lote}"`); }
      tick('Lotes');
    }

    // 4. Animais
    for (const row of (parsed.animais || [])) {
      const brincoNorm = norm(row.brinco);
      if (!brincoNorm) { tick('Animais'); continue; }
      if (animalIdPorBrinco.has(brincoNorm)) { tick('Animais'); continue; }
      const loteId = loteIdPorCodigo.get(norm(row.codigo_lote));
      const pIni = parsePositiveNumber(row.peso_inicial_kg) || null;
      try {
        const res = await createOperationalRecord('animais', {
          id: gerarNovoId(),
          identificacao: row.brinco,
          lote_id: loteId || null,
          tipo_registro: 'individual',
          qtd: 1,
          sexo: row.sexo || null,
          p_ini: pIni,
          p_at: pIni,
          status: 'ativo',
          observacao: row.observacoes || null,
        }, session);
        if (res.data?.id) {
          animalIdPorBrinco.set(brincoNorm, res.data.id);
          novosAnimais.push(res.data);
        } else {
          falhas.push(`Animal "${row.brinco}" — não foi possível salvar`);
        }
      } catch { falhas.push(`Animal "${row.brinco}"`); }
      tick('Animais');
    }

    // 5. Pesagens por Lote
    for (const row of (parsed.pesagens_lotes || [])) {
      const loteId = loteIdPorCodigo.get(norm(row.codigo_lote));
      const dataValida = parseDate(row.data_pesagem);
      const peso = parsePositiveNumber(row.peso_medio_kg);
      if (!loteId || !dataValida || !peso) { tick('Pesagens por Lote'); continue; }

      const jaExiste = (db?.pesagens || []).some(
        (p) => Number(p.lote_id) === Number(loteId) && String(p.tipo) === 'lote' && String(p.data) === dataValida
      );
      if (jaExiste) { tick('Pesagens por Lote'); continue; }

      const qtdCabecas = row.quantidade_cabecas ? (Number(String(row.quantidade_cabecas).replace(',', '.')) || null) : null;
      try {
        const res = await createOperationalRecord('pesagens', {
          id: gerarNovoId(),
          lote_id: loteId,
          animal_id: null,
          data: dataValida,
          peso_medio: peso,
          tipo: 'lote',
          origem: 'importacao',
          observacao: row.observacoes || null,
          metadata: qtdCabecas ? { quantidade_pesada: qtdCabecas } : {},
        }, session);
        if (res.data) novasPesagens.push(res.data);
        else falhas.push(`Pesagem do lote "${row.codigo_lote}" em ${row.data_pesagem}`);
      } catch { falhas.push(`Pesagem do lote "${row.codigo_lote}" em ${row.data_pesagem}`); }
      tick('Pesagens por Lote');
    }

    // 6. Pesagens por Animal
    for (const row of (parsed.pesagens_animais || [])) {
      const animalId = animalIdPorBrinco.get(norm(row.brinco));
      const dataValida = parseDate(row.data_pesagem);
      const peso = parsePositiveNumber(row.peso_kg);
      if (!animalId || !dataValida || !peso) { tick('Pesagens por Animal'); continue; }

      const jaExiste = (db?.pesagens || []).some(
        (p) => Number(p.animal_id) === Number(animalId) && String(p.tipo) === 'animal' && String(p.data) === dataValida
      );
      if (jaExiste) { tick('Pesagens por Animal'); continue; }

      const loteId = row.codigo_lote ? loteIdPorCodigo.get(norm(row.codigo_lote)) : null;
      try {
        const res = await createOperationalRecord('pesagens', {
          id: gerarNovoId(),
          lote_id: loteId || null,
          animal_id: animalId,
          data: dataValida,
          peso_medio: peso,
          tipo: 'animal',
          origem: 'importacao',
          observacao: row.observacoes || null,
          metadata: {},
        }, session);
        if (res.data) novasPesagens.push(res.data);
        else falhas.push(`Pesagem do animal "${row.brinco}" em ${row.data_pesagem}`);
      } catch { falhas.push(`Pesagem do animal "${row.brinco}" em ${row.data_pesagem}`); }
      tick('Pesagens por Animal');
    }

    // Atualizar estado local
    setDb((prev) => ({
      ...prev,
      fazendas: [...(prev.fazendas || []), ...novasFazendas],
      pastagens: [...(prev.pastagens || []), ...novosPastos],
      lotes: [...(prev.lotes || []), ...novosLotes],
      animais: [...(prev.animais || []), ...novosAnimais],
      pesagens: [...(prev.pesagens || []), ...novasPesagens],
    }));

    setResultado({
      fazendas: novasFazendas.length,
      pastos: novosPastos.length,
      lotes: novosLotes.length,
      animais: novosAnimais.length,
      pesagens_lotes: novasPesagens.filter((p) => p.tipo === 'lote').length,
      pesagens_animais: novasPesagens.filter((p) => p.tipo === 'animal').length,
      falhas,
    });
    setPasso('resultado');
  }

  function reiniciar() {
    setPasso('template');
    setNomeArquivo('');
    setParsed(null);
    setErros(null);
    setResultado(null);
    setProgresso({ atual: 0, total: 0, etapa: '' });
  }

  function navegar(pagina) {
    if (typeof onNavigate === 'function') onNavigate(pagina);
  }

  // ── Renders por passo ────────────────────────────────────────────────────────

  // Passo 0 — Modelo
  if (passo === 'template') {
    return (
      <div className="page-content">
        <PageHeader
          title="Importação Inicial de Dados e Pesagens"
          subtitle="Use o modelo oficial do HERDON para trazer fazendas, pastos, lotes, animais e pesagens de uma só vez."
        />
        <div style={{ maxWidth: 680, display: 'grid', gap: 24 }}>
          <StepBar passoAtual="template" />

          <Card title="Como funciona">
            <div style={{ display: 'grid', gap: 14, padding: '4px 0' }}>
              {[
                ['1. Baixe o modelo', 'Clique em "Baixar modelo .xlsx" para obter a planilha com as abas já prontas e um exemplo de preenchimento.'],
                ['2. Preencha os seus dados', 'Abra no Excel ou Google Sheets, substitua os dados de exemplo pelos seus e salve.'],
                ['3. Envie o arquivo', 'De volta aqui, envie o arquivo preenchido. O HERDON vai verificar tudo antes de salvar.'],
                ['4. Confirme a importação', 'Revise os dados e confirme. Os registros serão criados na ordem certa automaticamente.'],
              ].map(([titulo, desc]) => (
                <div key={titulo} className="importacao-passo">
                  <strong style={{ fontSize: 14, color: 'var(--color-text)' }}>{titulo}</strong>
                  <span style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{desc}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="O que você pode importar">
            <div style={{ display: 'grid', gap: 10, padding: '4px 0' }}>
              {[
                ['Fazendas', 'Nome, cidade, estado e área', true],
                ['Pastos', 'Nome e área por fazenda', true],
                ['Lotes', 'Código, fazenda, data de entrada, quantidade e peso inicial', true],
                ['Animais', 'Brinco, lote, sexo e peso inicial', true],
                ['Pesagens por Lote', 'Data, peso médio e quantidade — gera histórico de GMD', true],
                ['Pesagens por Animal', 'Brinco, data e peso individual', true],
              ].map(([nome, desc, ok]) => (
                <div key={nome} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, padding: '4px 0' }}>
                  <span style={{ color: ok ? 'var(--color-success, #16a34a)' : 'var(--color-text-secondary)' }}>
                    {ok ? '✓' : '○'}
                  </span>
                  <div>
                    <strong style={{ color: 'var(--color-text)' }}>{nome}</strong>
                    <span style={{ color: 'var(--color-text-secondary)', marginLeft: 6 }}>{desc}</span>
                  </div>
                </div>
              ))}
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                As abas de pesagens são opcionais — você pode importar só o cadastro inicial e adicionar as pesagens depois.
              </p>
            </div>
          </Card>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={baixarModelo}>
              <Download size={16} style={{ marginRight: 6 }} />
              Baixar modelo .xlsx
            </Button>
            <Button variant="outline" onClick={() => setPasso('upload')}>
              Já tenho o arquivo preenchido
              <ChevronRight size={16} style={{ marginLeft: 4 }} />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Passo 1 — Upload
  if (passo === 'upload') {
    return (
      <div className="page-content">
        <PageHeader title="Importação Inicial de Dados e Pesagens" subtitle="Envie o arquivo preenchido" />
        <div style={{ maxWidth: 560, display: 'grid', gap: 20 }}>
          <StepBar passoAtual="upload" />

          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? 'var(--color-primary, #2563eb)' : 'var(--color-border, #d1d5db)'}`,
              borderRadius: 16, padding: '56px 32px', textAlign: 'center', cursor: 'pointer',
              background: isDragging ? 'rgba(37,99,235,0.04)' : 'transparent',
              transition: 'all 0.15s ease',
            }}
          >
            <FileUp size={36} style={{ color: 'var(--color-text-secondary)', marginBottom: 14 }} />
            <p style={{ margin: 0, fontWeight: 600, fontSize: 16, color: 'var(--color-text)' }}>Arraste o arquivo aqui</p>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--color-text-secondary)' }}>ou clique para selecionar</p>
            <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--color-text-secondary)', background: 'rgba(0,0,0,0.04)', display: 'inline-block', padding: '4px 12px', borderRadius: 20 }}>
              Aceito: .xlsx (modelo oficial do HERDON)
            </p>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileInput} />
          </div>

          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.12)', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--color-text)' }}>Use sempre o modelo oficial.</strong>{' '}
            Planilhas com colunas diferentes ou em outros formatos podem não ser lidas corretamente.
            <button type="button" onClick={baixarModelo} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary, #2563eb)', fontWeight: 600, padding: 0, marginLeft: 6, fontSize: 13 }}>
              Baixar modelo →
            </button>
          </div>

          <div>
            <Button variant="ghost" onClick={() => setPasso('template')}>← Voltar</Button>
          </div>
        </div>
      </div>
    );
  }

  // Passo 2 — Validação
  if (passo === 'validacao') {
    const abas = Object.keys(ABA_LABELS);
    const errosAbaAtiva = erros?.[abaAtiva] || [];
    const temErrosGlobais = temErrosAtivos();
    const nErros = totalErros();

    return (
      <div className="page-content">
        <PageHeader
          title="Importação Inicial de Dados e Pesagens"
          subtitle={nomeArquivo || 'Revisão dos dados'}
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" onClick={() => setPasso('upload')}>Trocar arquivo</Button>
              <Button
                variant="primary"
                onClick={() => setPasso('confirmacao')}
                disabled={temErrosGlobais}
                title={temErrosGlobais ? 'Corrija os erros antes de continuar' : undefined}
              >
                Avançar <ChevronRight size={16} style={{ marginLeft: 4 }} />
              </Button>
            </div>
          }
        />

        <div style={{ maxWidth: 720 }}>
          <StepBar passoAtual="validacao" />

          {temErrosGlobais ? (
            <div style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', gap: 10 }}>
              <AlertCircle size={16} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong style={{ fontSize: 14 }}>
                  {nErros} {nErros === 1 ? 'problema encontrado' : 'problemas encontrados'}
                </strong>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  Abra o arquivo, corrija os itens indicados abaixo, salve e envie novamente.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 12, background: 'rgba(22,163,74,0.05)', border: '1px solid rgba(22,163,74,0.2)', display: 'flex', gap: 10 }}>
              <CheckCircle2 size={16} style={{ color: '#16a34a', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 14, color: 'var(--color-text)' }}>Tudo certo! Você pode avançar e confirmar a importação.</span>
            </div>
          )}

          {/* Abas de revisão */}
          <div style={{ borderBottom: '1px solid var(--color-border, #e5e7eb)', marginBottom: 20, display: 'flex', gap: 0, flexWrap: 'wrap' }}>
            {abas.map((aba) => {
              const qtdErros = (erros?.[aba] || []).length;
              const qtdDados = (parsed?.[aba] || []).length;
              const isAtiva = aba === abaAtiva;
              return (
                <button key={aba} type="button" onClick={() => setAbaAtiva(aba)} style={{
                  padding: '9px 14px', fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer',
                  borderBottom: isAtiva ? '2px solid var(--color-primary, #2563eb)' : '2px solid transparent',
                  color: isAtiva ? 'var(--color-primary, #2563eb)' : 'var(--color-text-secondary)',
                  fontWeight: isAtiva ? 600 : 400, display: 'flex', alignItems: 'center', gap: 6, marginBottom: -1,
                }}>
                  {ABA_LABELS[aba]}
                  {qtdErros > 0 && (
                    <span style={{ background: '#dc2626', color: '#fff', borderRadius: 10, fontSize: 11, padding: '1px 6px', fontWeight: 700 }}>{qtdErros}</span>
                  )}
                  {qtdErros === 0 && qtdDados > 0 && <CheckCircle2 size={13} style={{ color: '#16a34a' }} />}
                  {qtdDados === 0 && <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>vazia</span>}
                </button>
              );
            })}
          </div>

          <Card
            title={ABA_LABELS[abaAtiva]}
            subtitle={`${(parsed?.[abaAtiva] || []).length} linha${(parsed?.[abaAtiva] || []).length !== 1 ? 's' : ''}`}
          >
            <ErrosList erros={errosAbaAtiva} />
          </Card>
        </div>
      </div>
    );
  }

  // Passo 3 — Confirmação
  if (passo === 'confirmacao') {
    const resumo = {
      fazendas: (parsed?.fazendas || []).length,
      pastos: (parsed?.pastos || []).length,
      lotes: (parsed?.lotes || []).length,
      animais: (parsed?.animais || []).length,
      pesagens_lotes: (parsed?.pesagens_lotes || []).length,
      pesagens_animais: (parsed?.pesagens_animais || []).length,
    };
    const total = Object.values(resumo).reduce((s, n) => s + n, 0);

    return (
      <div className="page-content">
        <PageHeader
          title="Importação Inicial de Dados e Pesagens"
          subtitle="Confirme o que será importado"
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" onClick={() => setPasso('validacao')}>← Voltar</Button>
              <Button variant="primary" onClick={executarImportacao}>
                <Upload size={16} style={{ marginRight: 6 }} />
                Confirmar e importar
              </Button>
            </div>
          }
        />
        <div style={{ maxWidth: 480 }}>
          <StepBar passoAtual="confirmacao" />

          <Card title={`${total} registro${total !== 1 ? 's' : ''} serão importados`}>
            <div style={{ display: 'grid', gap: 8, padding: '4px 0' }}>
              {Object.entries(resumo).map(([chave, qty]) => qty > 0 ? (
                <div key={chave} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0', borderBottom: '1px solid var(--color-border, #f3f4f6)' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{ABA_LABELS[chave]}</span>
                  <strong>{qty} {qty === 1 ? 'linha' : 'linhas'}</strong>
                </div>
              ) : null)}
            </div>
            <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.03)', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Fazendas, lotes e animais que já existem pelo nome serão pulados automaticamente. Pesagens com conflito de data já foram bloqueadas na etapa anterior.
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Passo 4 — Gravando
  if (passo === 'gravando') {
    return (
      <div className="page-content">
        <PageHeader title="Salvando os dados…" subtitle="Aguarde enquanto os registros são criados" />
        <div style={{ maxWidth: 440 }}>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '32px 0' }}>
              <Loader2 size={36} style={{ color: 'var(--color-primary, #2563eb)', animation: 'spin 1s linear infinite' }} />
              <div style={{ width: '100%' }}>
                <ProgressoBar atual={progresso.atual} total={progresso.total} etapa={progresso.etapa} />
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                Não feche esta janela durante o processo.
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Passo 5 — Resultado
  if (passo === 'resultado') {
    const totalImportado = resultado
      ? resultado.fazendas + resultado.pastos + resultado.lotes + resultado.animais + resultado.pesagens_lotes + resultado.pesagens_animais
      : 0;
    const temFalhas = (resultado?.falhas || []).length > 0;

    return (
      <div className="page-content">
        <PageHeader
          title={temFalhas ? 'Importação concluída com avisos' : 'Importação concluída com sucesso'}
          subtitle={`${totalImportado} registro${totalImportado !== 1 ? 's' : ''} criado${totalImportado !== 1 ? 's' : ''} no HERDON`}
        />
        <div style={{ maxWidth: 540, display: 'grid', gap: 20 }}>
          <Card title="Resumo por categoria">
            <div style={{ display: 'grid', gap: 4, padding: '4px 0' }}>
              {resultado && Object.entries({
                fazendas: 'Fazendas', pastos: 'Pastos', lotes: 'Lotes', animais: 'Animais',
                pesagens_lotes: 'Pesagens por Lote', pesagens_animais: 'Pesagens por Animal',
              }).map(([chave, label]) => (
                <div key={chave} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, padding: '7px 0', borderBottom: '1px solid var(--color-border, #f3f4f6)' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: resultado[chave] > 0 ? 'var(--color-success, #16a34a)' : 'var(--color-text-secondary)' }}>
                    {resultado[chave] > 0 ? `+${resultado[chave]}` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {temFalhas && (
            <Card title="Itens que não puderam ser salvos">
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
                {resultado.falhas.map((f, i) => (
                  <li key={i} style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: '3px 0' }}>• {f}</li>
                ))}
              </ul>
              <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                Isso pode acontecer por instabilidade de conexão. Os registros bem-sucedidos já foram salvos.
              </p>
            </Card>
          )}

          <Card title="Ir para">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '4px 0' }}>
              {[
                ['fazendas', 'Fazendas'],
                ['lotes', 'Lotes'],
                ['animais', 'Animais'],
                ['pesagens', 'Pesagens'],
              ].map(([pagina, label]) => (
                <Button key={pagina} variant="outline" size="sm" onClick={() => navegar(pagina)}>
                  {label}
                </Button>
              ))}
            </div>
          </Card>

          <div>
            <Button variant="ghost" onClick={reiniciar}>
              <Upload size={16} style={{ marginRight: 6 }} />
              Nova importação
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
