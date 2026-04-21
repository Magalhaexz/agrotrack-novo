import { useMemo, useState } from 'react';
import { CheckSquare, Package, Pill, Scale, Syringe, Truck, Leaf, CalendarDays } from 'lucide-react'; // Adicionado CalendarDays para o ícone padrão
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { gerarNovoId } from '../utils/id';
import { formatDate } from '../utils/calculations'; // Assumindo que formatDate está em utils/calculations

// Mapeamento de tipos de evento para ícones e cores
const typeMap = {
  vacina: { icon: Syringe, color: 'var(--color-info)' },
  vermifugo: { icon: Pill, color: 'var(--color-primary-light)' },
  pesagem: { icon: Scale, color: 'var(--color-success)' },
  dieta: { icon: Leaf, color: 'var(--color-warning)' }, // Suplementação
  estoque: { icon: Package, color: 'var(--color-danger)' }, // Movimentação de estoque
  saida: { icon: Truck, color: 'var(--color-text-secondary)' }, // Saída de animais
  livre: { icon: CheckSquare, color: 'var(--color-text-secondary)' }, // Evento genérico
  // Adicionar um tipo padrão para eventos sanitários que não se encaixam nos outros
  sanitario: { icon: Syringe, color: 'var(--color-info)' },
  operacional: { icon: CalendarDays, color: 'var(--color-text-secondary)' }, // Para eventos_operacionais genéricos
};

/**
 * Componente da página de Calendário Operacional.
 * Exibe um calendário mensal e os eventos do dia selecionado.
 * Permite adicionar novos eventos operacionais.
 *
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 */
export default function CalendarioOperacionalPage({ db, setDb }) {
  const [selected, setSelected] = useState(new Date().toISOString().slice(0, 10));
  const [open, setOpen] = useState(false);

  // Consolida eventos operacionais e sanitários em uma única lista
  const allEvents = useMemo(() => {
    const operacionais = (db.eventos_operacionais || []).map(ev => ({ ...ev, _source: 'operacional', _type: ev.tipo || 'operacional' }));
    const sanitarios = (db.sanitario || []).map(ev => ({ ...ev, _source: 'sanitario', _type: ev.tipo || 'sanitario', titulo: ev.desc, data: ev.data_aplic }));
    return [...operacionais, ...sanitarios].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
  }, [db.eventos_operacionais, db.sanitario]);

  // Pré-processa eventos por data para buscas eficientes no calendário
  const eventsByDateMap = useMemo(() => {
    const map = new Map();
    allEvents.forEach(event => {
      if (event.data) {
        const dateKey = event.data.slice(0, 10); // Garante que a chave é apenas a data
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey).push(event);
      }
    });
    return map;
  }, [allEvents]);

  // Pré-processa lotes para buscas eficientes por ID
  const lotesMap = useMemo(() => {
    return new Map((db.lotes || []).map(l => [l.id, l]));
  }, [db.lotes]);

  // Pré-processa funcionários para buscas eficientes por ID
  const funcionariosMap = useMemo(() => {
    return new Map((db.funcionarios || []).map(f => [f.id, f]));
  }, [db.funcionarios]);

  const eventsForSelectedDate = useMemo(() => {
    return eventsByDateMap.get(selected) || [];
  }, [eventsByDateMap, selected]);

  return (
    <div className="page rebanho-page">
      <div className="rebanho-header">
        <h1>Calendário Operacional</h1>
        <Button onClick={() => setOpen(true)}>Novo Evento</Button>
      </div>
      <div className="dashboard-grid dashboard-grid--dual calendar-layout"> {/* Adicionada classe para o estilo */}
        <Card title="Calendário mensal">
          <SimpleCalendar selected={selected} onSelect={setSelected} eventsByDateMap={eventsByDateMap} />
        </Card>
        <Card title={`Eventos em ${formatDate(selected)}`}>
          <div className="alerts-list">
            {eventsForSelectedDate.length === 0 ? <p>Sem eventos no dia.</p> : eventsForSelectedDate.map((ev) => {
              const cfg = typeMap[ev._type] || typeMap.operacional; // Usa _type para mapeamento
              const Icon = cfg.icon;
              const loteNome = ev.lote_id ? lotesMap.get(ev.lote_id)?.nome : (ev.loteNome || 'Geral');
              const responsavelNome = ev.funcionario_responsavel_id ? funcionariosMap.get(ev.funcionario_responsavel_id)?.nome : (ev.responsavel || 'Sem responsável');

              return (
                <div key={ev.id} className="alert-item">
                  <Icon size={14} style={{ color: cfg.color }} />
                  <div>
                    <strong>{ev.titulo || ev.desc}</strong>
                    <p>{ev.status || 'programado'} · {responsavelNome} · {loteNome}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      {open && (
        <NovoEventoModal
          db={db}
          setDb={setDb}
          onClose={() => setOpen(false)}
          lotesMap={lotesMap}
          funcionariosMap={funcionariosMap}
        />
      )}
    </div>
  );
}

/**
 * Componente de calendário simples para seleção de datas e exibição de eventos.
 *
 * @param {object} props - As propriedades do componente.
 * @param {string} props.selected - A data selecionada no formato 'YYYY-MM-DD'.
 * @param {function} props.onSelect - Callback para quando uma data é selecionada.
 * @param {Map<string, Array<object>>} props.eventsByDateMap - Mapa de eventos por data.
 */
function SimpleCalendar({ selected, onSelect, eventsByDateMap }) {
  const d = new Date(selected);
  const y = d.getFullYear();
  const m = d.getMonth();
  const first = new Date(y, m, 1);
  const start = first.getDay(); // Dia da semana para o 1º do mês (0=Dom, 6=Sáb)
  const daysInMonth = new Date(y, m + 1, 0).getDate(); // Número de dias no mês

  // Cria um array de dias para o calendário, incluindo nulls para preencher o início da semana
  const calendarDays = Array.from({ length: start + daysInMonth }, (_, i) => {
    if (i < start) return null;
    const day = i - start + 1;
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  });

  return (
    <div className="calendar-grid">
      {calendarDays.map((day, idx) => {
        const dayEvents = day ? eventsByDateMap.get(day) || [] : [];
        const color = getDotColor(dayEvents);
        return (
          <button
            key={idx}
            type="button"
            className={`cal-day ${day === selected ? 'active' : ''}`}
            onClick={() => day && onSelect(day)}
            disabled={!day} // Desabilita botões para os nulls iniciais
          >
            {day ? Number(day.slice(8)) : ''}
            {color && <span className="cal-dot" style={{ background: color }} />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Determina a cor do ponto de evento no calendário com base no status dos eventos.
 * @param {Array<object>} events - Lista de eventos para um dia.
 * @returns {string} A cor CSS para o ponto do evento.
 */
function getDotColor(events) {
  if (!events.length) return '';
  // Prioridade: atrasado > hoje > programado > outros (sucesso)
  if (events.some((e) => e.status === 'atrasado')) return 'var(--color-danger)';
  if (events.some((e) => e.status === 'hoje')) return 'var(--color-warning)';
  if (events.some((e) => e.status === 'programado')) return 'var(--color-info)';
  return 'var(--color-success)'; // Cor padrão para outros status ou concluídos
}

/**
 * Componente de modal para adicionar um novo evento operacional.
 *
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 * @param {function} props.onClose - Callback para fechar o modal.
 * @param {Map<number, object>} props.lotesMap - Mapa de lotes por ID.
 * @param {Map<number, object>} props.funcionariosMap - Mapa de funcionários por ID.
 */
function NovoEventoModal({ db, setDb, onClose, lotesMap, funcionariosMap }) {
  const [form, setForm] = useState({
    tipo: 'operacional', // Tipo padrão ajustado
    titulo: '',
    data: '',
    lote_id: '',
    funcionario_responsavel_id: '', // Alterado para ID
    recorrencia: 'nenhuma',
    alerta_antes: 1,
    status: 'programado',
  });

  function handleChange(e) {
    const { name, value, type } = e.target;
    setForm((p) => ({
      ...p,
      [name]: type === 'number' ? Number(value) : value,
    }));
  }

  function submit() {
    if (!form.data || !form.titulo) {
      alert('Por favor, preencha a data e o título do evento.'); // Usar um sistema de toast/erro mais robusto
      return;
    }

    const lote = form.lote_id ? lotesMap.get(Number(form.lote_id)) : null;
    const funcionario = form.funcionario_responsavel_id ? funcionariosMap.get(Number(form.funcionario_responsavel_id)) : null;

    setDb((prev) => ({
      ...prev,
      eventos_operacionais: [
        ...(prev.eventos_operacionais || []),
        {
          id: gerarNovoId(prev.eventos_operacionais || []),
          ...form,
          loteNome: lote?.nome || null, // Adiciona loteNome para exibição
          responsavel: funcionario?.nome || null, // Adiciona nome do responsável para exibição
        },
      ],
    }));
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Novo evento operacional" footer={<Button onClick={submit}>Salvar evento</Button>}>
      <div className="form-grid two">
        <label className="ui-input-wrap">
          <span className="ui-input-label">Tipo</span>
          <select name="tipo" value={form.tipo} onChange={handleChange} className="ui-input">
            {Object.keys(typeMap).map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <Input label="Título/descrição" name="titulo" value={form.titulo} onChange={handleChange} />
        <Input label="Data" type="date" name="data" value={form.data} onChange={handleChange} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Lote</span>
          <select name="lote_id" value={form.lote_id} onChange={handleChange} className="ui-input">
            <option value="">Opcional</option>
            {(db.lotes || []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Responsável</span>
          <select name="funcionario_responsavel_id" value={form.funcionario_responsavel_id} onChange={handleChange} className="ui-input">
            <option value="">Sem responsável</option>
            {(db.funcionarios || []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Recorrência</span>
          <select name="recorrencia" value={form.recorrencia} onChange={handleChange} className="ui-input">
            <option value="nenhuma">Nenhuma</option>
            <option value="semanal">Semanal</option>
            <option value="quinzenal">Quinzenal</option>
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Notificação antecipada (dias)</span>
          <select name="alerta_antes" type="number" value={form.alerta_antes} onChange={handleChange} className="ui-input">
            <option value={0}>0 dia</option>
            <option value={1}>1 dia</option>
            <option value={3}>3 dias</option>
            <option value={7}>7 dias</option>
          </select>
        </label>
      </div>
    </Modal>
  );
}