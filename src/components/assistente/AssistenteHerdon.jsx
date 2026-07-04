import { useMemo, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import {
  listarPerguntasAssistente,
  responderPerguntaHerdon,
  avaliarProntidaoAssistente,
} from '../../domain/respostasAssistente';
import '../../styles/assistente.css';

// Rótulo/cor de badge por severidade — mesma paleta usada em
// DecisoesFazendaPage.jsx; puramente apresentação, não recalcula nada.
const SEVERIDADE_BADGE = { critico: 'danger', alto: 'warning', medio: 'info', baixo: 'neutral' };
const SEVERIDADE_LABEL = { critico: 'Crítico', alto: 'Alto', medio: 'Médio', baixo: 'Baixo' };

/**
 * Painel de perguntas prontas do Assistente HERDON (Sprint 5). Não usa IA
 * externa: toda resposta vem de `src/domain/respostasAssistente.js`, que só
 * lê e traduz o que os motores de alertas/saúde/relatório já calculam.
 * Sem entrada de texto livre por enquanto — só perguntas pré-definidas.
 */
export default function AssistenteHerdon({ db = {}, onNavigate = null, className = '' }) {
  const [open, setOpen] = useState(false);
  const [perguntaId, setPerguntaId] = useState(null);
  const [loteId, setLoteId] = useState('');

  const prontidao = useMemo(() => avaliarProntidaoAssistente(db), [db]);
  const perguntas = useMemo(() => listarPerguntasAssistente(db), [db]);
  const lotesAtivos = useMemo(
    () => (Array.isArray(db?.lotes) ? db.lotes.filter((lote) => lote?.status === 'ativo') : []),
    [db]
  );

  const resposta = useMemo(() => {
    if (!perguntaId) return null;
    const options = perguntaId === 'vale_a_pena_lote' && loteId ? { loteId } : {};
    return responderPerguntaHerdon(db, perguntaId, options);
  }, [db, perguntaId, loteId]);

  function fechar() {
    setOpen(false);
    setPerguntaId(null);
    setLoteId('');
  }

  function selecionarPergunta(id) {
    setPerguntaId(id);
    if (id === 'vale_a_pena_lote' && !loteId && lotesAtivos.length > 0) {
      setLoteId(String(lotesAtivos[0].id));
    }
  }

  function irPara(link) {
    onNavigate?.(link.page, link.intent || null);
    fechar();
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        icon={<MessageCircle size={16} />}
        className={`assistente-herdon-trigger ${className}`.trim()}
        onClick={() => setOpen(true)}
      >
        Perguntar ao HERDON
      </Button>

      <Modal
        open={open}
        onClose={fechar}
        title="Assistente HERDON"
        subtitle="Pergunte sobre desempenho, custos, estoque e próximos passos."
        size="lg"
      >
        <div className="assistente-herdon">
          {!prontidao.pronto ? (
            <div className="assistente-herdon__vazio">
              <p>O HERDON ainda precisa de dados para responder melhor.</p>
              <ul>
                {prontidao.pendencias.map((item) => (
                  <li key={item.chave} className={item.feito ? 'is-feito' : ''}>
                    <button
                      type="button"
                      className="assistente-herdon__link"
                      onClick={() => irPara({ page: item.pagina })}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <div className="assistente-herdon__perguntas">
                {perguntas.map((pergunta) => (
                  <button
                    key={pergunta.id}
                    type="button"
                    className={`assistente-herdon__chip ${perguntaId === pergunta.id ? 'is-ativo' : ''}`}
                    onClick={() => selecionarPergunta(pergunta.id)}
                  >
                    {pergunta.titulo}
                  </button>
                ))}
              </div>

              {perguntaId === 'vale_a_pena_lote' && lotesAtivos.length > 1 ? (
                <select
                  className="ui-input assistente-herdon__seletor-lote"
                  value={loteId}
                  onChange={(e) => setLoteId(e.target.value)}
                >
                  {lotesAtivos.map((lote) => (
                    <option key={lote.id} value={lote.id}>{lote.nome}</option>
                  ))}
                </select>
              ) : null}

              {resposta ? (
                <div className="assistente-herdon__resposta">
                  <div className="assistente-herdon__resposta-cabecalho">
                    <strong>{resposta.titulo}</strong>
                    {resposta.severidade ? (
                      <Badge variant={SEVERIDADE_BADGE[resposta.severidade]}>{SEVERIDADE_LABEL[resposta.severidade]}</Badge>
                    ) : null}
                  </div>

                  <p className="assistente-herdon__texto">{resposta.resposta}</p>

                  {resposta.evidencias.length > 0 ? (
                    <div className="assistente-herdon__secao">
                      <span className="assistente-herdon__secao-titulo">Por que o HERDON recomenda isso?</span>
                      <ul>
                        {resposta.evidencias.map((evidencia) => <li key={evidencia}>{evidencia}</li>)}
                      </ul>
                    </div>
                  ) : null}

                  {resposta.acoesSugeridas.length > 0 ? (
                    <div className="assistente-herdon__secao">
                      <span className="assistente-herdon__secao-titulo">Próxima ação</span>
                      <ul>
                        {resposta.acoesSugeridas.map((acao) => <li key={acao}>{acao}</li>)}
                      </ul>
                    </div>
                  ) : null}

                  {resposta.links.length > 0 ? (
                    <div className="assistente-herdon__acoes">
                      {resposta.links.map((link) => (
                        <Button key={`${link.page}-${link.label}`} variant="ghost" size="sm" onClick={() => irPara(link)}>
                          {link.label}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="assistente-herdon__dica">Escolha uma pergunta acima para ver a resposta.</p>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
