// ============================================
// EFEITO RIPPLE (ONDULAÇÃO AO TOCAR)
// ============================================
// Este arquivo cria um efeito visual de "ondulação" quando o usuário
// clica ou toca em botões e elementos interativos, similar ao que
// acontece em apps móveis modernos.
//
// Como funciona:
// 1. Quando você toca/clica em um elemento, cria-se um círculo que
//    se expande a partir do ponto de toque
// 2. O círculo desaparece automaticamente após 0.7 segundos
// 3. Isso dá feedback visual ao usuário de que a ação foi registrada
// ============================================

// Função isolada para não poluir o escopo global
(function(global){
    'use strict';

    /**
     * Adiciona o efeito ripple a elementos que correspondem ao seletor CSS
     * 
     * @param {string} seletor - Seletor CSS (ex: '.botao', '#meuBotao')
     * 
     * Exemplo de uso:
     *   anexarRippleA('.botao');  // Adiciona efeito a todos os elementos com classe "botao"
     */
    function anexarRippleA(seletor) {
        // Busca todos os elementos que correspondem ao seletor
        const elementos = document.querySelectorAll(seletor);
        
        // Para cada elemento encontrado
        elementos.forEach(elemento => {
            // Se já tem o efeito anexado, pula (evita duplicar)
            if (elemento.__rippleAnexado) return;
            
            // Marca como já anexado
            elemento.__rippleAnexado = true;

            // Adiciona um "ouvinte" de evento: quando o usuário toca/clica
            elemento.addEventListener('pointerdown', function(evento) {
                // Pega a posição e tamanho do elemento na tela
                const posicao = elemento.getBoundingClientRect();
                
                // Cria um novo elemento <span> para ser o efeito ripple
                const efeitoRipple = document.createElement('span');
                efeitoRipple.className = 'ripple';  // Adiciona a classe CSS

                // Calcula onde o usuário tocou, relativo ao elemento
                // ev.clientX = posição X do toque na tela
                // posicao.left = posição X do elemento na tela
                // Subtraindo, temos a posição relativa ao elemento
                let posicaoX = evento.clientX - posicao.left;
                let posicaoY = evento.clientY - posicao.top;
                
                // Se não conseguiu calcular (ex: ativado por teclado),
                // usa o centro do elemento
                if (isNaN(posicaoX) || isNaN(posicaoY)) {
                    posicaoX = posicao.width / 2;   // Centro horizontal
                    posicaoY = posicao.height / 2;  // Centro vertical
                }

                // Calcula o tamanho do efeito: 90% do maior lado do elemento
                const tamanho = Math.max(posicao.width, posicao.height) * 0.9;
                
                // Define o tamanho do círculo
                efeitoRipple.style.width = tamanho + 'px';
                efeitoRipple.style.height = tamanho + 'px';
                
                // Posiciona o círculo centralizado no ponto de toque
                // Subtrai metade do tamanho para centralizar
                efeitoRipple.style.left = (posicaoX - tamanho/2) + 'px';
                efeitoRipple.style.top = (posicaoY - tamanho/2) + 'px';

                // Adiciona o efeito dentro do elemento
                elemento.appendChild(efeitoRipple);
                
                // Remove o efeito automaticamente após 700 milissegundos (0.7 segundos)
                window.setTimeout(function() {
                    // Verifica se o elemento ainda existe antes de remover
                    if (efeitoRipple && efeitoRipple.parentNode) {
                        efeitoRipple.remove();
                    }
                }, 700);
            }, {passive: true});  // passive: true = não bloqueia a rolagem da página
        });
    }

    // Torna a função disponível globalmente com ambos os nomes
    // Nome em português (novo): anexarRippleA
    global.anexarRippleA = anexarRippleA;
    
    // Nome em inglês (original): attachRippleTo (mantido para compatibilidade)
    global.attachRippleTo = anexarRippleA;

})(window);
