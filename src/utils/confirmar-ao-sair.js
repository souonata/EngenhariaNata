/**
 * Papel no projeto:
 * - Confirma o valor digitado num campo numérico quando o usuário SAI dele sem
 *   apertar Enter: toque/clique fora e rolagem no celular.
 *
 * Por que existe: com a saída dos botões +/− ao lado dos sliders, digitar virou
 * o caminho principal. No celular o `blur` não dispara sozinho quando se toca
 * fora ou se rola a página, então o número aparecia na tela sem entrar no
 * cálculo. Aqui o `blur()` é forçado; cada app continua confirmando no seu
 * próprio handler de blur, como já fazia.
 *
 * Pontos seguros para IA editar:
 * - quais elementos contam como campo numérico;
 * - quais gestos disparam a confirmação.
 *
 * Cuidados antes de mexer:
 * - o handler de Enter só age se o foco AINDA estiver no campo: apps com Enter
 *   cíclico (mutuo) movem o foco antes, e blurar ali apagaria o foco novo;
 * - o listener de `pointerdown` é de captura, para confirmar antes de o alvo
 *   reagir ao toque.
 */

/** Um campo que representa valor numérico editável. */
export function ehCampoNumerico(elemento) {
    if (!elemento || elemento.tagName !== 'INPUT') return false;
    return elemento.classList.contains('valor-input') || elemento.type === 'number';
}

/**
 * @param {Document} documento
 * @param {Window} janela
 * @returns {() => void} função para desligar os listeners (usada em teste).
 */
export function configurarConfirmacaoAoSair(documento = document, janela = window) {
    const confirmarCampoAtivo = () => {
        const ativo = documento.activeElement;
        if (ehCampoNumerico(ativo)) ativo.blur();
    };

    const aoTocarFora = (evento) => {
        const ativo = documento.activeElement;
        if (ehCampoNumerico(ativo) && evento.target !== ativo) {
            ativo.blur();
        }
    };

    const aoTeclar = (evento) => {
        if (evento.key !== 'Enter') return;
        const alvo = evento.target;
        if (ehCampoNumerico(alvo) && documento.activeElement === alvo) {
            alvo.blur();
        }
    };

    documento.addEventListener('pointerdown', aoTocarFora, true);
    documento.addEventListener('keydown', aoTeclar);

    // Rolagem só confirma em tela de toque: no desktop girar a roda do mouse
    // durante a digitação não deveria encerrar a edição.
    const ehTelaDeToque = typeof janela.matchMedia === 'function'
        && janela.matchMedia('(pointer: coarse)').matches;

    if (ehTelaDeToque) {
        janela.addEventListener('scroll', confirmarCampoAtivo, { passive: true, capture: true });
    }

    return () => {
        documento.removeEventListener('pointerdown', aoTocarFora, true);
        documento.removeEventListener('keydown', aoTeclar);
        if (ehTelaDeToque) {
            janela.removeEventListener('scroll', confirmarCampoAtivo, { capture: true });
        }
    };
}
