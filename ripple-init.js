// ============================================
// INICIALIZADOR DO EFEITO RIPPLE
// ============================================
// Este arquivo aplica automaticamente o efeito ripple a todos os
// elementos interativos comuns do site (botões, ícones, etc.)
//
// Ele também observa quando novos elementos são adicionados à página
// dinamicamente e aplica o efeito a eles também.
// ============================================

(function(){
    'use strict';

    /**
     * Espera a função anexarRippleA (ou attachRippleTo) estar disponível antes de executar
     * Isso é necessário porque os arquivos podem carregar em ordem diferente
     * 
     * @param {Function} funcao - Função a ser executada quando anexarRippleA estiver pronta
     */
    function esperarEExecutar(funcao) {
        // Verifica se a função está disponível (pode ter nome em português ou inglês)
        const funcaoRipple = typeof anexarRippleA === 'function' ? anexarRippleA : 
                            (typeof attachRippleTo === 'function' ? attachRippleTo : null);
        
        // Se a função já está disponível, executa imediatamente
        if (funcaoRipple) {
            return funcao();
        }
        
        // Se não está disponível, tenta novamente a cada 80 milissegundos
        let tentativas = 0;
        const intervalo = setInterval(function() {
            tentativas++;
            
            // Verifica novamente se a função está disponível
            const funcaoRipple = typeof anexarRippleA === 'function' ? anexarRippleA : 
                                (typeof attachRippleTo === 'function' ? attachRippleTo : null);
            
            // Se agora está disponível, executa e para de tentar
            if (funcaoRipple) {
                clearInterval(intervalo);  // Para o intervalo
                funcao();                  // Executa a função
            } 
            // Se tentou mais de 10 vezes (800ms), desiste
            else if (tentativas > 10) {
                clearInterval(intervalo);
                console.debug('ripple-init: anexarRippleA/attachRippleTo não encontrada — desistindo');
            }
        }, 80);
    }

    // Lista de seletores CSS que devem ter o efeito ripple
    // Esses são os elementos interativos comuns em todo o site
    const SELETORES_COMUNS = [
        '.app-icon',              // Ícones dos apps na tela inicial
        '.lang-btn',              // Botões de idioma
        '.btn-idioma',            // Botões de idioma (nome alternativo)
        '.home-button-fixed',     // Botão fixo para voltar ao início
        '.arrow-btn',             // Botões de seta (+ e -)
        'input[type="range"]',    // Sliders (barras deslizantes)
        '.btn-acao',              // Botões de ação genéricos
        '.btn-help',              // Botões de ajuda
        '.btn-voltar-exemplo',    // Botões para voltar dos exemplos
        '.btn-fechar-exemplos',   // Botões para fechar exemplos
        '.icone-info',            // Ícones de informação
        '.card-header-clicavel'   // Cabeçalhos de cards clicáveis
    ];

    /**
     * Inicializa o efeito ripple em todos os elementos comuns
     * e observa novos elementos adicionados dinamicamente
     */
    function inicializarRipples() {
        // Pega a função disponível (pode ser anexarRippleA ou attachRippleTo)
        const funcaoRipple = typeof anexarRippleA === 'function' ? anexarRippleA : attachRippleTo;
        
        // Aplica o efeito a todos os seletores comuns que já existem na página
        SELETORES_COMUNS.forEach(function(seletor) {
            try {
                // Tenta anexar o efeito usando a função disponível
                funcaoRipple(seletor);
            } catch (erro) {
                // Se der erro, apenas avisa no console mas não quebra o código
                console.warn('ripple-init: falha ao anexar em', seletor, erro);
            }
        });

        // Cria um "observador" que fica de olho em mudanças na página
        // Quando novos elementos são adicionados, aplica o efeito a eles também
        const observador = new MutationObserver(function(mudancas) {
            // Pega a função disponível (pode ser anexarRippleA ou attachRippleTo)
            const funcaoRipple = typeof anexarRippleA === 'function' ? anexarRippleA : attachRippleTo;
            
            // Para cada mudança detectada
            mudancas.forEach(function(mudanca) {
                // Se não adicionou nenhum nó, ignora
                if (!mudanca.addedNodes || mudanca.addedNodes.length === 0) return;
                
                // Para cada novo nó adicionado
                mudanca.addedNodes.forEach(function(no) {
                    // Se não é um elemento HTML, ignora (pode ser texto, comentário, etc.)
                    if (no.nodeType !== Node.ELEMENT_NODE) return;
                    
                    // Verifica se o novo elemento corresponde a algum seletor comum
                    SELETORES_COMUNS.forEach(function(seletor) {
                        // Se o elemento corresponde ao seletor
                        if (no.matches && no.matches(seletor)) {
                            try { 
                                funcaoRipple(seletor); 
                            } catch(e) {
                                // Ignora erros silenciosamente
                            }
                        }
                        
                        // Também verifica elementos filhos (descendentes)
                        // Por exemplo, se adicionar um <div> que contém um botão
                        if (no.querySelectorAll) {
                            no.querySelectorAll(seletor).forEach(function(elemento) {
                                try { 
                                    funcaoRipple(seletor); 
                                } catch(e) {
                                    // Ignora erros silenciosamente
                                }
                            });
                        }
                    });
                });
            });
        });

        // Começa a observar mudanças no documento
        // childList: true = observa quando elementos filhos são adicionados/removidos
        // subtree: true = observa também elementos dentro dos elementos (aninhados)
        observador.observe(document.documentElement || document.body, { 
            childList: true,   // Observa adição/remoção de elementos filhos
            subtree: true      // Observa também elementos aninhados
        });
    }

    // Espera a função estar disponível e então inicializa
    esperarEExecutar(inicializarRipples);
})();
