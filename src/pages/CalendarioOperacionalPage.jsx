import { useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Leaf,
  Package,
  Pill,
  Scale,
  Syringe,
  Truck,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/EmptyState';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { formatDate } from '../utils/calculations';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../auth/useAuth';
import {
  createOperationalRecord,
  deleteOperationalRecord,
  updateOperationalRecord,
} from '../services/operationalPersistence';
import { matchesRotinaRecurrence, matchesEventoRecurrence } from './calendarioOperacionalLogic.js';

import { hojeLocalISO } from '../domain/dataCivil.js';
const MONTH_LABELS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const typeMap = {
  vacina: { icon: Syringe, color: 'var(--color-info)', label: 'Vacina' },
  vermifugo: { icon: Pill, color: 'var(--color-primary)', label: 'Vermífugo' },
  pesagem: { icon: Scale, color: 'var(--color-success)', label: 'Pesagem' },
  dieta: { icon: Leaf, color: 'var(--color-warning)', label: 'Dieta' },
  suplementacao: { icon: Leaf, color: 'var(--color-warning)', label: 'Suplementação' },
  estoque: { icon: Package, color: 'var(--color-danger)', label: 'Estoque' },
  saida: { icon: Truck, color: 'var(--color-text-secondary)', label: 'Saída' },
  livre: { icon: CheckSquare, color: 'var(--color-text-secondary)', label: 'Livre' },
  sanitario: { icon: Syringe, color: 'var(--color-info)', label: 'Sanitário' },
  operacional: { icon: CalendarDays, color: 'var(--color-text-secondary)', label: 'Operacional' },
};

const getTodayIso = () => hojeLocalISO();

const MENSAGEM_SEM_PERMISSAO = 'Você não tem permissão para executar esta ação.';

export default function CalendarioOperacionalPage({ db, setDb, session, fazendaSelecionada = null, onConfirmAction }) {
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  const hoje = getTodayIso();
  const [selectedDate, setSelectedDate] = useState(hoje);
  const [viewMode, setViewMode] = useState('mensal');
  const [cursorDate, setCursorDate] = useState(() => new Date(`${hoje}T00:00:00`));
  const [openModal, setOpenModal] = useState(false);
  const [eventoEditando, setEventoEditando] = useState(null);

  function abrirNovoEvento() {
    if (!hasPermission('sanitario:editar')) {
      showToast({ type: 'error', message: MENSAGEM_SEM_PERMISSAO });
      return;
    }
    setEventoEditando(null);
    setOpenModal(true);
  }

  function abrirEdicaoEvento(eventoRaw) {
    if (!hasPermission('sanitario:editar')) {
      showToast({ type: 'error', message: MENSAGEM_SEM_PERMISSAO });
      return;
    }
    setEventoEditando(eventoRaw);
    setOpenModal(true);
  }

  function fecharModal() {
    setOpenModal(false);
    setEventoEditando(null);
  }

  async function excluirEvento(eventoRaw) {
    if (!hasPermission('sanitario:excluir')) {
      showToast({ type: 'error', message: MENSAGEM_SEM_PERMISSAO });
      return;
    }
    if (!eventoRaw?.id) return;
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
          title: 'Excluir evento?',
          message: `Deseja excluir "${eventoRaw.titulo || 'este evento'}"?`,
          tone: 'danger',
        })
      : window.confirm(`Deseja excluir "${eventoRaw.titulo || 'este evento'}"?`);
    if (!confirmado) return;

    const persisted = await deleteOperationalRecord('eventos_operacionais', eventoRaw.id, session);
    if (!persisted?.persisted) {
      if (persisted?.error) {
        console.error('[HERDON_CALENDAR_SAVE_ERROR]', { action: 'delete', error: persisted.error, payload: { id: eventoRaw.id } });
      }
      showToast({ type: 'warning', message: persisted?.error || 'Não foi possível excluir o evento agora.' });
      return;
    }
    setDb((prev) => ({
      ...prev,
      eventos_operacionais: (prev.eventos_operacionais || []).filter((item) => Number(item.id) !== Number(eventoRaw.id)),
    }));
    showToast({ type: 'success', message: 'Evento excluído.' });
  }

  const lotes = useMemo(() => (Array.isArray(db?.lotes) ? db.lotes : []), [db]);
  const funcionarios = useMemo(() => (Array.isArray(db?.funcionarios) ? db.funcionarios : []), [db]);
  const lotesMap = useMemo(() => new Map(lotes.map((lote) => [Number(lote.id), lote])), [lotes]);
  const funcionariosMap = useMemo(() => new Map(funcionarios.map((funcionario) => [Number(funcionario.id), funcionario])), [funcionarios]);

  const events = useMemo(() => buildCalendarEvents(db, lotesMap, funcionariosMap), [db, funcionariosMap, lotesMap]);

  const eventsByDateMap = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      const key = String(event.data || '').slice(0, 10);
      if (!key) {
        return;
      }
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(event);
    });
    return map;
  }, [events]);

  const selectedEvents = useMemo(
    () => (eventsByDateMap.get(selectedDate) || []).slice().sort((a, b) => a.title.localeCompare(b.title)),
    [eventsByDateMap, selectedDate]
  );

  const upcomingEvents = useMemo(() => {
    return events
      .filter((event) => event.data >= hoje)
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(0, 6);
  }, [events, hoje]);

  const selectedSummary = useMemo(() => {
    const total = selectedEvents.length;
    const sanitarios = selectedEvents.filter((event) => event.source === 'sanitario').length;
    const operacionais = selectedEvents.filter((event) => event.source !== 'sanitario').length;
    return { total, sanitarios, operacionais };
  }, [selectedEvents]);

  const currentMonthLabel = `${MONTH_LABELS[cursorDate.getMonth()]} ${cursorDate.getFullYear()}`;
  const currentYear = cursorDate.getFullYear();

  function handleSelectDate(date) {
    if (!date) {
      return;
    }
    setSelectedDate(date);
    setCursorDate(new Date(`${date}T00:00:00`));
  }

  function goToPreviousPeriod() {
    setCursorDate((prev) => {
      const nextDate = new Date(prev);
      if (viewMode === 'anual') {
        nextDate.setFullYear(prev.getFullYear() - 1);
      } else {
        nextDate.setMonth(prev.getMonth() - 1);
      }
      return nextDate;
    });
  }

  function goToNextPeriod() {
    setCursorDate((prev) => {
      const nextDate = new Date(prev);
      if (viewMode === 'anual') {
        nextDate.setFullYear(prev.getFullYear() + 1);
      } else {
        nextDate.setMonth(prev.getMonth() + 1);
      }
      return nextDate;
    });
  }

  function goToToday() {
    handleSelectDate(hoje);
  }

  return (
    <div className="page calendario-page">
      <section className="calendar-hero">
        <div>
          <span className="calendar-hero-kicker">Operação coordenada</span>
          <h1>Calendário Operacional</h1>
          <p>Monitore eventos sanitários e operacionais, navegue entre períodos e abra o detalhe de qualquer data com contexto completo.</p>
        </div>

        <div className="calendar-hero-actions">
          <Button variant="outline" onClick={goToToday}>Hoje</Button>
          <Button onClick={abrirNovoEvento}>Novo evento</Button>
        </div>
      </section>

      <div className="dashboard-grid dashboard-grid--kpi-main">
        <Card title="Eventos na data">
          <strong>{selectedSummary.total}</strong>
          <p className="calendar-kpi-sub">{formatDate(selectedDate)}</p>
        </Card>
        <Card title="Sanitários">
          <strong>{selectedSummary.sanitarios}</strong>
          <p className="calendar-kpi-sub">Agenda clínica e preventiva</p>
        </Card>
        <Card title="Operacionais">
          <strong>{selectedSummary.operacionais}</strong>
          <p className="calendar-kpi-sub">Pesagens, saídas e eventos livres</p>
        </Card>
      </div>

      <div className="calendar-shell">
        <Card className="calendar-main-card">
          <div className="calendar-toolbar">
            <div className="calendar-period-nav">
              <Button variant="ghost" size="sm" icon={<ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />} onClick={goToPreviousPeriod}>Anterior</Button>
              <div className="calendar-period-label">
                <strong>{viewMode === 'anual' ? `Ano ${currentYear}` : currentMonthLabel}</strong>
                <span>{viewMode === 'anual' ? 'Visão consolidada dos 12 meses' : 'Visão detalhada do mês selecionado'}</span>
              </div>
              <Button variant="ghost" size="sm" icon={<ChevronRight size={16} />} onClick={goToNextPeriod}>Próximo</Button>
            </div>

            <div className="calendar-view-toggle">
              <Button variant={viewMode === 'mensal' ? 'primary' : 'outline'} size="sm" onClick={() => setViewMode('mensal')}>Mensal</Button>
              <Button variant={viewMode === 'anual' ? 'primary' : 'outline'} size="sm" onClick={() => setViewMode('anual')}>Anual</Button>
            </div>
          </div>

          {viewMode === 'mensal' ? (
            <MonthlyCalendar
              cursorDate={cursorDate}
              selectedDate={selectedDate}
              eventsByDateMap={eventsByDateMap}
              onSelectDate={handleSelectDate}
            />
          ) : (
            <YearCalendar
              year={currentYear}
              selectedDate={selectedDate}
              eventsByDateMap={eventsByDateMap}
              onSelectDate={handleSelectDate}
            />
          )}
        </Card>

        <div className="calendar-side-column">
          <Card title={`Agenda de ${formatDate(selectedDate)}`} subtitle="Clique em um dia para atualizar a lista de eventos.">
            {selectedEvents.length === 0 ? (
              <EmptyState
                compact
                title="Sem eventos nesta data."
                subtitle='Use o botão "Novo evento" para registrar um compromisso operacional.'
                action={<Button size="sm" onClick={abrirNovoEvento}>Novo evento</Button>}
              />
            ) : (
              <div className="calendar-event-list">
                {selectedEvents.map((event) => {
                  const config = typeMap[event.type] || typeMap.operacional;
                  const Icon = config.icon;

                  return (
                    <article key={`${event.source}-${event.id}-${event.data}`} className="calendar-event-card">
                      <div className="calendar-event-icon" style={{ color: config.color }}>
                        <Icon size={16} />
                      </div>
                      <div className="calendar-event-content">
                        <div className="calendar-event-topline">
                          <strong>{event.title}</strong>
                          <span>{config.label}</span>
                        </div>
                        <p>{event.description}</p>
                        <small>{event.metaLine}</small>
                        {event.source === 'operacional' && event.raw ? (
                          <div className="action-row" style={{ marginTop: 6, gap: 8 }}>
                            <button type="button" className="action-btn" onClick={() => abrirEdicaoEvento(event.raw)}>Editar</button>
                            <button type="button" className="action-btn action-btn-danger" onClick={() => excluirEvento(event.raw)}>Excluir</button>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="Próximos eventos" subtitle="Visão rápida dos compromissos futuros.">
            {upcomingEvents.length === 0 ? (
              <EmptyState
                compact
                title="Nenhum evento futuro."
                subtitle="Assim que novos eventos forem adicionados, eles aparecem aqui."
              />
            ) : (
              <div className="calendar-upcoming-list">
                {upcomingEvents.map((event) => (
                  <button
                    key={`upcoming-${event.source}-${event.id}-${event.data}`}
                    type="button"
                    className={`calendar-upcoming-item ${event.data === selectedDate ? 'active' : ''}`}
                    onClick={() => handleSelectDate(event.data)}
                  >
                    <div>
                      <strong>{event.title}</strong>
                      <span>{formatDate(event.data)}</span>
                    </div>
                    <small>{event.metaLine}</small>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {openModal ? (
        <NovoEventoModal
          db={db}
          setDb={setDb}
          session={session}
          fazendaSelecionada={fazendaSelecionada}
          eventoEditando={eventoEditando}
          defaultDate={selectedDate}
          showToast={showToast}
          onClose={fecharModal}
        />
      ) : null}
    </div>
  );
}

function MonthlyCalendar({ cursorDate, selectedDate, eventsByDateMap, onSelectDate }) {
  const year = cursorDate.getFullYear();
  const month = cursorDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekDay = firstDay.getDay();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const offset = index - firstWeekDay;
    const current = new Date(year, month, offset + 1);
    return {
      date: current.toISOString().slice(0, 10),
      inCurrentMonth: current.getMonth() === month,
      dayNumber: current.getDate(),
    };
  });

  return (
    <div className="calendar-month-view">
      <div className="calendar-weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="calendar-month-grid">
        {cells.map((cell) => {
          const dayEvents = eventsByDateMap.get(cell.date) || [];
          const tone = getEventTone(dayEvents);

          return (
            <button
              key={cell.date}
              type="button"
              className={[
                'calendar-day-cell',
                cell.date === selectedDate ? 'active' : '',
                cell.inCurrentMonth ? '' : 'muted',
              ].filter(Boolean).join(' ')}
              onClick={() => onSelectDate(cell.date)}
            >
              <div className="calendar-day-head">
                <span>{cell.dayNumber}</span>
                {dayEvents.length ? <small>{dayEvents.length}</small> : null}
              </div>
              {dayEvents.length ? <div className={`calendar-day-dot tone-${tone}`} /> : null}
              {dayEvents.length ? <p>{dayEvents[0].title}</p> : <p className="empty">Sem eventos</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function YearCalendar({ year, selectedDate, eventsByDateMap, onSelectDate }) {
  return (
    <div className="calendar-year-grid">
      {MONTH_LABELS.map((label, monthIndex) => (
        <MiniMonthCard
          key={`${year}-${monthIndex}`}
          year={year}
          monthIndex={monthIndex}
          label={label}
          selectedDate={selectedDate}
          eventsByDateMap={eventsByDateMap}
          onSelectDate={onSelectDate}
        />
      ))}
    </div>
  );
}

function MiniMonthCard({ year, monthIndex, label, selectedDate, eventsByDateMap, onSelectDate }) {
  const firstDay = new Date(year, monthIndex, 1);
  const firstWeekDay = firstDay.getDay();
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const slots = Array.from({ length: firstWeekDay + totalDays }, (_, index) => {
    if (index < firstWeekDay) {
      return null;
    }

    const day = index - firstWeekDay + 1;
    return new Date(year, monthIndex, day).toISOString().slice(0, 10);
  });
  const monthEventCount = slots.reduce((total, date) => total + ((date && eventsByDateMap.get(date)?.length) || 0), 0);

  return (
    <article className="calendar-mini-month">
      <header>
        <strong>{label}</strong>
        <span>{monthEventCount} eventos</span>
      </header>

      <div className="calendar-mini-weekdays">
        {WEEKDAY_LABELS.map((weekday) => (
          <span key={`${label}-${weekday}`}>{weekday[0]}</span>
        ))}
      </div>

      <div className="calendar-mini-grid">
        {slots.map((date, index) => {
          if (!date) {
            return <span key={`${label}-empty-${index}`} className="calendar-mini-empty" />;
          }

          const events = eventsByDateMap.get(date) || [];
          const tone = getEventTone(events);

          return (
            <button
              key={date}
              type="button"
              className={`calendar-mini-day ${date === selectedDate ? 'active' : ''} ${events.length ? `tone-${tone}` : ''}`}
              onClick={() => onSelectDate(date)}
              title={`${formatDate(date)}${events.length ? ` - ${events.length} evento(s)` : ''}`}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>
    </article>
  );
}

function NovoEventoModal({ db, setDb, session, fazendaSelecionada, eventoEditando, defaultDate, showToast, onClose }) {
  const isEdit = Boolean(eventoEditando?.id);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState(() => ({
    tipo: eventoEditando?.tipo || 'operacional',
    titulo: eventoEditando?.titulo || '',
    descricao: eventoEditando?.descricao || '',
    data: String(eventoEditando?.data_inicio || eventoEditando?.data || defaultDate || getTodayIso()).slice(0, 10),
    lote_id: eventoEditando?.lote_id ?? '',
    funcionario_responsavel_id: eventoEditando?.funcionario_id ?? eventoEditando?.funcionario_responsavel_id ?? '',
    recorrencia: eventoEditando?.metadata?.recorrencia || 'nenhuma',
    alerta_antes: eventoEditando?.metadata?.alerta_antes ?? 1,
    status: eventoEditando?.status || 'programado',
  }));

  function handleChange(event) {
    const { name, value, type } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  }

  async function submit() {
    setErro('');
    if (!form.data || !form.titulo.trim()) {
      setErro('Não foi possível salvar o evento. Verifique os campos obrigatórios (título e data).');
      return;
    }

    const fazendaAtivaId = fazendaSelecionada?.id ?? fazendaSelecionada?.fazenda_id ?? null;
    const payload = {
      titulo: form.titulo.trim(),
      tipo: form.tipo,
      descricao: String(form.descricao || '').trim(),
      data_inicio: form.data,
      status: form.status || 'programado',
      lote_id: form.lote_id ? Number(form.lote_id) : null,
      fazenda_id: fazendaAtivaId ? Number(fazendaAtivaId) : null,
      funcionario_id: form.funcionario_responsavel_id ? Number(form.funcionario_responsavel_id) : null,
      origem: 'calendario',
      metadata: {
        recorrencia: form.recorrencia || 'nenhuma',
        alerta_antes: Number(form.alerta_antes || 0),
      },
    };

    setSalvando(true);
    try {
      const persisted = isEdit
        ? await updateOperationalRecord('eventos_operacionais', eventoEditando.id, payload, session)
        : await createOperationalRecord('eventos_operacionais', payload, session);

      if (!persisted?.persisted) {
        console.error('[HERDON_CALENDAR_SAVE_ERROR]', {
          action: isEdit ? 'update' : 'create',
          error: persisted?.error,
          payload,
        });
        setErro(persisted?.error || 'Ocorreu um erro inesperado ao salvar o evento.');
        return;
      }

      const registroFinal = { ...(isEdit ? eventoEditando : {}), ...payload, ...(persisted.data || {}) };
      setDb((prev) => {
        const atuais = Array.isArray(prev?.eventos_operacionais) ? prev.eventos_operacionais : [];
        if (isEdit) {
          return {
            ...prev,
            eventos_operacionais: atuais.map((item) => (
              Number(item.id) === Number(eventoEditando.id) ? registroFinal : item
            )),
          };
        }
        return { ...prev, eventos_operacionais: [...atuais, registroFinal] };
      });
      showToast?.({ type: 'success', message: isEdit ? 'Evento atualizado.' : 'Evento criado.' });
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Editar evento operacional' : 'Novo evento operacional'}
      footer={<Button onClick={submit} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar evento'}</Button>}
    >
      <div className="form-grid two">
        <label className="ui-input-wrap">
          <span className="ui-input-label">Tipo</span>
          <select name="tipo" value={form.tipo} onChange={handleChange} className="ui-input">
            {Object.keys(typeMap).map((type) => (
              <option key={type} value={type}>{typeMap[type].label}</option>
            ))}
          </select>
        </label>

        <Input label="Título" name="titulo" value={form.titulo} onChange={handleChange} />
        <Input label="Data" type="date" name="data" value={form.data} onChange={handleChange} />

        <label className="ui-input-wrap" style={{ gridColumn: '1 / -1' }}>
          <span className="ui-input-label">Descrição (opcional)</span>
          <input className="ui-input" name="descricao" value={form.descricao} onChange={handleChange} placeholder="Detalhes do evento" />
        </label>

        <label className="ui-input-wrap">
          <span className="ui-input-label">Status</span>
          <select name="status" value={form.status} onChange={handleChange} className="ui-input">
            <option value="programado">Programado</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </label>

        <label className="ui-input-wrap">
          <span className="ui-input-label">Lote</span>
          <select name="lote_id" value={form.lote_id} onChange={handleChange} className="ui-input">
            <option value="">Opcional</option>
            {(db.lotes || []).map((lote) => (
              <option key={lote.id} value={lote.id}>{lote.nome}</option>
            ))}
          </select>
        </label>

        <label className="ui-input-wrap">
          <span className="ui-input-label">Responsável</span>
          <select
            name="funcionario_responsavel_id"
            value={form.funcionario_responsavel_id}
            onChange={handleChange}
            className="ui-input"
          >
            <option value="">Sem responsável</option>
            {(db.funcionarios || []).map((funcionario) => (
              <option key={funcionario.id} value={funcionario.id}>{funcionario.nome}</option>
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
          <span className="ui-input-label">Notificação antecipada</span>
          <select name="alerta_antes" value={form.alerta_antes} onChange={handleChange} className="ui-input">
            <option value={0}>0 dia</option>
            <option value={1}>1 dia</option>
            <option value={3}>3 dias</option>
            <option value={7}>7 dias</option>
          </select>
        </label>
      </div>
      {erro ? (
        <p style={{ margin: '10px 0 0', color: 'var(--color-danger)', fontSize: '0.85rem' }}>{erro}</p>
      ) : null}
    </Modal>
  );
}

function buildCalendarEvents(db, lotesMap, funcionariosMap) {
  const operacionais = expandRecurringEventos(db?.eventos_operacionais || [], lotesMap, funcionariosMap);
  const sanitarios = (db?.sanitario || []).map((event) => normalizeSanitaryEvent(event, lotesMap, funcionariosMap));
  const pesagens = (db?.pesagens || []).map((event) => normalizePesagemEvent(event, lotesMap));
  const rotinas = expandRecurringRotinas(db?.rotinas || [], lotesMap, funcionariosMap);
  const saidas = (db?.lotes || [])
    .filter((lote) => lote?.saida || lote?.data_saida)
    .map((lote) => normalizeSaidaEvent(lote));

  return [...operacionais, ...sanitarios, ...pesagens, ...rotinas, ...saidas]
    .filter((event) => event?.data)
    .sort((a, b) => a.data.localeCompare(b.data));
}

function normalizeOperationalEvent(event, lotesMap, funcionariosMap, dataOcorrencia = null) {
  const lote = event?.lote_id ? lotesMap.get(Number(event.lote_id)) : null;
  const funcionarioId = event?.funcionario_id ?? event?.funcionario_responsavel_id;
  const responsavel = funcionarioId ? funcionariosMap.get(Number(funcionarioId)) : null;
  // Coluna real é data_inicio; mantém 'data' como alias para registros antigos.
  const data = dataOcorrencia || String(event.data_inicio || event.data || '').slice(0, 10);

  return {
    id: dataOcorrencia ? `${event.id}-${dataOcorrencia}` : event.id,
    source: 'operacional',
    type: event.tipo || 'operacional',
    data,
    title: event.titulo || 'Evento operacional',
    description: [event.status || 'programado', lote?.nome || null].filter(Boolean).join(' · '),
    metaLine: responsavel?.nome || event.responsavel || 'Sem responsável',
    // Editar/Excluir agem sobre o registro base — igual às instâncias
    // virtuais de rotina recorrente (RotinaPage), não existe edição por
    // ocorrência individual.
    raw: event,
  };
}

// Janela de expansão: mesmos limites de `expandRecurringRotinas` (2 meses
// atrás a 13 meses à frente), para não gerar ocorrências sem fim.
function expandRecurringEventos(eventos, lotesMap, funcionariosMap) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 13, 0);

  return eventos.flatMap((evento) => {
    const freq = String(evento?.metadata?.recorrencia || 'nenhuma').toLowerCase();
    if (freq === 'nenhuma' || !freq) {
      return [normalizeOperationalEvent(evento, lotesMap, funcionariosMap)];
    }

    const dataInicioStr = String(evento?.data_inicio || evento?.data || '').slice(0, 10);
    const inicio = dataInicioStr ? new Date(`${dataInicioStr}T00:00:00`) : start;
    const from = inicio > start ? inicio : start;
    const eventosGerados = [];

    for (let cursor = new Date(from); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      if (matchesEventoRecurrence(evento, cursor)) {
        eventosGerados.push(normalizeOperationalEvent(evento, lotesMap, funcionariosMap, cursor.toISOString().slice(0, 10)));
      }
    }

    return eventosGerados;
  });
}

function normalizeSanitaryEvent(event, lotesMap, funcionariosMap) {
  const lote = event?.lote_id ? lotesMap.get(Number(event.lote_id)) : null;
  const responsavel = event?.funcionario_responsavel_id ? funcionariosMap.get(Number(event.funcionario_responsavel_id)) : null;
  const data = String(event.proxima || event.data_aplic || '').slice(0, 10);

  return {
    id: event.id,
    source: 'sanitario',
    type: event.tipo || 'sanitario',
    data,
    title: event.desc || 'Manejo sanitario',
    description: [lote?.nome || 'Geral', event.obs || null].filter(Boolean).join(' · '),
    metaLine: responsavel?.nome || 'Agenda sanitária',
  };
}

function normalizePesagemEvent(event, lotesMap) {
  const lote = event?.lote_id ? lotesMap.get(Number(event.lote_id)) : null;

  return {
    id: event.id,
    source: 'pesagem',
    type: 'pesagem',
    data: String(event.data || '').slice(0, 10),
    title: `Pesagem${lote?.nome ? ` - ${lote.nome}` : ''}`,
    description: event.observacao || 'Acompanhamento de peso registrado no sistema.',
    metaLine: lote?.nome || 'Pesagem operacional',
  };
}

function normalizeSaidaEvent(lote) {
  const data = String(lote.data_saida || lote.saida || '').slice(0, 10);

  return {
    id: lote.id,
    source: 'saida',
    type: 'saida',
    data,
    title: `Saída prevista - ${lote.nome}`,
    description: lote.status === 'vendido' ? 'Lote ja vendido' : 'Planejamento de saida do lote',
    metaLine: lote.nome,
  };
}

function getEventTone(events) {
  if (!events.length) {
    return 'neutral';
  }
  if (events.some((event) => event.source === 'sanitario')) {
    return 'info';
  }
  if (events.some((event) => event.type === 'saida')) {
    return 'danger';
  }
  if (events.some((event) => event.type === 'pesagem')) {
    return 'success';
  }
  return 'warning';
}

function expandRecurringRotinas(rotinas, lotesMap, funcionariosMap) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 13, 0);

  return rotinas.flatMap((rotina) => {
    if (!rotina?.recorrente) {
      return rotina?.data ? [normalizeRotinaEvent(rotina, rotina.data, lotesMap, funcionariosMap)] : [];
    }

    const inicio = rotina?.data_inicio ? new Date(`${rotina.data_inicio}T00:00:00`) : start;
    const termino = rotina?.data_fim ? new Date(`${rotina.data_fim}T00:00:00`) : end;
    const from = inicio > start ? inicio : start;
    const to = termino < end ? termino : end;
    const eventos = [];

    for (let cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
      if (matchesRotinaRecurrence(rotina, cursor)) {
        eventos.push(normalizeRotinaEvent(rotina, cursor.toISOString().slice(0, 10), lotesMap, funcionariosMap));
      }
    }

    return eventos;
  });
}

function normalizeRotinaEvent(rotina, data, lotesMap, funcionariosMap) {
  const lote = rotina?.lote_id ? lotesMap.get(Number(rotina.lote_id)) : null;
  const responsavel = rotina?.funcionario_id ? funcionariosMap.get(Number(rotina.funcionario_id)) : null;

  return {
    id: `rotina-${rotina.id}-${data}`,
    source: 'rotina',
    type: 'operacional',
    data: String(data || '').slice(0, 10),
    title: rotina?.tarefa || 'Rotina operacional',
    description: [rotina?.setor || 'Operacao', lote?.nome || null].filter(Boolean).join(' · '),
    metaLine: responsavel?.nome || 'Rotina automática',
  };
}
