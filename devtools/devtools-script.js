// ============================================
// DEVTOOLS - App de Desenvolvimento
// ============================================

// Estado da aplicação (usando var para compatibilidade)
var currentApp = 'index.html';
var inspectorMode = false;
var originalHTML = '';
var originalCSS = '';
var originalJS = '';
var currentAppPath = ''; // Caminho completo do app atual (incluindo file:// se aplicável)
var currentTab = 'html';
var selectedElement = null;
var wordHighlights = [];

// Elementos DOM (com verificação de existência para compatibilidade)
var previewFrame = null;
var appSelector = null;
var btnServer = null;
var btnReload = null;
var btnToggleInspector = null;
var btnFullscreenPreview = null;
var btnFormat = null;
var btnClear = null;
var serverModal = null;
var btnCloseServerModal = null;
var fileProtocolBanner = null;
var btnOpenServerFromBanner = null;
var btnDismissBanner = null;
var tabButtons = null;
var editorHTML = null;
var editorCSS = null;
var editorJS = null;
var previewContent = null;
var previewPanel = null;

// Função para inicializar elementos DOM de forma segura
function initializeDOMElements() {
    previewFrame = document.getElementById('previewFrame');
    appSelector = document.getElementById('appSelector');
    btnServer = document.getElementById('btnServer');
    btnReload = document.getElementById('btnReload');
    btnToggleInspector = document.getElementById('btnToggleInspector');
    btnFullscreenPreview = document.getElementById('btnFullscreenPreview');
    btnFormat = document.getElementById('btnFormat');
    btnClear = document.getElementById('btnClear');
    serverModal = document.getElementById('serverModal');
    btnCloseServerModal = document.getElementById('btnCloseServerModal');
    fileProtocolBanner = document.getElementById('fileProtocolBanner');
    btnOpenServerFromBanner = document.getElementById('btnOpenServerFromBanner');
    btnDismissBanner = document.getElementById('btnDismissBanner');
    tabButtons = document.querySelectorAll('.tab-btn');
    editorHTML = document.getElementById('editorHTML');
    editorCSS = document.getElementById('editorCSS');
    editorJS = document.getElementById('editorJS');
    previewContent = document.querySelector('.preview-content');
    previewPanel = document.querySelector('.preview-panel');
    
    // Verificar se todos os elementos essenciais existem
    if (!previewFrame || !appSelector || !editorHTML || !editorCSS || !editorJS) {
        console.error('Elementos DOM essenciais não encontrados');
        return false;
    }
    return true;
}

// Inicialização com suporte para navegadores antigos
function initDevTools() {
    if (!initializeDOMElements()) {
        console.error('Falha ao inicializar elementos DOM');
        return;
    }
    
    // Verificar se está em file:// e mostrar banner
    checkFileProtocol();
    
    initializeApp();
    setupEventListeners();
    loadApp(currentApp);
    setupOrientationHandler();
    setupTouchOptimizations();
}

// Verificar protocolo file:// e mostrar banner
function checkFileProtocol() {
    var isLocalFile = window.location.protocol === 'file:';
    
    if (isLocalFile && fileProtocolBanner) {
        // Verificar se o usuário já dispensou o banner
        try {
            var bannerDismissed = localStorage.getItem('devtools-banner-dismissed');
            if (!bannerDismissed) {
                fileProtocolBanner.style.display = 'flex';
                
                // Abrir modal automaticamente após 2 segundos (apenas na primeira vez)
                var autoOpenModal = localStorage.getItem('devtools-auto-open-modal');
                if (!autoOpenModal) {
                    setTimeout(function() {
                        openServerModal();
                        localStorage.setItem('devtools-auto-open-modal', 'true');
                    }, 2000);
                }
            }
        } catch (e) {
            // Se localStorage não estiver disponível, mostrar banner mesmo assim
            fileProtocolBanner.style.display = 'flex';
        }
    }
}

// Suporte para diferentes eventos de carregamento
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDevTools);
} else {
    // DOM já carregado
    initDevTools();
}

// Inicializar aplicação
function initializeApp() {
    // Carregar último app usado (se houver)
    try {
        if (typeof Storage !== 'undefined' && localStorage) {
            var lastApp = localStorage.getItem('devtools-last-app');
            if (lastApp && appSelector) {
                currentApp = lastApp;
                appSelector.value = lastApp;
            }
        }
    } catch (err) {
        console.warn('localStorage não disponível:', err);
    }
}

// Configurar handler de orientação
function setupOrientationHandler() {
    var orientationHandler = function() {
        // Forçar recálculo de layout após mudança de orientação
        setTimeout(function() {
            if (previewFrame && previewFrame.contentWindow) {
                try {
                    if (previewFrame.contentWindow.dispatchEvent) {
                        var resizeEvent = new Event('resize');
                        previewFrame.contentWindow.dispatchEvent(resizeEvent);
                    }
                } catch (e) {
                    // Ignorar erros de CORS
                }
            }
            // Ajustar altura do container
            if (previewPanel && previewContent) {
                previewContent.style.height = '';
            }
        }, 100);
    };
    
    // Suporte para diferentes eventos de orientação
    if (window.addEventListener) {
        window.addEventListener('orientationchange', orientationHandler);
        window.addEventListener('resize', function() {
            // Debounce para evitar muitas chamadas
            if (window.orientationResizeTimeout) {
                clearTimeout(window.orientationResizeTimeout);
            }
            window.orientationResizeTimeout = setTimeout(orientationHandler, 250);
        });
    }
}

// Otimizações para dispositivos touch
function setupTouchOptimizations() {
    // Prevenir zoom em double-tap
    var lastTouchEnd = 0;
    if (document.addEventListener) {
        document.addEventListener('touchend', function(e) {
            var now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
    }
    
    // Melhorar scroll em iOS
    if (previewContent) {
        previewContent.style.webkitOverflowScrolling = 'touch';
    }
    
    // Melhorar scroll nos editores
    if (editorHTML) {
        editorHTML.style.webkitOverflowScrolling = 'touch';
    }
    if (editorCSS) {
        editorCSS.style.webkitOverflowScrolling = 'touch';
    }
    if (editorJS) {
        editorJS.style.webkitOverflowScrolling = 'touch';
    }
}

// ============================================
// GERENCIAMENTO DE SERVIDOR LOCAL
// ============================================

// Abrir modal de servidor
function openServerModal() {
    if (!serverModal) return;
    serverModal.style.display = 'flex';
    checkServerAvailability();
    setupServerModalListeners();
}

// Fechar modal de servidor
function closeServerModal() {
    if (!serverModal) return;
    serverModal.style.display = 'none';
}

// Verificar disponibilidade de servidores
function checkServerAvailability() {
    // Apenas verificar status do servidor virtual (sempre disponível)
    var statusEl = document.getElementById('jsServerStatus');
    if (statusEl) {
        statusEl.textContent = 'Sempre Disponível';
        statusEl.className = 'server-status available';
    }
}

// Configurar listeners do modal de servidor
function setupServerModalListeners() {
    // Botão de iniciar servidor virtual - usar setTimeout para garantir que o DOM está pronto
    setTimeout(function() {
        var executeButtons = document.querySelectorAll('.btn-open-terminal[data-type="js-virtual"]');
        for (var i = 0; i < executeButtons.length; i++) {
            (function(btn) {
                // Remover listeners anteriores
                var newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                
                newBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Botão clicado - iniciando servidor virtual');
                    startVirtualServer();
                    return false;
                });
            })(executeButtons[i]);
        }
        
        // Também adicionar listener direto no modal se o botão existir
        if (serverModal) {
            var modalBtn = serverModal.querySelector('.btn-open-terminal[data-type="js-virtual"]');
            if (modalBtn && !modalBtn.hasAttribute('data-listener-added')) {
                modalBtn.setAttribute('data-listener-added', 'true');
                modalBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Botão do modal clicado - iniciando servidor virtual');
                    startVirtualServer();
                    return false;
                });
            }
        }
    }, 100);
}

// Copiar comando do servidor
function copyServerCommand(commandType, button) {
    var commandEl = null;
    var command = '';
    
    if (commandType === 'node') {
        commandEl = document.getElementById('nodeCommand');
        command = 'npx serve';
    }
    
    if (!command) return;
    
    // Copiar para clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(command).then(function() {
            showCopyFeedback(button);
        }).catch(function(err) {
            console.error('Erro ao copiar:', err);
            fallbackCopy(command, button);
        });
    } else {
        fallbackCopy(command, button);
    }
}

// Fallback para copiar (navegadores antigos)
function fallbackCopy(text, button) {
    var textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
        document.execCommand('copy');
        showCopyFeedback(button);
    } catch (err) {
        console.error('Erro ao copiar:', err);
        alert('Erro ao copiar. O comando é: ' + text);
    }
    
    document.body.removeChild(textArea);
}

// Mostrar feedback de cópia
function showCopyFeedback(button) {
    var originalText = button.textContent;
    button.textContent = '✓ Copiado!';
    button.classList.add('copied');
    
    setTimeout(function() {
        button.textContent = originalText;
        button.classList.remove('copied');
    }, 2000);
}

// Executar comando do servidor (mantido para compatibilidade, mas não usado mais)
function executeServerCommand(serverType) {
    if (serverType === 'js-virtual') {
        // Iniciar servidor virtual JavaScript
        startVirtualServer();
    }
}

// Obter caminho do projeto
function getProjectPath() {
    try {
        var currentPath = window.location.pathname;
        if (currentPath.indexOf('/devtools/') !== -1) {
            var projectPath = currentPath.substring(0, currentPath.indexOf('/devtools/'));
            // Converter para caminho Windows se necessário
            if (window.location.protocol === 'file:') {
                var fullPath = window.location.href.replace('file:///', '').replace(/\//g, '\\');
                var projectFullPath = fullPath.substring(0, fullPath.indexOf('\\devtools\\'));
                return projectFullPath;
            }
            return projectPath;
        }
        return window.location.pathname;
    } catch (e) {
        return 'C:\\Users\\abros\\OneDrive\\Documentos\\Meus Programas\\EngenhariaNata';
    }
}

// Mostrar modal com instruções detalhadas
function showServerInstructionsModal(serverType, instructions, command, installInstructions) {
    // Criar modal
    var modal = document.createElement('div');
    modal.className = 'server-instructions-modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 20000; display: flex; align-items: center; justify-content: center; padding: 20px;';
    
    var content = document.createElement('div');
    content.className = 'server-instructions-content';
    content.style.cssText = 'background: var(--devtools-panel-bg); border: 1px solid var(--devtools-border); border-radius: 8px; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 20px; position: relative;';
    
    var closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = 'position: absolute; top: 10px; right: 10px; background: transparent; border: none; color: var(--devtools-text); font-size: 2rem; cursor: pointer; width: 32px; height: 32px;';
    closeBtn.onclick = function() {
        document.body.removeChild(modal);
    };
    
    var title = document.createElement('h2');
    title.textContent = serverType === 'node' ? '📦 Node.js Server' : '💻 VS Code Live Server';
    title.style.cssText = 'margin: 0 0 15px 0; color: var(--devtools-text);';
    
    var instructionsDiv = document.createElement('div');
    instructionsDiv.style.cssText = 'color: var(--devtools-text); line-height: 1.6; white-space: pre-line; margin-bottom: 20px;';
    instructionsDiv.textContent = instructions;
    
    if (command) {
        var commandBox = document.createElement('div');
        commandBox.style.cssText = 'background: var(--devtools-bg); border: 1px solid var(--devtools-border); border-radius: 4px; padding: 10px; margin: 15px 0; display: flex; align-items: center; gap: 10px;';
        
        var commandCode = document.createElement('code');
        commandCode.textContent = command;
        commandCode.style.cssText = 'flex: 1; color: var(--devtools-text); font-family: monospace;';
        
        var copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 Copiar';
        copyBtn.style.cssText = 'background: var(--devtools-accent); color: white; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer;';
        copyBtn.onclick = function() {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(command).then(function() {
                    copyBtn.textContent = '✓ Copiado!';
                    setTimeout(function() {
                        copyBtn.textContent = '📋 Copiar';
                    }, 2000);
                });
            }
        };
        
        commandBox.appendChild(commandCode);
        commandBox.appendChild(copyBtn);
        instructionsDiv.appendChild(commandBox);
    }
    
    if (installInstructions) {
        var installDiv = document.createElement('div');
        installDiv.style.cssText = 'background: rgba(255, 193, 7, 0.1); border-left: 3px solid #ffc107; padding: 15px; margin-top: 20px; border-radius: 4px;';
        installDiv.innerHTML = '<strong style="color: var(--devtools-text);">💡 Precisa instalar?</strong><div style="color: var(--devtools-text-muted); white-space: pre-line; margin-top: 10px;">' + installInstructions + '</div>';
        instructionsDiv.appendChild(installDiv);
    }
    
    content.appendChild(closeBtn);
    content.appendChild(title);
    content.appendChild(instructionsDiv);
    modal.appendChild(content);
    
    modal.onclick = function(e) {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    };
    
    document.body.appendChild(modal);
    
    // Tentar copiar comando automaticamente
    if (command && navigator.clipboard) {
        navigator.clipboard.writeText(command);
    }
}

// ============================================
// SERVIDOR VIRTUAL JAVASCRIPT
// ============================================

var virtualServerActive = false;
var virtualServerFiles = {
    files: {}, // Armazenar todos os arquivos por caminho relativo
    count: 0,
    loaded: 0,
    currentApp: null // App HTML atualmente carregado
};
var virtualServerBlobUrls = {
    html: null,
    css: null,
    js: null
};

// Iniciar servidor virtual (clona o conteúdo que está sendo visualizado no preview)
function startVirtualServer() {
    console.log('startVirtualServer chamado');
    // Fechar modal de servidor
    closeServerModal();
    
    // Clonar o conteúdo que está sendo visualizado no preview
    clonePreviewContent();
}

// Clonar o conteúdo do preview (HTML, CSS, JS) para edição
async function clonePreviewContent() {
    try {
        // Usar o conteúdo que já foi carregado pela função loadApp
        // Se originalHTML, originalCSS e originalJS já existem, usar eles
        if (originalHTML) {
            console.log('Clonando conteúdo já carregado no preview');
            
            // Usar o app que está sendo visualizado
            var appPath = currentApp || 'index.html';
            
            // Inicializar estrutura
            virtualServerFiles = {
                files: {},
                currentApp: appPath
            };
            
            // Clonar HTML
            virtualServerFiles.files[appPath] = {
                name: appPath.split('/').pop(),
                path: appPath,
                content: originalHTML,
                type: 'html'
            };
            
            // Clonar CSS (combinar todos os CSS em um)
            if (originalCSS) {
                var cssPath = appPath.replace('.html', '-styles.css');
                virtualServerFiles.files[cssPath] = {
                    name: cssPath.split('/').pop(),
                    path: cssPath,
                    content: originalCSS,
                    type: 'css'
                };
            }
            
            // Clonar JS (combinar todos os JS em um)
            if (originalJS) {
                var jsPath = appPath.replace('.html', '-script.js');
                virtualServerFiles.files[jsPath] = {
                    name: jsPath.split('/').pop(),
                    path: jsPath,
                    content: originalJS,
                    type: 'js'
                };
            }
            
            console.log('Conteúdo clonado:', Object.keys(virtualServerFiles.files));
            
            // Ativar servidor virtual e carregar no editor
            loadVirtualServerFiles();
            return;
        }
        
        // Se não tem conteúdo carregado, tentar extrair do iframe do preview
        var appPath = currentApp || 'index.html';
        console.log('Tentando extrair conteúdo do preview:', appPath);
        
        // Verificar se está em file://
        var isLocalFile = window.location.protocol === 'file:';
        
        if (isLocalFile) {
            // Em file://, usar o src do iframe para determinar qual arquivo carregar
            console.log('Modo file:// - extraindo caminho do iframe');
            
            // Tentar usar o src do iframe para saber qual arquivo está sendo visualizado
            var iframeSrc = previewFrame.src;
            console.log('Src do iframe:', iframeSrc);
            
            if (iframeSrc && iframeSrc !== 'about:blank' && iframeSrc.indexOf('file://') === 0) {
                // Extrair caminho do arquivo do src
                var filePath = iframeSrc;
                // Converter file:///C:/... para C:/...
                if (filePath.startsWith('file:///')) {
                    filePath = filePath.replace('file:///', '');
                } else if (filePath.startsWith('file://')) {
                    filePath = filePath.replace('file://', '');
                }
                
                // Normalizar separadores
                filePath = filePath.replace(/%20/g, ' ').replace(/\//g, '\\');
                
                console.log('Caminho do arquivo extraído:', filePath);
                
                // Tentar carregar esse arquivo específico e seus relacionados
                loadSpecificFileFromPath(filePath, appPath);
                return;
            }
            
            // Se não conseguiu extrair do src, usar seletor de arquivos
            console.log('Não foi possível extrair caminho do iframe - usando seletor de arquivos');
            loadFilesManuallyForFileProtocol();
            return;
        }
        
        // Inicializar estrutura
        virtualServerFiles = {
            files: {},
            currentApp: appPath
        };
        
        // Carregar HTML do app que está no preview
        var htmlResponse = await fetch(appPath);
        if (!htmlResponse.ok) {
            throw new Error('Erro ao carregar HTML: ' + htmlResponse.status);
        }
        var htmlContent = await htmlResponse.text();
        
        // Salvar HTML
        virtualServerFiles.files[appPath] = {
            name: appPath.split('/').pop(),
            path: appPath,
            content: htmlContent,
            type: 'html'
        };
        
        // Extrair caminhos de CSS e JS do HTML
        var htmlDoc = new DOMParser().parseFromString(htmlContent, 'text/html');
        var basePath = appPath.substring(0, appPath.lastIndexOf('/') + 1);
        
        // Combinar todos os CSS em um
        var allCSS = '';
        var cssLinks = htmlDoc.querySelectorAll('link[rel="stylesheet"]');
        for (var i = 0; i < cssLinks.length; i++) {
            var href = cssLinks[i].getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('//')) {
                var cssPath = resolvePath(href, basePath);
                await loadFileIntoVirtualServer(cssPath, 'css');
                if (virtualServerFiles.files[cssPath]) {
                    allCSS += '\n\n/* === ' + cssPath + ' === */\n' + virtualServerFiles.files[cssPath].content;
                }
            }
        }
        
        // Combinar todos os JS em um
        var allJS = '';
        var jsScripts = htmlDoc.querySelectorAll('script[src]');
        for (var i = 0; i < jsScripts.length; i++) {
            var src = jsScripts[i].getAttribute('src');
            if (src && !src.startsWith('http') && !src.startsWith('//')) {
                var jsPath = resolvePath(src, basePath);
                await loadFileIntoVirtualServer(jsPath, 'js');
                if (virtualServerFiles.files[jsPath]) {
                    allJS += '\n\n// === ' + jsPath + ' ===\n' + virtualServerFiles.files[jsPath].content;
                }
            }
        }
        
        // Criar arquivos combinados
        if (allCSS) {
            var cssPath = appPath.replace('.html', '-styles.css');
            virtualServerFiles.files[cssPath] = {
                name: cssPath.split('/').pop(),
                path: cssPath,
                content: allCSS.trim(),
                type: 'css'
            };
        }
        
        if (allJS) {
            var jsPath = appPath.replace('.html', '-script.js');
            virtualServerFiles.files[jsPath] = {
                name: jsPath.split('/').pop(),
                path: jsPath,
                content: allJS.trim(),
                type: 'js'
            };
        }
        
        console.log('Conteúdo clonado:', Object.keys(virtualServerFiles.files));
        
        // Ativar servidor virtual e carregar no editor
        loadVirtualServerFiles();
        
    } catch (error) {
        console.error('Erro ao clonar conteúdo do preview:', error);
        alert('Erro ao clonar conteúdo: ' + error.message);
    }
}

// Resolver caminho relativo
function resolvePath(path, basePath) {
    // Remover query string
    path = path.split('?')[0];
    
    if (path.startsWith('../')) {
        // Caminho relativo: ../assets/css/...
        path = path.replace(/^\.\.\//, '');
    } else if (path.startsWith('/')) {
        // Caminho absoluto: /assets/css/...
        path = path.substring(1);
    } else if (!path.startsWith('assets/')) {
        // Caminho relativo ao diretório do HTML
        path = basePath + path;
    }
    
    return path;
}

// Carregar arquivo HTML para injetar script coletor (coleta recursos do iframe)
function loadHTMLFileForInjection(iframePath, appPath) {
    console.log('Solicitando carregamento do arquivo HTML para injeção:', iframePath);
    
    // Criar input para selecionar o arquivo HTML específico
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html';
    input.style.display = 'none';
    
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) {
            // Usuário cancelou - carregar iframe normalmente
            previewFrame.src = iframePath;
            showFileProtocolMessage();
            return;
        }
        
        var reader = new FileReader();
        reader.onload = function(e) {
            var htmlContent = e.target.result;
            
            // Injetar script coletor no HTML antes de carregar no iframe
            // Este script vai coletar todos os recursos (HTML, CSS, JS) e enviar via postMessage
            var scriptCollector = `
                <script>
                (function() {
                    // Aguardar página carregar completamente
                    function collectResources() {
                        try {
                            var html = '<!DOCTYPE html>\\n' + document.documentElement.outerHTML;
                            
                            // Coletar CSS de todas as fontes
                            var css = '';
                            var styleTags = document.querySelectorAll('style');
                            for (var i = 0; i < styleTags.length; i++) {
                                css += styleTags[i].textContent + '\\n\\n';
                            }
                            
                            // Tentar coletar de stylesheets (pode falhar por CORS)
                            try {
                                var sheets = document.styleSheets;
                                for (var i = 0; i < sheets.length; i++) {
                                    try {
                                        var rules = sheets[i].cssRules || sheets[i].rules;
                                        if (rules) {
                                            for (var j = 0; j < rules.length; j++) {
                                                css += rules[j].cssText + '\\n';
                                            }
                                        }
                                    } catch (e) {
                                        // Ignorar CORS
                                    }
                                }
                            } catch (e) {}
                            
                            // Coletar JS inline (ignorar scripts do DevTools)
                            var js = '';
                            var scriptTags = document.querySelectorAll('script');
                            for (var i = 0; i < scriptTags.length; i++) {
                                var script = scriptTags[i];
                                if (!script.src || script.src.indexOf('devtools') === -1) {
                                    js += script.textContent + '\\n\\n';
                                }
                            }
                            
                            // Enviar para o parent
                            window.parent.postMessage({
                                type: 'devtools-extract-content',
                                html: html,
                                css: css.trim(),
                                js: js.trim()
                            }, '*');
                        } catch (e) {
                            window.parent.postMessage({
                                type: 'devtools-extract-content',
                                error: e.message
                            }, '*');
                        }
                    }
                    
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', collectResources);
                    } else {
                        setTimeout(collectResources, 100);
                    }
                })();
                </script>
            `;
            
            // Injetar script antes do </head> ou antes do </body>
            if (htmlContent.indexOf('</head>') !== -1) {
                htmlContent = htmlContent.replace('</head>', scriptCollector + '</head>');
            } else if (htmlContent.indexOf('</body>') !== -1) {
                htmlContent = htmlContent.replace('</body>', scriptCollector + '</body>');
            } else {
                htmlContent = htmlContent + scriptCollector;
            }
            
            // Criar Blob URL e carregar no iframe
            var blob = new Blob([htmlContent], { type: 'text/html' });
            var blobUrl = URL.createObjectURL(blob);
            previewFrame.src = blobUrl;
            
            console.log('HTML carregado no iframe com script coletor injetado');
            
            // Listener para receber dados coletados
            var messageHandler = function(event) {
                if (event.data && event.data.type === 'devtools-extract-content') {
                    window.removeEventListener('message', messageHandler);
                    URL.revokeObjectURL(blobUrl);
                    
                    if (event.data.error) {
                        console.error('Erro ao coletar recursos:', event.data.error);
                        showFileProtocolMessage();
                        return;
                    }
                    
                    console.log('Recursos coletados do iframe:', event.data);
                    
                    // Inicializar estrutura
                    virtualServerFiles = {
                        files: {},
                        currentApp: appPath
                    };
                    
                    // Salvar HTML
                    if (event.data.html) {
                        virtualServerFiles.files[appPath] = {
                            name: appPath.split('/').pop(),
                            path: appPath,
                            content: event.data.html,
                            type: 'html'
                        };
                    }
                    
                    // Salvar CSS
                    if (event.data.css) {
                        var cssPath = appPath.replace('.html', '-styles.css');
                        virtualServerFiles.files[cssPath] = {
                            name: cssPath.split('/').pop(),
                            path: cssPath,
                            content: event.data.css,
                            type: 'css'
                        };
                    }
                    
                    // Salvar JS
                    if (event.data.js) {
                        var jsPath = appPath.replace('.html', '-script.js');
                        virtualServerFiles.files[jsPath] = {
                            name: jsPath.split('/').pop(),
                            path: jsPath,
                            content: event.data.js,
                            type: 'js'
                        };
                    }
                    
                    console.log('Recursos salvos:', Object.keys(virtualServerFiles.files));
                    
                    // Carregar no editor
                    loadVirtualServerFiles();
                }
            };
            
            window.addEventListener('message', messageHandler);
            
            // Timeout de segurança
            setTimeout(function() {
                window.removeEventListener('message', messageHandler);
                if (!virtualServerFiles || Object.keys(virtualServerFiles.files || {}).length === 0) {
                    console.log('Timeout - recursos não coletados, usando método alternativo');
                    showFileProtocolMessage();
                }
            }, 5000);
        };
        
        reader.readAsText(file);
    };
    
    document.body.appendChild(input);
    input.click();
    setTimeout(function() {
        if (input.parentNode) {
            document.body.removeChild(input);
        }
    }, 1000);
}

// Mostrar mensagem de file://
function showFileProtocolMessage() {
    var serverMessage = '⚠️ EDIÇÃO DE CÓDIGO NÃO DISPONÍVEL\n\n' +
                      'Você está abrindo o arquivo diretamente (file://).\n' +
                      'Para habilitar a edição de HTML, CSS e JavaScript:\n\n' +
                      '👉 Clique no botão 🌐 no header acima\n' +
                      '👉 Ou pressione ESC e clique em "Iniciar Servidor"\n\n' +
                      'Opções disponíveis:\n' +
                      '• Node.js: npx serve\n' +
                      '• VS Code: Extensão "Live Server"\n' +
                      '• Servidor Virtual JavaScript (Recomendado - sem instalação)\n\n' +
                      '📱 O preview acima funciona normalmente, mas a edição de código requer um servidor local.';
    
    if (editorHTML) editorHTML.textContent = serverMessage;
    if (editorCSS) editorCSS.textContent = serverMessage;
    if (editorJS) editorJS.textContent = serverMessage;
    
    if (btnServer) {
        btnServer.style.animation = 'pulse 2s infinite';
        btnServer.style.boxShadow = '0 0 10px rgba(0, 122, 204, 0.5)';
    }
}

// Carregar arquivo no servidor virtual
async function loadFileIntoVirtualServer(filePath, type) {
    try {
        console.log('Carregando ' + type + ':', filePath);
        var response = await fetch(filePath);
        if (response.ok) {
            var content = await response.text();
            virtualServerFiles.files[filePath] = {
                name: filePath.split('/').pop(),
                path: filePath,
                content: content,
                type: type
            };
        }
    } catch (e) {
        console.warn(type.toUpperCase() + ' não encontrado:', filePath, e);
    }
}

// Carregar arquivos manualmente quando em file://
function loadFilesManuallyForFileProtocol(targetFileName) {
    // Criar input para selecionar pasta ou arquivos
    var input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.webkitdirectory = true; // Permitir selecionar pasta
    input.accept = '.html,.css,.js';
    input.style.display = 'none';
    
    input.onchange = function(e) {
        var files = e.target.files;
        if (!files || files.length === 0) return;
        
        // Inicializar estrutura
        virtualServerFiles = {
            files: {},
            currentApp: null
        };
        
        // Processar todos os arquivos
        var fileCount = files.length;
        var loadedCount = 0;
        var htmlFile = null;
        
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            var reader = new FileReader();
            
            reader.onload = (function(file) {
                return function(e) {
                    var path = file.webkitRelativePath || file.name;
                    // Normalizar separadores de caminho
                    path = path.replace(/\\/g, '/');
                    
                    // Remover primeiro nível se for o nome da pasta selecionada
                    var pathParts = path.split('/');
                    if (pathParts.length > 1) {
                        // Ignorar arquivos do DevTools
                        if (pathParts[0].toLowerCase() === 'devtools' || 
                            pathParts[0].toLowerCase() === 'devtools.html' ||
                            path.indexOf('devtools/') === 0) {
                            loadedCount++;
                            if (loadedCount === fileCount) {
                                processLoadedFiles();
                            }
                            return;
                        }
                        // Remover primeiro nível (nome da pasta selecionada)
                        path = pathParts.slice(1).join('/');
                    }
                    
                    var ext = path.split('.').pop().toLowerCase();
                    var type = ext === 'html' ? 'html' : (ext === 'css' ? 'css' : (ext === 'js' ? 'js' : 'other'));
                    
                    if (type !== 'other') {
                        virtualServerFiles.files[path] = {
                            name: file.name,
                            path: path,
                            content: e.target.result,
                            type: type
                        };
                        
                        if (type === 'html' && !htmlFile) {
                            htmlFile = path;
                        }
                    }
                    
                    loadedCount++;
                    if (loadedCount === fileCount) {
                        processLoadedFiles();
                    }
                };
            })(file);
            
            reader.readAsText(file);
        }
    };
    
    // Função para processar arquivos após carregamento
    function processLoadedFiles() {
        // Tentar encontrar o HTML do app selecionado ou do arquivo detectado
        var targetApp = targetFileName || currentApp || 'index.html';
        var targetAppName = targetApp.replace('.html', '').toLowerCase();
        var selectedApp = currentApp || 'index.html';
        var selectedAppName = selectedApp.split('/').pop().replace('.html', '').toLowerCase();
        var foundHtml = null;
        
        console.log('Procurando app:', selectedApp, 'Nome:', selectedAppName);
        if (targetFileName) {
            console.log('Arquivo alvo detectado do iframe:', targetFileName);
        }
        console.log('Arquivos carregados:', Object.keys(virtualServerFiles.files));
        
        // Primeiro, tentar encontrar pelo arquivo detectado do iframe
        if (targetFileName) {
            for (var path in virtualServerFiles.files) {
                var file = virtualServerFiles.files[path];
                if (file.type === 'html' && (file.name === targetFileName || file.name.toLowerCase() === targetFileName.toLowerCase())) {
                    foundHtml = path;
                    console.log('Arquivo encontrado pelo nome do iframe:', foundHtml);
                    break;
                }
            }
        }
        
        // Se não encontrou, procurar pelo app selecionado
        if (!foundHtml) {
            for (var path in virtualServerFiles.files) {
                var file = virtualServerFiles.files[path];
                if (file.type === 'html') {
                    var fileName = file.name.replace('.html', '').toLowerCase();
                    var pathName = path.split('/').pop().replace('.html', '').toLowerCase();
                    var pathLower = path.toLowerCase();
                    
                    // Comparar de várias formas
                    if (path === selectedApp || 
                        pathLower === selectedApp.toLowerCase() ||
                        pathLower.indexOf(selectedApp.toLowerCase()) !== -1 ||
                        fileName === selectedAppName ||
                        pathName === selectedAppName ||
                        pathLower.indexOf(selectedAppName) !== -1) {
                        foundHtml = path;
                        console.log('App encontrado pelo nome:', foundHtml);
                        break;
                    }
                }
            }
        }
        
        // Se não encontrou, usar o primeiro HTML
        if (!foundHtml) {
            for (var path in virtualServerFiles.files) {
                if (virtualServerFiles.files[path].type === 'html') {
                    foundHtml = path;
                    console.log('Usando primeiro HTML encontrado:', foundHtml);
                    break;
                }
            }
        }
        
        if (foundHtml && virtualServerFiles.files[foundHtml]) {
            virtualServerFiles.currentApp = foundHtml;
            console.log('Carregando app:', foundHtml);
            loadVirtualServerFiles();
        } else {
            alert('Nenhum arquivo HTML encontrado na pasta selecionada.\n\nProcure por: ' + (targetFileName || selectedApp));
        }
    }
    
    document.body.appendChild(input);
    input.click();
    setTimeout(function() {
        if (input.parentNode) {
            document.body.removeChild(input);
        }
    }, 1000);
}

// Carregar arquivos do app automaticamente
async function loadAppFilesAutomatically(htmlPath) {
    try {
        // Carregar HTML
        console.log('Carregando HTML:', htmlPath);
        var htmlResponse = await fetch(htmlPath);
        if (!htmlResponse.ok) {
            throw new Error('Erro ao carregar HTML: ' + htmlResponse.status);
        }
        var htmlContent = await htmlResponse.text();
        
        // Salvar HTML
        virtualServerFiles.files[htmlPath] = {
            name: htmlPath.split('/').pop(),
            path: htmlPath,
            content: htmlContent,
            type: 'html'
        };
        
        // Extrair caminhos de CSS e JS do HTML
        var htmlDoc = new DOMParser().parseFromString(htmlContent, 'text/html');
        var basePath = htmlPath.substring(0, htmlPath.lastIndexOf('/') + 1);
        
        // Encontrar CSS
        var cssLinks = htmlDoc.querySelectorAll('link[rel="stylesheet"]');
        for (var i = 0; i < cssLinks.length; i++) {
            var href = cssLinks[i].getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('//')) {
                // Resolver caminho relativo
                var cssPath = href;
                // Remover query string primeiro
                cssPath = cssPath.split('?')[0];
                
                // Resolver caminho relativo baseado no HTML
                if (cssPath.startsWith('../')) {
                    // Caminho relativo: ../assets/css/...
                    // Se HTML está em aquecimento/aquecimento.html e CSS é ../assets/css/...
                    // Resultado: assets/css/...
                    cssPath = cssPath.replace(/^\.\.\//, '');
                } else if (cssPath.startsWith('/')) {
                    // Caminho absoluto: /assets/css/...
                    cssPath = cssPath.substring(1);
                } else if (!cssPath.startsWith('assets/')) {
                    // Caminho relativo ao diretório do HTML
                    cssPath = basePath + cssPath;
                }
                
                try {
                    console.log('Carregando CSS:', cssPath);
                    var cssResponse = await fetch(cssPath);
                    if (cssResponse.ok) {
                        var cssContent = await cssResponse.text();
                        virtualServerFiles.files[cssPath] = {
                            name: cssPath.split('/').pop(),
                            path: cssPath,
                            content: cssContent,
                            type: 'css'
                        };
                    }
                } catch (e) {
                    console.warn('CSS não encontrado:', cssPath, e);
                }
            }
        }
        
        // Encontrar JS
        var jsScripts = htmlDoc.querySelectorAll('script[src]');
        for (var i = 0; i < jsScripts.length; i++) {
            var src = jsScripts[i].getAttribute('src');
            if (src && !src.startsWith('http') && !src.startsWith('//')) {
                // Resolver caminho relativo
                var jsPath = src;
                // Remover query string primeiro
                jsPath = jsPath.split('?')[0];
                
                // Resolver caminho relativo baseado no HTML
                if (jsPath.startsWith('../')) {
                    // Caminho relativo: ../assets/js/...
                    jsPath = jsPath.replace(/^\.\.\//, '');
                } else if (jsPath.startsWith('/')) {
                    // Caminho absoluto: /assets/js/...
                    jsPath = jsPath.substring(1);
                } else if (!jsPath.startsWith('assets/')) {
                    // Caminho relativo ao diretório do HTML
                    jsPath = basePath + jsPath;
                }
                
                try {
                    console.log('Carregando JS:', jsPath);
                    var jsResponse = await fetch(jsPath);
                    if (jsResponse.ok) {
                        var jsContent = await jsResponse.text();
                        virtualServerFiles.files[jsPath] = {
                            name: jsPath.split('/').pop(),
                            path: jsPath,
                            content: jsContent,
                            type: 'js'
                        };
                    }
                } catch (e) {
                    console.warn('JS não encontrado:', jsPath, e);
                }
            }
        }
        
        console.log('Arquivos carregados:', Object.keys(virtualServerFiles.files));
        
        // Carregar no servidor virtual
        loadVirtualServerFiles();
        
    } catch (error) {
        console.error('Erro ao carregar arquivos:', error);
        alert('Erro ao carregar arquivos do app: ' + error.message + '\n\nCertifique-se de que está usando um servidor local (não file://)');
    }
}

// Carregar arquivos relacionados (CSS e JS)
function loadRelatedFiles(htmlPath, basePath, cssPath, jsPath) {
    // Criar modal simples para selecionar CSS e JS
    var modal = document.createElement('div');
    modal.className = 'server-modal';
    modal.style.display = 'flex';
    modal.id = 'simpleFileLoader';
    
    var content = document.createElement('div');
    content.className = 'server-modal-content';
    content.style.cssText = 'max-width: 500px;';
    
    var header = document.createElement('div');
    header.className = 'server-modal-header';
    header.innerHTML = '<h2>⚡ Carregar Arquivos</h2><button class="btn-close-modal" onclick="closeSimpleFileLoader()">×</button>';
    
    var body = document.createElement('div');
    body.className = 'server-modal-body';
    
    var info = document.createElement('p');
    info.className = 'server-info';
    info.innerHTML = 'HTML carregado: <strong>' + (virtualServerFiles.files[htmlPath].name) + '</strong><br><br>Selecione os arquivos CSS e JavaScript relacionados (opcional):';
    
    var cssInput = document.createElement('input');
    cssInput.type = 'file';
    cssInput.accept = '.css';
    cssInput.style.display = 'none';
    cssInput.id = 'cssFileInput';
    
    var jsInput = document.createElement('input');
    jsInput.type = 'file';
    jsInput.accept = '.js';
    jsInput.style.display = 'none';
    jsInput.id = 'jsFileInput';
    
    var cssBtn = document.createElement('button');
    cssBtn.className = 'btn-open-terminal';
    cssBtn.textContent = '📄 Selecionar CSS (opcional)';
    cssBtn.style.marginTop = '10px';
    cssBtn.style.width = '100%';
    cssBtn.onclick = function() { cssInput.click(); };
    
    var jsBtn = document.createElement('button');
    jsBtn.className = 'btn-open-terminal';
    jsBtn.textContent = '⚙️ Selecionar JavaScript (opcional)';
    jsBtn.style.marginTop = '10px';
    jsBtn.style.width = '100%';
    jsBtn.onclick = function() { jsInput.click(); };
    
    var startBtn = document.createElement('button');
    startBtn.className = 'btn-open-terminal';
    startBtn.textContent = '🚀 Iniciar Edição';
    startBtn.style.marginTop = '20px';
    startBtn.style.width = '100%';
    startBtn.style.backgroundColor = '#4caf50';
    
    var filesLoaded = { css: false, js: false };
    
    cssInput.onchange = function(e) {
        var file = e.target.files[0];
        if (file) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var path = file.webkitRelativePath || file.name;
                virtualServerFiles.files[path] = {
                    name: file.name,
                    path: path,
                    content: e.target.result,
                    type: 'css'
                };
                filesLoaded.css = true;
                cssBtn.textContent = '✓ CSS: ' + file.name;
                cssBtn.style.backgroundColor = '#4caf50';
            };
            reader.readAsText(file);
        }
    };
    
    jsInput.onchange = function(e) {
        var file = e.target.files[0];
        if (file) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var path = file.webkitRelativePath || file.name;
                virtualServerFiles.files[path] = {
                    name: file.name,
                    path: path,
                    content: e.target.result,
                    type: 'js'
                };
                filesLoaded.js = true;
                jsBtn.textContent = '✓ JavaScript: ' + file.name;
                jsBtn.style.backgroundColor = '#4caf50';
            };
            reader.readAsText(file);
        }
    };
    
    startBtn.onclick = function() {
        // Verificar se temos HTML carregado
        if (!virtualServerFiles || !virtualServerFiles.files || !virtualServerFiles.currentApp) {
            alert('Erro: HTML não foi carregado corretamente.');
            return;
        }
        
        loadVirtualServerFiles();
        closeSimpleFileLoader();
    };
    
    body.appendChild(info);
    body.appendChild(cssInput);
    body.appendChild(jsInput);
    body.appendChild(cssBtn);
    body.appendChild(jsBtn);
    body.appendChild(startBtn);
    
    content.appendChild(header);
    content.appendChild(body);
    modal.appendChild(content);
    
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeSimpleFileLoader();
        }
    };
    
    document.body.appendChild(modal);
    window.closeSimpleFileLoader = function() {
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    };
}

// Tornar startVirtualServer acessível globalmente
window.startVirtualServer = startVirtualServer;

// Fechar modal de carregamento
function closeFileLoaderModal() {
    var modal = document.getElementById('fileLoaderModal');
    if (modal) {
        document.body.removeChild(modal);
    }
}

// Tornar closeFileLoaderModal acessível globalmente
window.closeFileLoaderModal = closeFileLoaderModal;

// Processar arquivos
function handleFiles(files) {
    // Inicializar estrutura para armazenar todos os arquivos do projeto
    virtualServerFiles = { 
        files: {}, // Armazenar todos os arquivos por caminho relativo
        count: 0,
        loaded: 0
    };
    
    var fileList = document.getElementById('virtualServerFileList');
    if (fileList) fileList.innerHTML = '<div class="loading-files">Carregando arquivos...</div>';
    
    var totalFiles = 0;
    var loadedFiles = 0;
    
    // Contar arquivos válidos primeiro (excluindo DevTools)
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        // Excluir arquivos do DevTools
        if (file.webkitRelativePath && file.webkitRelativePath.indexOf('devtools/') === 0) {
            continue;
        }
        if (file.name && (file.name.indexOf('devtools') !== -1 || file.path && file.path.indexOf('devtools') !== -1)) {
            continue;
        }
        
        var ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'html' || ext === 'css' || ext === 'js') {
            totalFiles++;
        }
    }
    
    if (totalFiles === 0) {
        if (fileList) fileList.innerHTML = '<div class="error-message">Nenhum arquivo válido encontrado. Certifique-se de selecionar arquivos HTML, CSS ou JS (exceto do DevTools).</div>';
        return;
    }
    
    // Carregar todos os arquivos válidos
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        
        // Excluir arquivos do DevTools
        var filePath = file.webkitRelativePath || file.name || '';
        if (filePath.indexOf('devtools/') === 0 || filePath.indexOf('devtools\\') === 0) {
            continue;
        }
        if (file.name && file.name.indexOf('devtools') !== -1) {
            continue;
        }
        
        var ext = file.name.split('.').pop().toLowerCase();
        
        if (ext === 'html' || ext === 'css' || ext === 'js') {
            var reader = new FileReader();
            
            reader.onload = function(file, ext, filePath) {
                return function(e) {
                    loadedFiles++;
                    
                    // Armazenar arquivo com caminho relativo como chave
                    var relativePath = filePath || file.name;
                    virtualServerFiles.files[relativePath] = {
                        name: file.name,
                        path: relativePath,
                        content: e.target.result,
                        type: ext
                    };
                    
                    // Atualizar contadores
                    virtualServerFiles.count = Object.keys(virtualServerFiles.files).length;
                    virtualServerFiles.loaded = loadedFiles;
                    
                    updateFileList();
                };
            }(file, ext, filePath);
            
            reader.readAsText(file);
        }
    }
}

// Atualizar lista de arquivos
function updateFileList() {
    var fileList = document.getElementById('virtualServerFileList');
    var startBtn = document.getElementById('btnStartVirtualServer');
    
    if (!fileList) return;
    
    if (!virtualServerFiles || !virtualServerFiles.files) {
        fileList.innerHTML = '<div class="info-message">Nenhum arquivo carregado ainda.</div>';
        if (startBtn) startBtn.disabled = true;
        return;
    }
    
    var files = virtualServerFiles.files;
    var fileKeys = Object.keys(files);
    
    if (fileKeys.length === 0) {
        fileList.innerHTML = '<div class="info-message">Nenhum arquivo carregado ainda.</div>';
        if (startBtn) startBtn.disabled = true;
        return;
    }
    
    // Ordenar arquivos: HTML primeiro, depois CSS, depois JS, depois por caminho
    fileKeys.sort(function(a, b) {
        var extA = files[a].type;
        var extB = files[b].type;
        var order = { 'html': 1, 'css': 2, 'js': 3 };
        if (order[extA] !== order[extB]) {
            return (order[extA] || 99) - (order[extB] || 99);
        }
        return a.localeCompare(b);
    });
    
    fileList.innerHTML = '';
    
    // Adicionar contador
    var header = document.createElement('div');
    header.className = 'virtual-server-file-header';
    header.innerHTML = '<strong>Arquivos carregados: ' + fileKeys.length + '</strong>';
    fileList.appendChild(header);
    
    // Adicionar cada arquivo
    for (var i = 0; i < fileKeys.length; i++) {
        var key = fileKeys[i];
        var file = files[key];
        var item = document.createElement('div');
        item.className = 'virtual-server-file-item';
        
        var icon = '📄';
        if (file.type === 'css') icon = '🎨';
        else if (file.type === 'js') icon = '⚙️';
        
        var displayPath = file.path || file.name;
        // Mostrar caminho relativo se disponível, senão apenas o nome
        if (displayPath.length > 50) {
            displayPath = '...' + displayPath.substring(displayPath.length - 47);
        }
        
        item.innerHTML = '<span class="file-icon">' + icon + '</span><span class="file-name" title="' + (file.path || file.name) + '">' + displayPath + '</span><span class="file-status available">✓</span>';
        fileList.appendChild(item);
    }
    
    if (startBtn) {
        startBtn.disabled = fileKeys.length === 0;
    }
}

// Mostrar modal para carregar arquivos
function showFileLoaderModal() {
    var modal = document.createElement('div');
    modal.id = 'fileLoaderModal';
    modal.className = 'server-modal';
    modal.style.display = 'flex';
    
    var content = document.createElement('div');
    content.className = 'server-modal-content';
    content.style.cssText = 'max-width: 700px;';
    
    var header = document.createElement('div');
    header.className = 'server-modal-header';
    header.innerHTML = '<h2>⚡ Servidor Virtual JavaScript</h2><button class="btn-close-modal" onclick="closeFileLoaderModal()">×</button>';
    
    var body = document.createElement('div');
    body.className = 'server-modal-body';
    
    var info = document.createElement('p');
    info.className = 'server-info';
    info.textContent = 'Carregue todos os arquivos do projeto (exceto DevTools). Você pode arrastar e soltar uma pasta inteira ou selecionar múltiplos arquivos. Os arquivos do DevTools serão automaticamente excluídos.';
    
    // Área de drag and drop
    var dropZone = document.createElement('div');
    dropZone.id = 'fileDropZone';
    dropZone.className = 'file-drop-zone';
    dropZone.innerHTML = '<div class="drop-zone-content"><span class="drop-zone-icon">📁</span><p>Arraste uma pasta ou arquivos aqui</p><p class="drop-zone-hint">Todos os arquivos do projeto (HTML, CSS, JS)</p><p class="drop-zone-hint" style="font-size: 0.85em; color: #999; margin-top: 5px;">Arquivos do DevTools serão excluídos automaticamente</p></div>';
    
    // Input file (oculto) - permitir selecionar pasta inteira
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.webkitdirectory = true; // Permitir selecionar pasta
    fileInput.accept = '.html,.css,.js';
    fileInput.style.display = 'none';
    fileInput.id = 'virtualServerFileInput';
    
    // Lista de arquivos carregados
    var fileList = document.createElement('div');
    fileList.id = 'virtualServerFileList';
    fileList.className = 'virtual-server-file-list';
    
    // Botão para iniciar
    var startBtn = document.createElement('button');
    startBtn.className = 'btn-open-terminal';
    startBtn.textContent = '🚀 Iniciar Edição';
    startBtn.id = 'btnStartVirtualServer';
    startBtn.disabled = true;
    startBtn.style.marginTop = '20px';
    startBtn.style.width = '100%';
    
    // Event listeners
    dropZone.addEventListener('click', function() {
        fileInput.click();
    });
    
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', function() {
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });
    
    fileInput.addEventListener('change', function(e) {
        handleFiles(e.target.files);
    });
    
    startBtn.addEventListener('click', function() {
        if (virtualServerFiles && virtualServerFiles.files && Object.keys(virtualServerFiles.files).length > 0) {
            // Verificar se há pelo menos um arquivo HTML
            var hasHTML = false;
            for (var path in virtualServerFiles.files) {
                if (virtualServerFiles.files[path].type === 'html') {
                    hasHTML = true;
                    break;
                }
            }
            if (hasHTML) {
                loadVirtualServerFiles();
                closeFileLoaderModal();
            } else {
                alert('Por favor, carregue pelo menos um arquivo HTML.');
            }
        }
    });
    
    body.appendChild(info);
    body.appendChild(dropZone);
    body.appendChild(fileInput);
    body.appendChild(fileList);
    body.appendChild(startBtn);
    
    content.appendChild(header);
    content.appendChild(body);
    modal.appendChild(content);
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeFileLoaderModal();
        }
    });
    
    document.body.appendChild(modal);
}

// Encontrar arquivos relacionados a um app HTML
function findAppFiles(htmlPath) {
    var htmlFile = virtualServerFiles.files[htmlPath];
    if (!htmlFile) return null;
    
    var baseName = htmlPath.replace(/\.html$/i, '').replace(/\\/g, '/');
    var dir = baseName.substring(0, baseName.lastIndexOf('/') + 1);
    
    // Procurar CSS e JS relacionados
    var cssFile = null;
    var jsFile = null;
    
    // Tentar encontrar CSS e JS com mesmo nome base
    for (var path in virtualServerFiles.files) {
        var file = virtualServerFiles.files[path];
        var filePath = path.replace(/\\/g, '/');
        var fileBase = filePath.replace(/\.(css|js)$/i, '');
        
        if (fileBase === baseName) {
            if (file.type === 'css' && !cssFile) {
                cssFile = file;
            } else if (file.type === 'js' && !jsFile) {
                jsFile = file;
            }
        }
    }
    
    // Se não encontrou, procurar na mesma pasta
    if (!cssFile || !jsFile) {
        for (var path in virtualServerFiles.files) {
            var file = virtualServerFiles.files[path];
            var filePath = path.replace(/\\/g, '/');
            
            if (filePath.indexOf(dir) === 0) {
                if (file.type === 'css' && !cssFile) {
                    cssFile = file;
                } else if (file.type === 'js' && !jsFile) {
                    jsFile = file;
                }
            }
        }
    }
    
    return {
        html: htmlFile,
        css: cssFile,
        js: jsFile
    };
}

// Carregar arquivos no servidor virtual
function loadVirtualServerFiles() {
    if (!virtualServerFiles || !virtualServerFiles.files || Object.keys(virtualServerFiles.files).length === 0) {
        alert('Nenhum arquivo carregado. Por favor, carregue os arquivos do projeto primeiro.');
        return;
    }
    
    // Se já temos um app selecionado, usar ele
    var htmlPath = virtualServerFiles.currentApp;
    
    // Se não, usar o app atual do seletor ou o primeiro HTML encontrado
    if (!htmlPath && currentApp) {
        // Tentar encontrar o arquivo HTML correspondente ao app selecionado
        var appName = currentApp.replace(/^.*\//, '').replace(/\.html$/i, '');
        for (var path in virtualServerFiles.files) {
            var file = virtualServerFiles.files[path];
            if (file.type === 'html' && (path.indexOf(appName) !== -1 || file.name.indexOf(appName) !== -1)) {
                htmlPath = path;
                break;
            }
        }
    }
    
    // Se ainda não encontrou, usar o primeiro HTML
    if (!htmlPath) {
        for (var path in virtualServerFiles.files) {
            if (virtualServerFiles.files[path].type === 'html') {
                htmlPath = path;
                break;
            }
        }
    }
    
    if (!htmlPath) {
        alert('Nenhum arquivo HTML encontrado nos arquivos carregados.');
        return;
    }
    
    var appFiles = findAppFiles(htmlPath);
    if (!appFiles || !appFiles.html) {
        alert('Erro ao encontrar arquivos do app.');
        return;
    }
    
    virtualServerActive = true;
    virtualServerFiles.currentApp = htmlPath;
    
    // Limpar Blob URLs anteriores
    if (virtualServerBlobUrls.html) URL.revokeObjectURL(virtualServerBlobUrls.html);
    if (virtualServerBlobUrls.css) URL.revokeObjectURL(virtualServerBlobUrls.css);
    if (virtualServerBlobUrls.js) URL.revokeObjectURL(virtualServerBlobUrls.js);
    
    // Atualizar editores
    originalHTML = appFiles.html.content;
    originalCSS = appFiles.css ? appFiles.css.content : '';
    originalJS = appFiles.js ? appFiles.js.content : '';
    
    updateEditors();
    
    // Aplicar mudanças (cria o Blob URL e carrega no iframe)
    // Usar setTimeout para garantir que os editores estejam atualizados
    setTimeout(function() {
        console.log('Chamando applyVirtualServerChanges após atualizar editores');
        applyVirtualServerChanges();
    }, 50);
    
    // Aplicar syntax highlighting
    setTimeout(function() {
        applySyntaxHighlighting();
    }, 150);
    
    // Esconder banner se estiver visível
    if (fileProtocolBanner) {
        fileProtocolBanner.style.display = 'none';
    }
    
    // Remover animação do botão de servidor
    if (btnServer) {
        btnServer.style.animation = '';
        btnServer.style.boxShadow = '';
    }
}

// Aplicar mudanças no servidor virtual
function applyVirtualServerChanges() {
    console.log('applyVirtualServerChanges chamado');
    
    if (!virtualServerFiles || !virtualServerFiles.currentApp) {
        console.error('applyVirtualServerChanges: virtualServerFiles não disponível', virtualServerFiles);
        return;
    }
    
    var appFiles = findAppFiles(virtualServerFiles.currentApp);
    if (!appFiles || !appFiles.html) {
        console.error('applyVirtualServerChanges: arquivos do app não encontrados', appFiles);
        return;
    }
    
    console.log('Arquivos encontrados:', {
        html: !!appFiles.html,
        css: !!appFiles.css,
        js: !!appFiles.js
    });
    
    // Limpar Blob URL anterior
    if (virtualServerBlobUrls.html) {
        URL.revokeObjectURL(virtualServerBlobUrls.html);
    }
    
    // Obter conteúdo atual dos editores (priorizar conteúdo dos arquivos se editores não estiverem prontos)
    var htmlContent = appFiles.html.content;
    var cssContent = appFiles.css ? appFiles.css.content : '';
    var jsContent = appFiles.js ? appFiles.js.content : '';
    
    // Se os editores estiverem disponíveis e tiverem conteúdo, usar deles
    if (editorHTML) {
        var editorContent = editorHTML.textContent || editorHTML.innerText;
        if (editorContent && editorContent.trim()) {
            htmlContent = editorContent;
        }
    }
    if (editorCSS && appFiles.css) {
        var editorContent = editorCSS.textContent || editorCSS.innerText;
        if (editorContent && editorContent.trim()) {
            cssContent = editorContent;
        }
    }
    if (editorJS && appFiles.js) {
        var editorContent = editorJS.textContent || editorJS.innerText;
        if (editorContent && editorContent.trim()) {
            jsContent = editorContent;
        }
    }
    
    console.log('Conteúdo obtido:', {
        htmlLength: htmlContent.length,
        cssLength: cssContent.length,
        jsLength: jsContent.length
    });
    
    // Atualizar conteúdo nos arquivos
    appFiles.html.content = htmlContent;
    if (appFiles.css) appFiles.css.content = cssContent;
    if (appFiles.js) appFiles.js.content = jsContent;
    
    // Criar HTML completo com CSS e JS inline
    var htmlDoc;
    try {
        htmlDoc = new DOMParser().parseFromString(htmlContent, 'text/html');
        
        // Verificar se há erros de parse
        var parserError = htmlDoc.querySelector('parsererror');
        if (parserError) {
            console.error('Erro no parse do HTML:', parserError.textContent);
            // Continuar mesmo assim, pode ser um aviso
        }
    } catch (e) {
        console.error('Erro ao fazer parse do HTML:', e);
        // Tentar criar um HTML básico com o conteúdo
        htmlDoc = document.implementation.createHTMLDocument();
        htmlDoc.documentElement.innerHTML = htmlContent.replace(/<!DOCTYPE[^>]*>/i, '').replace(/<html[^>]*>/i, '').replace(/<\/html>/i, '');
    }
    
    // Coletar todos os CSS e JS referenciados no HTML
    var allCSS = cssContent || '';
    var allJS = jsContent || '';
    
    // Processar links CSS - tentar encontrar nos arquivos carregados
    var linkTags = htmlDoc.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < linkTags.length; i++) {
        var href = linkTags[i].getAttribute('href');
        if (href) {
            // Tentar encontrar o arquivo CSS nos arquivos carregados
            var fileName = href.split('/').pop().split('\\').pop().split('?')[0]; // Remover query string
            for (var path in virtualServerFiles.files) {
                var file = virtualServerFiles.files[path];
                if (file.type === 'css' && (file.name === fileName || path.indexOf(fileName) !== -1)) {
                    // Adicionar ao CSS total
                    if (allCSS) {
                        allCSS = allCSS + '\n\n/* === ' + file.name + ' === */\n' + file.content;
                    } else {
                        allCSS = file.content;
                    }
                    break;
                }
            }
        }
        linkTags[i].remove();
    }
    
    // Processar scripts externos - tentar encontrar nos arquivos carregados
    var scriptTags = htmlDoc.querySelectorAll('script[src]');
    for (var i = 0; i < scriptTags.length; i++) {
        var src = scriptTags[i].getAttribute('src');
        if (src) {
            // Tentar encontrar o arquivo JS nos arquivos carregados
            var fileName = src.split('/').pop().split('\\').pop().split('?')[0]; // Remover query string
            for (var path in virtualServerFiles.files) {
                var file = virtualServerFiles.files[path];
                if (file.type === 'js' && (file.name === fileName || path.indexOf(fileName) !== -1)) {
                    // Adicionar ao JS total
                    if (allJS) {
                        allJS = allJS + '\n\n// === ' + file.name + ' ===\n' + file.content;
                    } else {
                        allJS = file.content;
                    }
                    break;
                }
            }
        }
        scriptTags[i].remove();
    }
    
    // Remover estilos e scripts existentes do DevTools (para evitar duplicação)
    var existingStyles = htmlDoc.querySelectorAll('style[data-devtools]');
    for (var i = 0; i < existingStyles.length; i++) {
        existingStyles[i].remove();
    }
    var existingScripts = htmlDoc.querySelectorAll('script[data-devtools]');
    for (var i = 0; i < existingScripts.length; i++) {
        existingScripts[i].remove();
    }
    
    // Adicionar CSS inline no head
    if (allCSS && allCSS.trim()) {
        var styleTag = htmlDoc.createElement('style');
        styleTag.setAttribute('data-devtools', 'true');
        styleTag.textContent = allCSS;
        if (htmlDoc.head) {
            htmlDoc.head.appendChild(styleTag);
        } else {
            // Se não tiver head, criar
            var head = htmlDoc.createElement('head');
            head.appendChild(styleTag);
            htmlDoc.documentElement.insertBefore(head, htmlDoc.documentElement.firstChild);
        }
    }
    
    // Adicionar JS inline no final do body
    if (allJS && allJS.trim()) {
        var scriptTag = htmlDoc.createElement('script');
        scriptTag.setAttribute('data-devtools', 'true');
        scriptTag.textContent = allJS;
        if (htmlDoc.body) {
            htmlDoc.body.appendChild(scriptTag);
        } else {
            // Se não tiver body, criar
            var body = htmlDoc.createElement('body');
            body.appendChild(scriptTag);
            htmlDoc.documentElement.appendChild(body);
        }
    }
    
    // Converter de volta para string
    var fullHtml = '<!DOCTYPE html>\n' + htmlDoc.documentElement.outerHTML;
    
    console.log('HTML completo gerado, tamanho:', fullHtml.length);
    
    // Criar novo Blob e URL
    var blob = new Blob([fullHtml], { type: 'text/html' });
    var blobUrl = URL.createObjectURL(blob);
    
    console.log('Blob URL criado:', blobUrl);
    
    // Atualizar iframe
    if (previewFrame) {
        console.log('Atualizando iframe com blob URL');
        previewFrame.src = blobUrl;
        virtualServerBlobUrls.html = blobUrl;
        
        // Reconfigurar inspetor quando iframe carregar
        previewFrame.addEventListener('load', function() {
            console.log('Iframe carregado com sucesso');
            try {
                if (inspectorMode) {
                    setTimeout(setupInspector, 100);
                }
            } catch (e) {
                console.warn('Erro ao configurar inspetor:', e);
            }
        }, { once: true });
        
        // Adicionar listener de erro
        previewFrame.addEventListener('error', function(e) {
            console.error('Erro ao carregar iframe:', e);
        }, { once: true });
    } else {
        console.error('previewFrame não encontrado');
    }
}

// Configurar event listeners com verificação de existência
function setupEventListeners() {
    if (!appSelector || !btnReload || !btnToggleInspector || !btnFullscreenPreview || 
        !btnFormat || !btnClear || !tabButtons || !editorHTML || !editorCSS || !editorJS) {
        console.error('Elementos necessários não encontrados para configurar event listeners');
        return;
    }
    
    // Seletor de app
    appSelector.addEventListener('change', function(e) {
        currentApp = e.target.value;
        try {
            if (typeof Storage !== 'undefined' && localStorage) {
                localStorage.setItem('devtools-last-app', currentApp);
            }
        } catch (err) {
            console.warn('localStorage não disponível:', err);
        }
        loadApp(currentApp);
    });

    // Botão servidor
    if (btnServer) {
        btnServer.addEventListener('click', function() {
            openServerModal();
        });
    }

    // Botão fechar modal servidor
    if (btnCloseServerModal) {
        btnCloseServerModal.addEventListener('click', function() {
            closeServerModal();
        });
    }

    // Fechar modal ao clicar fora
    if (serverModal) {
        serverModal.addEventListener('click', function(e) {
            if (e.target === serverModal) {
                closeServerModal();
            }
        });
    }

    // Botão do banner para abrir servidor
    if (btnOpenServerFromBanner) {
        btnOpenServerFromBanner.addEventListener('click', function() {
            openServerModal();
        });
    }

    // Botão para dispensar banner
    if (btnDismissBanner) {
        btnDismissBanner.addEventListener('click', function() {
            if (fileProtocolBanner) {
                fileProtocolBanner.style.display = 'none';
                try {
                    localStorage.setItem('devtools-banner-dismissed', 'true');
                } catch (e) {
                    // Ignorar erro de localStorage
                }
            }
        });
    }

    // Botão recarregar
    btnReload.addEventListener('click', function() {
        loadApp(currentApp);
    });

    // Botão inspetor
    btnToggleInspector.addEventListener('click', function() {
        toggleInspector();
    });

    // Botão tela cheia
    btnFullscreenPreview.addEventListener('click', function() {
        toggleFullscreen();
    });

    // Botão atualizar preview
    btnFormat.addEventListener('click', function() {
        updatePreview();
    });

    // Botão limpar
    btnClear.addEventListener('click', function() {
        clearChanges();
    });

    // Tabs (com suporte para navegadores antigos)
    if (tabButtons && tabButtons.length) {
        for (var i = 0; i < tabButtons.length; i++) {
            (function(btn) {
                btn.addEventListener('click', function() {
                    var tab = btn.getAttribute('data-tab') || (btn.dataset && btn.dataset.tab);
                    if (tab) {
                        switchTab(tab);
                    }
                });
            })(tabButtons[i]);
        }
    }

    // Editores - highlight de palavras e mudanças
    [editorHTML, editorCSS, editorJS].forEach(function(editor) {
        // Seleção de palavras (duplo clique ou seleção manual)
        editor.addEventListener('mouseup', function() {
            setTimeout(function() {
                handleWordSelection();
            }, 50);
        });
        
        editor.addEventListener('dblclick', function() {
            setTimeout(function() {
                handleWordSelection();
            }, 50);
        });
        
        // Atualização automática do preview enquanto digita
        editor.addEventListener('input', function() {
            // Debounce para aplicar mudanças
            clearTimeout(window.devtoolsChangeTimeout);
            window.devtoolsChangeTimeout = setTimeout(function() {
                handleCodeChange();
                applySyntaxHighlighting();
                // Destacar palavras após atualizar
                setTimeout(function() {
                    handleWordSelection();
                }, 100);
            }, 300); // Aguarda 300ms após parar de digitar (mais rápido)
        });
        
        editor.addEventListener('scroll', syncScroll);
    });

    // Preview frame - carregar scripts quando iframe carregar
    previewFrame.addEventListener('load', () => {
        try {
            setupTouchGestures();
            if (inspectorMode) {
                setupInspector();
            }
        } catch (e) {
            // Ignorar erros de CORS ao acessar iframe
            console.warn('Erro ao configurar preview:', e);
        }
    });
}

// Carregar app
async function loadApp(appPath) {
    try {
        // Verificar se estamos em file:// (não funciona com fetch)
        const isLocalFile = window.location.protocol === 'file:';
        
        if (isLocalFile) {
            // Em ambiente local, carregar o arquivo via FileReader
            // para poder injetar um script que coleta os recursos automaticamente
            console.log('Modo file:// - carregando arquivo para injetar script coletor');
            
            // Ajustar caminho relativo
            let iframePath = appPath;
            if (!iframePath.startsWith('../') && appPath !== 'index.html') {
                iframePath = '../' + appPath;
            } else if (appPath === 'index.html') {
                iframePath = '../index.html';
            }
            
            // Tentar carregar o arquivo HTML via FileReader
            // Isso requer que o usuário selecione o arquivo, mas depois funciona automaticamente
            loadHTMLFileForInjection(iframePath, appPath);
            
            return;
        }
        
        // Carregar HTML
        const htmlResponse = await fetch(appPath);
        if (!htmlResponse.ok) {
            throw new Error(`HTTP ${htmlResponse.status}: ${htmlResponse.statusText}`);
        }
        originalHTML = await htmlResponse.text();

        // Extrair caminhos de CSS e JS do HTML
        const htmlDoc = new DOMParser().parseFromString(originalHTML, 'text/html');
        
        // Encontrar CSS
        const cssLinks = htmlDoc.querySelectorAll('link[rel="stylesheet"]');
        let cssContent = '';
        for (const link of cssLinks) {
            let cssPath = link.href;
            // Remover protocolo e domínio se presente
            if (cssPath.startsWith('http://') || cssPath.startsWith('https://')) {
                const url = new URL(cssPath);
                cssPath = url.pathname.substring(1); // Remove barra inicial
            } else if (cssPath.startsWith('//')) {
                cssPath = cssPath.substring(2);
            } else if (cssPath.startsWith('/')) {
                cssPath = cssPath.substring(1);
            }
            
            // Resolver caminho relativo
            if (!cssPath.startsWith('http')) {
                const basePath = appPath.substring(0, appPath.lastIndexOf('/') + 1);
                if (cssPath.startsWith('../')) {
                    cssPath = cssPath.replace('../', '');
                } else if (!cssPath.startsWith('assets/') && !cssPath.startsWith(basePath)) {
                    cssPath = basePath + cssPath;
                }
            }
            
            try {
                const cssResponse = await fetch(cssPath);
                cssContent += await cssResponse.text() + '\n\n';
            } catch (e) {
                console.warn('CSS não encontrado:', cssPath, e);
            }
        }
        originalCSS = cssContent;

        // Encontrar JS
        const jsScripts = htmlDoc.querySelectorAll('script[src]');
        let jsContent = '';
        for (const script of jsScripts) {
            let jsPath = script.src;
            // Remover protocolo e domínio se presente
            if (jsPath.startsWith('http://') || jsPath.startsWith('https://')) {
                const url = new URL(jsPath);
                jsPath = url.pathname.substring(1);
            } else if (jsPath.startsWith('//')) {
                jsPath = jsPath.substring(2);
            } else if (jsPath.startsWith('/')) {
                jsPath = jsPath.substring(1);
            }
            
            // Ignorar site-config.js e outros externos
            if (!jsPath.includes('site-config.js') && !jsPath.includes('http') && !jsPath.includes('cdn')) {
                // Resolver caminho relativo
                if (!jsPath.startsWith('http')) {
                    const basePath = appPath.substring(0, appPath.lastIndexOf('/') + 1);
                    if (jsPath.startsWith('../')) {
                        jsPath = jsPath.replace('../', '');
                    } else if (!jsPath.startsWith('assets/') && !jsPath.startsWith(basePath)) {
                        jsPath = basePath + jsPath;
                    }
                }
                
                try {
                    const jsResponse = await fetch(jsPath);
                    jsContent += await jsResponse.text() + '\n\n';
                } catch (e) {
                    console.warn('JS não encontrado:', jsPath, e);
                }
            }
        }
        originalJS = jsContent;

        // Atualizar editores
        updateEditors();
        
        // Atualizar preview (ajustar caminho relativo se necessário)
        let iframePath = appPath;
        if (!iframePath.startsWith('http') && !iframePath.startsWith('../') && appPath !== 'index.html') {
            iframePath = '../' + appPath;
        } else if (appPath === 'index.html') {
            iframePath = '../index.html';
        }
        previewFrame.src = iframePath;

        // Aplicar syntax highlighting
        setTimeout(() => {
            applySyntaxHighlighting();
        }, 100);

    } catch (error) {
        console.error('Erro ao carregar app:', error);
        
        // Verificar se é erro de CORS (arquivo local)
        const isCorsError = error.message.includes('Failed to fetch') || 
                           error.message.includes('CORS') ||
                           window.location.protocol === 'file:';
        
        if (isCorsError) {
            // Tentar carregar o iframe diretamente mesmo com erro
            // Ajustar caminho relativo se necessário
            let iframePath = appPath;
            if (!iframePath.startsWith('../') && appPath !== 'index.html') {
                iframePath = '../' + appPath;
            } else if (appPath === 'index.html') {
                iframePath = '../index.html';
            }
            previewFrame.src = iframePath;
            
            // Mostrar mensagem informativa nos editores
            var serverMessage = '⚠️ EDIÇÃO DE CÓDIGO NÃO DISPONÍVEL\n\n' +
                              'Erro de CORS detectado. Você precisa usar um servidor local.\n\n' +
                              '👉 Clique no botão 🌐 no header acima para iniciar um servidor\n\n' +
                              '👉 Use o Servidor Virtual JavaScript (automático, sem instalação)\n' +
                              '👉 Clique no botão 🌐 no header e selecione "Iniciar Servidor Virtual"\n\n' +
                              '📱 O preview acima deve funcionar normalmente.';
            
            editorHTML.textContent = serverMessage;
            editorCSS.textContent = serverMessage;
            editorJS.textContent = serverMessage;
            
            // Mostrar banner se ainda não estiver visível
            if (fileProtocolBanner && fileProtocolBanner.style.display === 'none') {
                fileProtocolBanner.style.display = 'flex';
            }
            
            // Destacar o botão de servidor
            if (btnServer) {
                btnServer.style.animation = 'pulse 2s infinite';
                btnServer.style.boxShadow = '0 0 10px rgba(0, 122, 204, 0.5)';
            }
        } else {
            // Outro tipo de erro
            alert('Erro ao carregar o app: ' + error.message + '\n\nVerifique o console para mais detalhes.');
        }
    }
}

// Atualizar editores
function updateEditors() {
    editorHTML.textContent = originalHTML;
    editorCSS.textContent = originalCSS;
    editorJS.textContent = originalJS;
    applySyntaxHighlighting();
}

// Alternar tab
function switchTab(tab) {
    currentTab = tab;
    
    // Atualizar botões
    tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Atualizar editores
    document.querySelectorAll('.code-editor').forEach(editor => {
        editor.classList.toggle('active', editor.id === `editor${tab.toUpperCase()}`);
    });

    // Aplicar highlight
    applySyntaxHighlighting();
}

// Aplicar syntax highlighting
function applySyntaxHighlighting() {
    try {
        const editor = document.getElementById(`editor${currentTab.toUpperCase()}`);
        if (!editor) {
            console.warn('Editor não encontrado para tab:', currentTab);
            return;
        }

        // Limpar highlights de palavras antes de aplicar syntax highlighting
        clearWordHighlights();

    // Obter texto puro (sem HTML)
    let content = editor.textContent || editor.innerText;
    
    if (currentTab === 'html') {
        content = highlightHTML(content);
    } else if (currentTab === 'css') {
        content = highlightCSS(content);
    } else if (currentTab === 'js') {
        content = highlightJS(content);
    }

    // Preservar seleção
    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    let startOffset = 0;
    let endOffset = 0;
    
    if (range && range.commonAncestorContainer && 
        (range.commonAncestorContainer === editor || editor.contains(range.commonAncestorContainer))) {
        try {
            // Calcular offset no texto puro
            const textBefore = editor.textContent.substring(0, range.startOffset);
            startOffset = textBefore.length;
            const textAfter = editor.textContent.substring(0, range.endOffset);
            endOffset = textAfter.length;
        } catch (e) {
            // Ignorar erros ao calcular offset
            console.warn('Erro ao preservar seleção:', e);
        }
    }

    editor.innerHTML = content;

    // Restaurar seleção aproximada
    if (range && startOffset > 0 && selection) {
        try {
            const walker = document.createTreeWalker(
                editor,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );
            
            let currentOffset = 0;
            let startNode = null;
            let endNode = null;
            let startNodeOffset = 0;
            let endNodeOffset = 0;
            
            let node;
            while (node = walker.nextNode()) {
                const nodeLength = node.textContent.length;
                if (!startNode && currentOffset + nodeLength >= startOffset) {
                    startNode = node;
                    startNodeOffset = startOffset - currentOffset;
                }
                if (!endNode && currentOffset + nodeLength >= endOffset) {
                    endNode = node;
                    endNodeOffset = endOffset - currentOffset;
                    break;
                }
                currentOffset += nodeLength;
            }
            
            if (startNode && endNode && selection) {
                const newRange = document.createRange();
                newRange.setStart(startNode, Math.min(startNodeOffset, startNode.textContent.length));
                newRange.setEnd(endNode, Math.min(endNodeOffset, endNode.textContent.length));
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        } catch (e) {
            // Ignorar erros de seleção
            console.warn('Erro ao restaurar seleção:', e);
        }
    }
    } catch (e) {
        console.error('Erro em applySyntaxHighlighting:', e);
        // Não propagar o erro para não quebrar a aplicação
    }
}

// Highlight HTML
function highlightHTML(html) {
    return html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/(&lt;\/?)([\w-]+)(\s|&gt;)/g, '$1<span class="tag">$2</span>$3')
        .replace(/(\w+)="([^"]*)"/g, '<span class="attribute">$1</span>="<span class="value">$2</span>"')
        .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="comment">$1</span>');
}

// Highlight CSS
function highlightCSS(css) {
    return css
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/([\w-]+)(\s*)({)/g, '<span class="tag">$1</span>$2$3')
        .replace(/([\w-]+)(\s*:)/g, '<span class="attribute">$1</span>$2')
        .replace(/(:\s*)([^;]+)(;)/g, '$1<span class="value">$2</span>$3')
        .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="comment">$1</span>');
}

// Highlight JavaScript
function highlightJS(js) {
    const keywords = ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'class', 'extends', 'import', 'export', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'super', 'typeof', 'instanceof', 'true', 'false', 'null', 'undefined'];
    
    let highlighted = js
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Keywords
    keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'g');
        highlighted = highlighted.replace(regex, `<span class="keyword">${keyword}</span>`);
    });

    // Strings
    highlighted = highlighted.replace(/(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="string">$1$2$1</span>');

    // Comments
    highlighted = highlighted.replace(/(\/\/.*$)/gm, '<span class="comment">$1</span>');
    highlighted = highlighted.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="comment">$1</span>');

    // Functions
    highlighted = highlighted.replace(/(\w+)(\s*\()/g, (match, func, paren) => {
        if (!keywords.includes(func)) {
            return `<span class="function">${func}</span>${paren}`;
        }
        return match;
    });

    // Numbers
    highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>');

    return highlighted;
}

// Seleção de palavras
function handleWordSelection(e) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();

    // Remover highlights anteriores
    clearWordHighlights();

    if (selectedText && selectedText.length > 0 && !selectedText.includes(' ')) {
        // Destacar palavra selecionada e todas as ocorrências
        highlightWordOccurrences(selectedText);
    }
}

// Destacar ocorrências da palavra (versão simplificada e melhorada)
function highlightWordOccurrences(word) {
    var editor = document.getElementById('editor' + currentTab.toUpperCase());
    if (!editor) return;

    // Obter conteúdo HTML atual
    var content = editor.innerHTML;
    
    // Escapar a palavra para regex
    var escapedWord = escapeRegex(word);
    var regex = new RegExp('\\b' + escapedWord + '\\b', 'gi');
    
    // Substituir todas as ocorrências, mas apenas em texto (não dentro de tags)
    // Usar uma abordagem mais simples: substituir no texto puro e depois reaplicar syntax highlighting
    var textContent = editor.textContent || editor.innerText;
    var matches = [];
    var match;
    
    // Encontrar todas as ocorrências
    while ((match = regex.exec(textContent)) !== null) {
        matches.push({
            index: match.index,
            length: match[0].length
        });
    }
    
    if (matches.length === 0) return;
    
    // Criar um marcador temporário único
    var marker = '___WORD_HIGHLIGHT_' + Date.now() + '___';
    var markedText = textContent;
    var offset = 0;
    
    // Marcar todas as ocorrências no texto puro
    for (var i = 0; i < matches.length; i++) {
        var m = matches[i];
        var before = markedText.substring(0, m.index + offset);
        var wordText = markedText.substring(m.index + offset, m.index + offset + m.length);
        var after = markedText.substring(m.index + offset + m.length);
        markedText = before + marker + wordText + marker + after;
        offset += marker.length * 2;
    }
    
    // Reaplicar syntax highlighting no texto marcado
    var highlighted;
    if (currentTab === 'html') {
        highlighted = highlightHTML(markedText);
    } else if (currentTab === 'css') {
        highlighted = highlightCSS(markedText);
    } else if (currentTab === 'js') {
        highlighted = highlightJS(markedText);
    } else {
        highlighted = markedText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    
    // Substituir marcadores por spans de highlight
    var markerRegex = new RegExp(escapeRegex(marker) + '([^' + marker.charAt(0) + ']+)' + escapeRegex(marker), 'g');
    highlighted = highlighted.replace(markerRegex, '<span class="word-highlight">$1</span>');
    
    editor.innerHTML = highlighted;
    wordHighlights = matches;
}

// Verificar se está dentro de uma tag HTML
function isInsideTag(text) {
    const lastOpen = text.lastIndexOf('<');
    const lastClose = text.lastIndexOf('>');
    return lastOpen > lastClose;
}

// Limpar highlights de palavras
function clearWordHighlights() {
    const editor = document.getElementById(`editor${currentTab.toUpperCase()}`);
    if (!editor) return;

    // Remover todos os spans de highlight
    const highlights = editor.querySelectorAll('.word-highlight');
    highlights.forEach(span => {
        const parent = span.parentNode;
        if (parent) {
            const textNode = document.createTextNode(span.textContent);
            parent.replaceChild(textNode, span);
            parent.normalize();
        }
    });

    wordHighlights = [];
}

// Escapar regex
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Mudança no código
function handleCodeChange() {
    const editor = document.getElementById(`editor${currentTab.toUpperCase()}`);
    if (!editor) return;

    let content = editor.textContent || editor.innerText;
    
    // Atualizar arquivo virtual se estiver ativo
    if (virtualServerActive) {
        if (virtualServerFiles && virtualServerFiles.currentApp) {
            var appFiles = findAppFiles(virtualServerFiles.currentApp);
            if (appFiles) {
                if (currentTab === 'html' && appFiles.html) {
                    appFiles.html.content = content;
                } else if (currentTab === 'css' && appFiles.css) {
                    appFiles.css.content = content;
                } else if (currentTab === 'js' && appFiles.js) {
                    appFiles.js.content = content;
                }
            }
        }
        
        // Aplicar mudanças no servidor virtual
        applyVirtualServerChanges();
    } else {
        // Aplicar mudanças temporárias ao preview (método normal)
        applyTemporaryChanges();
    }
}


// Aplicar mudanças temporárias
function applyTemporaryChanges() {
    try {
        const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        if (!iframeDoc) return;

        // Obter conteúdo atual dos editores (texto puro, sem HTML de highlight)
        const htmlContent = editorHTML.textContent || editorHTML.innerText;
        const cssContent = editorCSS.textContent || editorCSS.innerText;
        const jsContent = editorJS.textContent || editorJS.innerText;

        // Criar blob URL para o HTML completo
        const fullHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${cssContent}</style>
</head>
<body>
${htmlContent.replace(/<!DOCTYPE[^>]*>|<html[^>]*>|<head[^>]*>[\s\S]*?<\/head>|<body[^>]*>/gi, '').replace(/<\/body>|<\/html>/gi, '')}
<script>${jsContent}</script>
</body>
</html>
        `;

        // Criar blob e atualizar iframe
        const blob = new Blob([fullHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        previewFrame.src = url;

        // Limpar URL após carregar
        previewFrame.addEventListener('load', () => {
            URL.revokeObjectURL(url);
            // Reconfigurar inspetor se estiver ativo
            if (inspectorMode) {
                setTimeout(setupInspector, 100);
            }
        }, { once: true });

    } catch (error) {
        console.error('Erro ao aplicar mudanças:', error);
    }
}

// Alternar inspetor
function toggleInspector() {
    inspectorMode = !inspectorMode;
    previewContent.classList.toggle('inspector-mode', inspectorMode);
    btnToggleInspector.textContent = inspectorMode ? '🔍✓' : '🔍';
    
    // Enviar mensagem para iframe
    try {
        const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        if (iframeDoc && iframeDoc.defaultView) {
            iframeDoc.defaultView.postMessage({
                type: 'INSPECTOR_TOGGLE',
                active: inspectorMode
            }, '*');
        }
    } catch (e) {
        // Ignorar erros de cross-origin
    }
    
    if (inspectorMode) {
        setTimeout(setupInspector, 100);
    } else {
        removeInspector();
    }
}

// Configurar detecção de gestos touch (sempre ativo)
function setupTouchGestures() {
    try {
        // Verificar se pode acessar o iframe (pode falhar por CORS em file://)
        let iframeDoc;
        try {
            iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        } catch (e) {
            // Erro de CORS ao acessar iframe - ignorar silenciosamente
            // Isso acontece quando o arquivo é aberto localmente (file://)
            return;
        }
        
        if (!iframeDoc) {
            setTimeout(setupTouchGestures, 500);
            return;
        }

        // Verificar se já foi injetado
        if (iframeDoc.getElementById('devtools-touch-gestures')) return;

        // Adicionar script de detecção de gestos
        const touchScript = iframeDoc.createElement('script');
        touchScript.id = 'devtools-touch-gestures';
        touchScript.textContent = `
            (function() {
                // ============================================
                // DETECÇÃO DE GESTOS TOUCH
                // ============================================
                let touchStartX = 0;
                let touchStartY = 0;
                let touchStartTime = 0;
                let touchTarget = null;
                let isScrolling = false;
                let touchMoved = false;
                let touchMoveThreshold = 10; // pixels
                let tapMaxDuration = 300; // ms
                let scrollThreshold = 0.6; // 60% do movimento deve ser vertical para ser considerado scroll
                let buttonClickTimeout = null;
                
                document.addEventListener('touchstart', function(e) {
                    const touch = e.touches[0];
                    touchStartX = touch.clientX;
                    touchStartY = touch.clientY;
                    touchStartTime = Date.now();
                    touchTarget = e.target;
                    touchMoved = false;
                    isScrolling = false;
                    
                    // Limpar timeout anterior se houver
                    if (buttonClickTimeout) {
                        clearTimeout(buttonClickTimeout);
                        buttonClickTimeout = null;
                    }
                    
                    // Se tocou em um botão e ficou parado, preparar para acionar
                    const isButton = touchTarget.tagName === 'BUTTON' || 
                                   touchTarget.classList.contains('arrow-btn') ||
                                   (touchTarget.onclick !== null && touchTarget.onclick !== undefined);
                    
                    if (isButton) {
                        // Aguardar um pouco para ver se vai mover (para scroll) ou ficar parado (para click)
                        buttonClickTimeout = setTimeout(function() {
                            if (!touchMoved && touchTarget === e.target) {
                                // Toque parado sobre botão - acionar
                                touchTarget.click();
                            }
                        }, 150); // Aguarda 150ms para ver se move
                    }
                }, { passive: true });
                
                document.addEventListener('touchmove', function(e) {
                    const touch = e.touches[0];
                    const deltaX = Math.abs(touch.clientX - touchStartX);
                    const deltaY = Math.abs(touch.clientY - touchStartY);
                    const totalDelta = deltaX + deltaY;
                    
                    // Se moveu mais que o threshold, considera movimento
                    if (totalDelta > touchMoveThreshold) {
                        touchMoved = true;
                        
                        // Cancelar click de botão se moveu
                        if (buttonClickTimeout) {
                            clearTimeout(buttonClickTimeout);
                            buttonClickTimeout = null;
                        }
                        
                        // Determinar se é scroll (movimento majoritariamente vertical)
                        if (totalDelta > 0) {
                            const verticalRatio = deltaY / totalDelta;
                            
                            if (verticalRatio > scrollThreshold) {
                                // Movimento majoritariamente vertical = SCROLL
                                isScrolling = true;
                                
                                // Se o target é um botão ou slider, prevenir ação padrão
                                if (touchTarget) {
                                    const isButton = touchTarget.tagName === 'BUTTON' || 
                                                   touchTarget.classList.contains('arrow-btn') ||
                                                   (touchTarget.onclick !== null && touchTarget.onclick !== undefined);
                                    const isSlider = touchTarget.tagName === 'INPUT' && 
                                                   touchTarget.type === 'range';
                                    
                                    if (isButton || isSlider) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }
                                }
                            } else {
                                // Movimento majoritariamente horizontal
                                isScrolling = false;
                                
                                // Se for slider, permitir movimento horizontal
                                if (touchTarget && touchTarget.tagName === 'INPUT' && touchTarget.type === 'range') {
                                    // Calcular posição do slider baseado na posição X do toque
                                    const slider = touchTarget;
                                    const rect = slider.getBoundingClientRect();
                                    const sliderWidth = rect.width;
                                    const touchX = touch.clientX - rect.left;
                                    const min = parseFloat(slider.min) || 0;
                                    const max = parseFloat(slider.max) || 100;
                                    const percentage = Math.max(0, Math.min(1, touchX / sliderWidth));
                                    const newValue = min + (max - min) * percentage;
                                    
                                    // Atualizar valor do slider
                                    slider.value = newValue;
                                    
                                    // Disparar evento input
                                    slider.dispatchEvent(new Event('input', { bubbles: true }));
                                    slider.dispatchEvent(new Event('change', { bubbles: true }));
                                    
                                    // Prevenir scroll durante movimento do slider
                                    e.preventDefault();
                                    e.stopPropagation();
                                } else {
                                    // Para outros elementos, prevenir se for botão
                                    if (touchTarget && (touchTarget.tagName === 'BUTTON' || touchTarget.classList.contains('arrow-btn'))) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }
                                }
                            }
                        }
                    }
                }, { passive: false });
                
                document.addEventListener('touchend', function(e) {
                    // Cancelar timeout de click de botão
                    if (buttonClickTimeout) {
                        clearTimeout(buttonClickTimeout);
                        buttonClickTimeout = null;
                    }
                    
                    const touchDuration = Date.now() - touchStartTime;
                    const touch = e.changedTouches[0];
                    const deltaX = Math.abs(touch.clientX - touchStartX);
                    const deltaY = Math.abs(touch.clientY - touchStartY);
                    const totalDelta = deltaX + deltaY;
                    
                    // Determinar tipo de gesto
                    if (!touchMoved || totalDelta < touchMoveThreshold) {
                        // TAP RÁPIDO - sempre acionar (botões, sliders, etc)
                        if (touchDuration < tapMaxDuration) {
                            // Para sliders, mover para posição do toque
                            if (touchTarget && touchTarget.tagName === 'INPUT' && touchTarget.type === 'range') {
                                const slider = touchTarget;
                                const rect = slider.getBoundingClientRect();
                                const sliderWidth = rect.width;
                                const touchX = touch.clientX - rect.left;
                                const min = parseFloat(slider.min) || 0;
                                const max = parseFloat(slider.max) || 100;
                                const percentage = Math.max(0, Math.min(1, touchX / sliderWidth));
                                const newValue = min + (max - min) * percentage;
                                
                                slider.value = newValue;
                                slider.dispatchEvent(new Event('input', { bubbles: true }));
                                slider.dispatchEvent(new Event('change', { bubbles: true }));
                                
                                e.preventDefault();
                                e.stopPropagation();
                            }
                            // Para outros elementos, permitir ação padrão (click)
                            return;
                        }
                    } else if (touchMoved && !isScrolling) {
                        // Movimento horizontal - ação já foi tratada no touchmove
                        if (touchTarget && touchTarget.tagName === 'INPUT' && touchTarget.type === 'range') {
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                        }
                    } else if (isScrolling) {
                        // SCROLL - prevenir ações de botões/sliders
                        if (touchTarget) {
                            const isButton = touchTarget.tagName === 'BUTTON' || 
                                           touchTarget.classList.contains('arrow-btn');
                            const isSlider = touchTarget.tagName === 'INPUT' && 
                                           touchTarget.type === 'range';
                            
                            if (isButton || isSlider) {
                                e.preventDefault();
                                e.stopPropagation();
                                e.stopImmediatePropagation();
                            }
                        }
                    }
                    
                    // Reset
                    touchStartX = 0;
                    touchStartY = 0;
                    touchStartTime = 0;
                    touchTarget = null;
                    touchMoved = false;
                    isScrolling = false;
                }, { passive: false });
                
                document.addEventListener('touchcancel', function(e) {
                    // Reset em caso de cancelamento
                    if (buttonClickTimeout) {
                        clearTimeout(buttonClickTimeout);
                        buttonClickTimeout = null;
                    }
                    touchStartX = 0;
                    touchStartY = 0;
                    touchStartTime = 0;
                    touchTarget = null;
                    touchMoved = false;
                    isScrolling = false;
                });
            })();
        `;
        iframeDoc.head.appendChild(touchScript);

    } catch (error) {
        console.error('Erro ao configurar gestos touch:', error);
    }
}

// Configurar inspetor
function setupInspector() {
    if (!inspectorMode) return;
    
    try {
        // Verificar se pode acessar o iframe (pode falhar por CORS em file://)
        let iframeDoc;
        try {
            iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        } catch (e) {
            // Erro de CORS ao acessar iframe - ignorar silenciosamente
            // Isso acontece quando o arquivo é aberto localmente (file://)
            return;
        }
        
        if (!iframeDoc) {
            // Se o iframe ainda não carregou, tentar novamente após um delay
            setTimeout(setupInspector, 500);
            return;
        }

        // Verificar se já foi injetado
        if (iframeDoc.getElementById('devtools-inspector')) return;

        // Adicionar script de inspetor
        const inspectorScript = iframeDoc.createElement('script');
        inspectorScript.id = 'devtools-inspector';
        inspectorScript.textContent = `
            (function() {
                let inspectorActive = true;
                let highlightedElement = null;
                
                // Interceptar toques quando inspetor está ativo
                document.addEventListener('touchstart', function(e) {
                    if (!inspectorActive) return;
                    
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    const touch = e.touches[0];
                    const element = document.elementFromPoint(touch.clientX, touch.clientY);
                    if (element) {
                        // Enviar mensagem para o parent
                        window.parent.postMessage({
                            type: 'INSPECTOR_CLICK',
                            elementPath: getElementPath(element),
                            elementHTML: element.outerHTML.substring(0, 200)
                        }, '*');
                        
                        // Destacar elemento
                        if (highlightedElement) {
                            highlightedElement.style.outline = '';
                        }
                        element.style.outline = '2px solid #007acc';
                        element.style.outlineOffset = '2px';
                        highlightedElement = element;
                    }
                }, true);
                
                // Interceptar cliques quando inspetor está ativo
                document.addEventListener('click', function(e) {
                    if (!inspectorActive) return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    // Enviar mensagem para o parent
                    window.parent.postMessage({
                        type: 'INSPECTOR_CLICK',
                        elementPath: getElementPath(e.target),
                        elementHTML: e.target.outerHTML.substring(0, 200)
                    }, '*');
                    
                    // Destacar elemento
                    if (highlightedElement) {
                        highlightedElement.style.outline = '';
                    }
                    e.target.style.outline = '2px solid #007acc';
                    e.target.style.outlineOffset = '2px';
                    highlightedElement = e.target;
                }, true);
                
                function getElementPath(element) {
                    const path = [];
                    while (element && element.nodeType === Node.ELEMENT_NODE) {
                        let selector = element.nodeName.toLowerCase();
                        if (element.id) {
                            selector += '#' + element.id;
                            path.unshift(selector);
                            break;
                        } else {
                            let sibling = element;
                            let nth = 1;
                            while (sibling.previousElementSibling) {
                                sibling = sibling.previousElementSibling;
                                if (sibling.nodeName === element.nodeName) nth++;
                            }
                            if (nth !== 1) selector += ':nth-of-type(' + nth + ')';
                            path.unshift(selector);
                        }
                        element = element.parentElement;
                    }
                    return path.join(' > ');
                }
                
                // Desativar quando necessário
                window.addEventListener('message', function(e) {
                    if (e.data.type === 'INSPECTOR_TOGGLE') {
                        inspectorActive = e.data.active;
                    }
                });
            })();
        `;
        iframeDoc.head.appendChild(inspectorScript);

        // Listener para mensagens do iframe
        window.addEventListener('message', (e) => {
            if (e.data.type === 'INSPECTOR_CLICK') {
                findElementInHTML(e.data.elementPath, e.data.elementHTML);
            }
        });

    } catch (error) {
        console.error('Erro ao configurar inspetor:', error);
    }
}

// Remover inspetor
function removeInspector() {
    try {
        const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        if (iframeDoc) {
            // Enviar mensagem para desativar inspetor no iframe
            iframeDoc.defaultView.postMessage({
                type: 'INSPECTOR_TOGGLE',
                active: false
            }, '*');
        }
    } catch (error) {
        console.error('Erro ao remover inspetor:', error);
    }
}

// Encontrar elemento no HTML
function findElementInHTML(path, html) {
    // Mudar para tab HTML
    switchTab('html');
    
    // Procurar por ID ou classe no HTML
    const editor = editorHTML;
    const content = editor.textContent || editor.innerText;
    
    // Tentar encontrar por ID primeiro
    const idMatch = path.match(/#([\w-]+)/);
    if (idMatch) {
        const id = idMatch[1];
        const regex = new RegExp(`id=["']${id}["']`, 'i');
        const match = content.search(regex);
        if (match !== -1) {
            // Scroll para a posição (aproximada)
            const lines = content.substring(0, match).split('\n');
            const lineNumber = lines.length;
            scrollToLine(editor, lineNumber);
        }
    }
    
    // Destacar visualmente (implementação básica)
    highlightInEditor(editor, html.substring(0, 50));
}

// Scroll para linha
function scrollToLine(editor, lineNumber) {
    const lineHeight = 20; // Aproximado
    const scrollTop = (lineNumber - 1) * lineHeight;
    editor.scrollTop = Math.max(0, scrollTop - 100);
}

// Destacar no editor
function highlightInEditor(editor, text) {
    // Implementação básica - pode ser melhorada
    const content = editor.textContent || editor.innerText;
    const index = content.indexOf(text);
    if (index !== -1) {
        // Criar range e selecionar
        const range = document.createRange();
        const textNode = editor.firstChild;
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
            range.setStart(textNode, index);
            range.setEnd(textNode, index + text.length);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

// Selecionar elemento
function selectElement(element) {
    selectedElement = element;
    
    // Destacar elemento no preview
    highlightElement(element);
    
    // Encontrar e destacar no HTML
    findAndHighlightInHTML(element);
}

// Destacar elemento
function highlightElement(element) {
    // Remover highlights anteriores
    try {
        const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        if (!iframeDoc) return;

        const previous = iframeDoc.querySelectorAll('.devtools-highlight');
        previous.forEach(el => {
            el.classList.remove('devtools-highlight');
            el.style.outline = '';
        });

        // Adicionar highlight
        element.classList.add('devtools-highlight');
        element.style.outline = '2px solid #007acc';
        element.style.outlineOffset = '2px';
    } catch (e) {
        console.error('Erro ao destacar elemento:', e);
    }
}

// Encontrar e destacar no HTML
function findAndHighlightInHTML(element) {
    // Obter caminho único do elemento
    const path = getElementPath(element);
    
    // Procurar no HTML
    switchTab('html');
    
    // Scroll para o elemento (implementação básica)
    // Em uma versão mais avançada, poderia fazer parsing do HTML e encontrar a linha exata
}

// Obter caminho único do elemento
function getElementPath(element) {
    const path = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
        let selector = element.nodeName.toLowerCase();
        if (element.id) {
            selector += `#${element.id}`;
            path.unshift(selector);
            break;
        } else {
            let sibling = element;
            let nth = 1;
            while (sibling.previousElementSibling) {
                sibling = sibling.previousElementSibling;
                if (sibling.nodeName === element.nodeName) nth++;
            }
            if (nth !== 1) selector += `:nth-of-type(${nth})`;
            path.unshift(selector);
        }
        element = element.parentElement;
    }
    return path.join(' > ');
}

// Alternar tela cheia
function toggleFullscreen() {
    previewPanel.classList.toggle('fullscreen');
    btnFullscreenPreview.textContent = previewPanel.classList.contains('fullscreen') ? '⛶' : '⛶';
}

// Atualizar preview (recarregar visualização)
function updatePreview() {
    if (virtualServerActive) {
        // Se estiver usando servidor virtual, aplicar mudanças
        applyVirtualServerChanges();
    } else {
        // Se estiver no modo normal, aplicar mudanças temporárias
        applyTemporaryChanges();
    }
    
    // Feedback visual
    if (btnFormat) {
        var originalText = btnFormat.textContent;
        btnFormat.textContent = '✓';
        btnFormat.style.color = '#4caf50';
        setTimeout(function() {
            btnFormat.textContent = originalText;
            btnFormat.style.color = '';
        }, 500);
    }
}

// Limpar mudanças
function clearChanges() {
    if (confirm('Deseja descartar todas as alterações e restaurar o código original?')) {
        updateEditors();
        previewFrame.src = currentApp;
    }
}

// Sincronizar scroll (para múltiplos editores se necessário)
function syncScroll() {
    // Implementação futura se necessário
}

