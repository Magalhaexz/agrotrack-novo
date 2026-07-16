// Tolerância a erro de digitação (seção 9 do spec do bot operacional). Puro,
// sem I/O. Corrige uma palavra do texto para a palavra-chave conhecida mais
// próxima — SÓ quando a distância é pequena o bastante para ser
// inequívoca. Nunca aplicado a valores financeiros, quantidades, datas ou
// IDs (isso é decidido por quem chama: `deveIgnorarToleranciaTelegram`
// filtra tokens que parecem número/data antes de tentar corrigir).
function distanciaLevenshtein(a, b) {
  const s = String(a || '');
  const t = String(b || '');
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let anterior = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    const atual = [i];
    for (let j = 1; j <= n; j += 1) {
      const custo = s[i - 1] === t[j - 1] ? 0 : 1;
      atual[j] = Math.min(
        atual[j - 1] + 1, // inserção
        anterior[j] + 1, // remoção
        anterior[j - 1] + custo, // substituição
      );
    }
    anterior = atual;
  }
  return anterior[n];
}

export { distanciaLevenshtein };

/** Limiar de distância aceitável — mais generoso para palavras longas. */
function limiarPara(tamanho) {
  if (tamanho <= 4) return 1;
  if (tamanho <= 8) return 2;
  return 3;
}

/**
 * Nunca corrige: números puros, valores com "R$"/"reais", datas (dd/mm ou
 * dd/mm/aaaa), e tokens muito curtos (ambíguos demais para corrigir com
 * segurança).
 */
function pareceValorOuData(palavra) {
  if (/^\d+([.,]\d+)?$/.test(palavra)) return true;
  if (/\d/.test(palavra)) return true; // qualquer dígito misturado — não mexe
  if (palavra.length <= 2) return true;
  return false;
}

/**
 * Tenta corrigir UMA palavra para a mais próxima do dicionário conhecido.
 * @returns {{ corrigida: string, original: string } | null} null quando a palavra
 *   já é conhecida, parece valor/data, ou nenhuma candidata está perto o
 *   bastante (correção incerta — melhor não adivinhar).
 */
export function corrigirPalavra(palavra, dicionario) {
  const p = String(palavra || '').toLowerCase();
  if (!p || pareceValorOuData(p)) return null;
  if (dicionario.includes(p)) return null; // já é uma palavra conhecida

  let melhor = null;
  let melhorDistancia = Infinity;
  for (const candidata of dicionario) {
    // só compara com palavras de tamanho parecido — corrigir "sal" (3) para
    // "sanitario" (9) não faz sentido mesmo com poucos erros de digitação
    if (Math.abs(candidata.length - p.length) > 3) continue;
    const d = distanciaLevenshtein(p, candidata);
    if (d < melhorDistancia) { melhorDistancia = d; melhor = candidata; }
  }
  if (!melhor) return null;
  if (melhorDistancia === 0) return null; // já bateu exato (não deveria chegar aqui)
  if (melhorDistancia > limiarPara(p.length)) return null;
  return { corrigida: melhor, original: p };
}

/**
 * Aplica tolerância a cada palavra do texto contra o dicionário. Devolve o
 * texto corrigido e a lista de correções feitas — quando a lista não está
 * vazia, quem chama deve pedir confirmação ("Você quis dizer X?") em vez de
 * assumir a correção silenciosamente (regra explícita da seção 9).
 *
 * Nunca corrige uma palavra que comece com maiúscula NO MEIO da frase — é o
 * sinal mais simples e confiável de nome próprio (lote/fazenda/produto,
 * ex.: "Recria", "Boa Vista"), que jamais deve ser trocado por uma
 * palavra-chave só porque a distância de edição é pequena. Por isso esta
 * função precisa receber o texto com a CAPITALIZAÇÃO ORIGINAL preservada —
 * chame antes de qualquer normalização para minúsculas.
 */
export function aplicarToleranciaTelegram(texto, dicionario) {
  const palavras = String(texto || '').split(/(\s+)/); // mantém os espaços para remontar
  const correcoes = [];
  let indicePalavra = -1;
  const corrigidas = palavras.map((token) => {
    if (/^\s+$/.test(token) || !token) return token;
    indicePalavra += 1;
    // Maiúscula no meio da frase (não na primeira palavra, que só está
    // maiúscula por estar no início) → provável nome próprio, não mexe.
    const pareceNomeProprio = indicePalavra > 0 && /^[A-ZÀ-Ý]/.test(token);
    if (pareceNomeProprio) return token;
    const r = corrigirPalavra(token, dicionario);
    if (!r) return token;
    correcoes.push(r);
    return r.corrigida;
  });
  return { texto: corrigidas.join(''), correcoes };
}
