import { Activity } from 'lucide-react';

/**
 * Mostra o score de saúde do lote (0-100) calculado por
 * `src/domain/saudeLote.js` (Sprint 3). Não calcula nada — só exibe o
 * resultado de `calcularSaudeLote`/`listarSaudeLotes`.
 *
 * `compact`: versão reduzida (score + classificação), usada no card do lote
 * na listagem. Versão completa (com as explicações) é usada na tela de
 * detalhes do lote e em "Decisões da Fazenda".
 */
export default function SaudeLoteCard({ saude, compact = false, titulo = 'Saúde do lote' }) {
  if (!saude) return null;

  if (saude.dadosInsuficientes) {
    return (
      <div className={`saude-lote saude-lote--indisponivel ${compact ? 'saude-lote--compact' : ''}`}>
        <div className="saude-lote__cabecalho">
          <Activity size={compact ? 14 : 16} aria-hidden="true" />
          <strong>{titulo}: dados insuficientes</strong>
        </div>
        {!compact ? (
          <p className="saude-lote__mensagem">
            {saude.mensagem || 'Ainda não há dados suficientes para avaliar a saúde deste lote.'}
            {' '}Cadastre pesagens, animais, tarefas, sanidade ou custos vinculados a este lote.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`saude-lote saude-lote--${saude.classificacao} ${compact ? 'saude-lote--compact' : ''}`}>
      <div className="saude-lote__cabecalho">
        <HeartPulse size={compact ? 14 : 16} aria-hidden="true" />
        <strong>{titulo}: {saude.score}/100</strong>
        <span className="saude-lote__badge">{saude.classificacaoLabel}</span>
      </div>

      {!compact ? (
        <>
          {saude.confiabilidade === 'baixa' && saude.mensagem ? (
            <p className="saude-lote__aviso">{saude.mensagem}</p>
          ) : null}
          {saude.explicacoes.length > 0 ? (
            <ul className="saude-lote__explicacoes">
              {saude.explicacoes.map((linha) => (
                <li key={linha}>{linha}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
