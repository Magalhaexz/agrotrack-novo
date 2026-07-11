// Trava de submissão para evitar cadastro duplicado (bug 7.2/7.3). Puro, sem
// React: garante que uma ação assíncrona não roda de novo enquanto a anterior
// ainda está em andamento — protege contra duplo clique e reenvio, mesmo antes
// de qualquer re-render. O hook useSubmitOnce só adiciona o estado visual.
export function criarTravaSubmissao() {
  let ocupado = false;
  return {
    estaOcupado: () => ocupado,
    /**
     * Executa `action` uma única vez por vez. Chamadas concorrentes retornam
     * `{ ignorado: true }` sem reexecutar. Libera a trava mesmo em erro.
     */
    async executar(action) {
      if (ocupado) return { ignorado: true, resultado: undefined };
      ocupado = true;
      try {
        return { ignorado: false, resultado: await action() };
      } finally {
        ocupado = false;
      }
    },
  };
}
