// ============================================
// BUG REPORT FORM SCRIPT
// ============================================
// NOTA: Este arquivo contém console.log intencionais para debug
// do sistema de envio de relatórios de bugs. Eles são úteis para
// diagnosticar problemas de envio ao Google Forms.

// Configuração do Google Forms
const USE_GOOGLE_FORMS = true;
const FORM_ACTION_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSc3Qo7Otct-L7mN2qS9r967oBol6n6gnsEJz2nfkz89sSpBcQ/formResponse';

// IDs dos campos do Google Form
// Configure manualmente aqui se a obtenção automática não funcionar
// Veja o arquivo OBTER_ENTRY_IDS.md para instruções
const GOOGLE_FORM_ENTRY_IDS_MANUAL = {
    description: 'entry.1073025523', // Descrição do Bug
    contact: 'entry.1357011976'      // Contato (opcional)
};

// IDs obtidos automaticamente (serão mesclados com os manuais)
let GOOGLE_FORM_ENTRY_IDS = {
    description: GOOGLE_FORM_ENTRY_IDS_MANUAL.description,
    contact: GOOGLE_FORM_ENTRY_IDS_MANUAL.contact
};

// Função para inicializar os Entry IDs (usa apenas os manuais devido a CORS)
function inicializarEntryIDs() {
    // Usa apenas os IDs manuais (obtenção automática bloqueada por CORS)
    GOOGLE_FORM_ENTRY_IDS = {
        description: GOOGLE_FORM_ENTRY_IDS_MANUAL.description,
        contact: GOOGLE_FORM_ENTRY_IDS_MANUAL.contact
    };
    
    if (GOOGLE_FORM_ENTRY_IDS.description) {
        console.log('✅ Entry IDs configurados:', GOOGLE_FORM_ENTRY_IDS);
        if (!GOOGLE_FORM_ENTRY_IDS.contact) {
            console.info('ℹ️ Campo "Contato" não configurado (opcional).');
        }
    } else {
        console.warn('⚠️ Entry ID da descrição não configurado! Configure em GOOGLE_FORM_ENTRY_IDS_MANUAL.');
        console.warn('📖 Veja o arquivo bugs/OBTER_ENTRY_IDS.md para instruções detalhadas.');
    }
    
    return GOOGLE_FORM_ENTRY_IDS;
}

// Idioma atual
const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido' };
let idiomaAtual = localStorage.getItem(SITE_LS.LANGUAGE_KEY) || 'pt-BR';

// Traduções
const traducoes = {
    'pt-BR': {
        'bug-title': '🐛 Reportar Bug',
        'bug-subtitle': 'Ajude-nos a melhorar reportando problemas encontrados',
        'bug-label-description': 'Descrição do Bug *',
        'bug-placeholder-description': 'Descreva o problema encontrado, o que você estava fazendo quando ocorreu, e o que você esperava que acontecesse...',
        'bug-label-contact': 'Contato para Resposta (Opcional)',
        'bug-placeholder-contact': 'seu@email.com',
        'bug-hint-contact': 'Se você quiser receber uma resposta sobre o bug reportado, informe seu email.',
        'bug-button-submit': '📤 Enviar Relatório',
        'bug-button-cancel': '← Voltar',
        'bug-success': '✅ Relatório enviado com sucesso! Obrigado por nos ajudar a melhorar.',
        'bug-thank-you': 'Obrigado pelo seu relatório! 🎉\n\nSua contribuição é muito importante para melhorarmos nossos aplicativos.\n\nRedirecionando para a página inicial...',
        'bug-error': '❌ Erro ao enviar relatório. Por favor, tente novamente ou entre em contato diretamente.',
        'bug-sending': '⏳ Enviando relatório...',
        'bug-required': 'Por favor, preencha todos os campos obrigatórios.',
        'app-mutuo-title': 'Mutuo - Calculadora de Empréstimos',
        'app-helice-title': 'Hélice - Calculadora de Passo',
        'app-solar-title': 'Energia Solar - Dimensionamento',
        'app-bitola-title': 'Bitola - Calculadora de Fios',
        'app-arcondicionado-title': 'Ar Condicionado - Dimensionamento',
        'app-aquecimento-title': 'Aquecimento Solar',
        'app-fazenda-title': 'Fazenda - Planejamento',
        'app-bugs-title': 'Reportar Bug',
        'app-about': 'Sobre mim',
        'footer': '💻 Reportar Bug - Engenharia Nata @ 2025'
    },
    'it-IT': {
        'bug-title': '🐛 Segnala Bug',
        'bug-subtitle': 'Aiutaci a migliorare segnalando i problemi riscontrati',
        'bug-label-description': 'Descrizione del Bug *',
        'bug-placeholder-description': 'Descrivi il problema riscontrato, cosa stavi facendo quando si è verificato e cosa ti aspettavi che accadesse...',
        'bug-label-contact': 'Contatto per Risposta (Opzionale)',
        'bug-placeholder-contact': 'tua@email.com',
        'bug-hint-contact': 'Se vuoi ricevere una risposta sul bug segnalato, fornisci la tua email.',
        'bug-button-submit': '📤 Invia Segnalazione',
        'bug-button-cancel': '← Indietro',
        'bug-success': '✅ Segnalazione inviata con successo! Grazie per averci aiutato a migliorare.',
        'bug-thank-you': 'Grazie per la tua segnalazione! 🎉\n\nIl tuo contributo è molto importante per migliorare le nostre applicazioni.\n\nReindirizzamento alla pagina iniziale...',
        'bug-error': '❌ Errore nell\'invio della segnalazione. Riprova o contattaci direttamente.',
        'bug-sending': '⏳ Invio segnalazione...',
        'bug-required': 'Si prega di compilare tutti i campi obbligatori.',
        'app-mutuo-title': 'Mutuo - Calcolatrice di Prestiti',
        'app-helice-title': 'Elica - Calcolatrice del Passo',
        'app-solar-title': 'Energia Solare - Dimensionamento',
        'app-bitola-title': 'Sezione Cavi - Calcolatrice di Fili',
        'app-arcondicionado-title': 'Climatizzatore - Dimensionamento',
        'app-aquecimento-title': 'Riscaldatore Solare',
        'app-fazenda-title': 'Fattoria - Pianificazione',
        'app-bugs-title': 'Segnala Bug',
        'app-about': 'Su di me',
        'footer': '💻 Segnala Bug - Engenharia Nata @ 2025'
    }
};

// Função para trocar idioma
function trocarIdioma(novoIdioma) {
    idiomaAtual = novoIdioma;
    localStorage.setItem(SITE_LS.LANGUAGE_KEY, novoIdioma);
    document.documentElement.lang = novoIdioma;
    
    document.querySelectorAll('[data-i18n]').forEach(elemento => {
        const chave = elemento.getAttribute('data-i18n');
        if (traducoes[novoIdioma] && traducoes[novoIdioma][chave]) {
            if (elemento.tagName === 'INPUT' || elemento.tagName === 'TEXTAREA') {
                elemento.placeholder = traducoes[novoIdioma][chave];
            } else {
                elemento.textContent = traducoes[novoIdioma][chave];
            }
        }
    });
    
    document.querySelectorAll('[data-i18n-placeholder]').forEach(elemento => {
        const chave = elemento.getAttribute('data-i18n-placeholder');
        if (traducoes[novoIdioma] && traducoes[novoIdioma][chave]) {
            elemento.placeholder = traducoes[novoIdioma][chave];
        }
    });
    
    // Atualiza botões de idioma
    document.querySelectorAll('.lang-btn').forEach(btn => {
        if (btn.getAttribute('data-lang') === novoIdioma) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Mostrar mensagem de status
function showStatus(type, message) {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.className = `status-message ${type}`;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

// Mostrar mensagem de agradecimento e redirecionar
function mostrarAgradecimentoERedirecionar() {
    const mensagem = traducoes[idiomaAtual]['bug-thank-you'];
    
    // Cria um overlay modal para a mensagem de agradecimento
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease-in;
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        padding: 2rem;
        border-radius: 12px;
        max-width: 500px;
        text-align: center;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease-out;
    `;
    
    const linhas = mensagem.split('\n\n');
    modal.innerHTML = `
        <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
        <h2 style="color: #2d9fa3; margin-bottom: 1rem; font-size: 1.5rem;">${linhas[0]}</h2>
        <p style="color: #666; margin-bottom: 0.5rem; line-height: 1.6;">${linhas[1]}</p>
        <p style="color: #999; font-size: 0.9rem; margin-top: 1rem;">${linhas[2]}</p>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Adiciona animações CSS se não existirem
    if (!document.getElementById('bug-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'bug-modal-styles';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(30px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Redireciona após 3 segundos
    setTimeout(() => {
        overlay.style.animation = 'fadeIn 0.3s ease-in reverse';
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 300);
    }, 3000);
}

// Enviar dados para Google Form via POST usando formulário HTML oculto
async function enviarParaGoogleForm(formData) {
    return new Promise((resolve, reject) => {
        // Garante que os Entry IDs estão inicializados
        if (!GOOGLE_FORM_ENTRY_IDS.description) {
            inicializarEntryIDs();
        }
        
        // Envia o formulário
        enviarFormularioOculto(formData, resolve, reject);
    });
}

// Função auxiliar para enviar usando formulário HTML oculto
function enviarFormularioOculto(formData, resolve, reject) {
    // Verifica se temos pelo menos o campo obrigatório (descrição)
    if (!GOOGLE_FORM_ENTRY_IDS.description) {
        console.error('❌ Entry ID da descrição não configurado! Configure em GOOGLE_FORM_ENTRY_IDS_MANUAL ou veja OBTER_ENTRY_IDS.md');
        reject(new Error('Entry ID da descrição não configurado. Configure manualmente ou veja OBTER_ENTRY_IDS.md para instruções.'));
        return;
    }
    
    // Cria um formulário HTML oculto
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = FORM_ACTION_URL;
    form.target = 'hidden_iframe';
    form.style.display = 'none';
    
    // Cria iframe oculto para receber a resposta
    let iframe = document.getElementById('hidden_iframe');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'hidden_iframe';
        iframe.name = 'hidden_iframe';
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
    }
    
    // Adiciona campos ao formulário
    // Campo Descrição (obrigatório)
    if (GOOGLE_FORM_ENTRY_IDS.description) {
        const inputDesc = document.createElement('input');
        inputDesc.type = 'hidden';
        inputDesc.name = GOOGLE_FORM_ENTRY_IDS.description;
        inputDesc.value = formData.description;
        form.appendChild(inputDesc);
        console.log(`✅ Enviando descrição (${formData.description.length} caracteres) para ${GOOGLE_FORM_ENTRY_IDS.description}`);
    }
    
    // Campo Contato (opcional - só envia se estiver configurado e preenchido)
    if (GOOGLE_FORM_ENTRY_IDS.contact && formData.contact && formData.contact.trim() && formData.contact !== 'Não informado') {
        const inputContact = document.createElement('input');
        inputContact.type = 'hidden';
        inputContact.name = GOOGLE_FORM_ENTRY_IDS.contact;
        inputContact.value = formData.contact.trim();
        form.appendChild(inputContact);
        console.log(`✅ Enviando contato: "${formData.contact}" para ${GOOGLE_FORM_ENTRY_IDS.contact}`);
    }
    
    // Adiciona campos obrigatórios do Google Forms
    const draftResponse = document.createElement('input');
    draftResponse.type = 'hidden';
    draftResponse.name = 'draftResponse';
    draftResponse.value = '[]';
    form.appendChild(draftResponse);
    
    const pageHistory = document.createElement('input');
    pageHistory.type = 'hidden';
    pageHistory.name = 'pageHistory';
    pageHistory.value = '0';
    form.appendChild(pageHistory);
    
    const fvv = document.createElement('input');
    fvv.type = 'hidden';
    fvv.name = 'fvv';
    fvv.value = '1';
    form.appendChild(fvv);
    
    const partialResponse = document.createElement('input');
    partialResponse.type = 'hidden';
    partialResponse.name = 'partialResponse';
    partialResponse.value = '[]';
    form.appendChild(partialResponse);
    
    // Adiciona o formulário ao body
    document.body.appendChild(form);
    
    // Variável para controlar se já foi resolvido
    let resolved = false;
    
    // Listener para quando o iframe carregar (resposta recebida)
    iframe.onload = () => {
        if (resolved) return;
        resolved = true;
        console.log('✅ Formulário enviado com sucesso!');
        // Remove o formulário
        if (form.parentNode) {
            document.body.removeChild(form);
        }
        // Resolve a promise
        resolve();
    };
    
    // Listener de erro no iframe
    iframe.onerror = () => {
        if (resolved) return;
        resolved = true;
        console.warn('⚠️ Erro ao carregar iframe, mas o formulário pode ter sido enviado');
        // Remove o formulário
        if (form.parentNode) {
            document.body.removeChild(form);
        }
        // Ainda resolve como sucesso, pois o Google Forms pode ter recebido mesmo com erro de CORS
        resolve();
    };
    
    // Timeout de segurança (se não receber resposta em 5 segundos, assume sucesso)
    setTimeout(() => {
        if (resolved) return;
        resolved = true;
        if (form.parentNode) {
            document.body.removeChild(form);
        }
        console.log('⏱️ Timeout: assumindo que o formulário foi enviado (Google Forms pode ter recebido mesmo sem resposta)');
        resolve();
    }, 5000);
    
    // Submete o formulário
    console.log('📤 Enviando dados para Google Form:', FORM_ACTION_URL);
    try {
        form.submit();
        console.log('✅ Formulário submetido com sucesso');
    } catch (error) {
        if (resolved) return;
        resolved = true;
        console.error('❌ Erro ao submeter formulário:', error);
        if (form.parentNode) {
            document.body.removeChild(form);
        }
        reject(error);
    }
}

// Enviar formulário
async function enviarFormulario(e) {
    e.preventDefault();
    
    const form = document.getElementById('bugForm');
    const submitBtn = form.querySelector('.btn-submit');
    
    // Validação - apenas descrição é obrigatória
    const description = document.getElementById('bugDescription').value.trim();
    
    if (!description) {
        showStatus('error', traducoes[idiomaAtual]['bug-required']);
        return;
    }
    
    // Desabilita botão
    submitBtn.disabled = true;
    submitBtn.textContent = traducoes[idiomaAtual]['bug-sending'];
    showStatus('info', traducoes[idiomaAtual]['bug-sending']);
    
    try {
        // Prepara dados
        const contactInput = document.getElementById('bugContact');
        
        const formData = {
            description: description,
            contact: contactInput ? contactInput.value.trim() : '',
            timestamp: new Date().toLocaleString(idiomaAtual),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        // Sempre tenta enviar para o Google Form
        // Adiciona timeout adicional para evitar travamento
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout ao enviar formulário')), 8000);
        });
        
        try {
            await Promise.race([
                enviarParaGoogleForm(formData),
                timeoutPromise
            ]);
            
            // Se chegou aqui, o envio foi bem-sucedido
            console.log('✅ Envio concluído com sucesso');
            
            // Limpa o formulário
            form.reset();
            
            // Mostra mensagem de agradecimento e redireciona
            mostrarAgradecimentoERedirecionar();
            
        } catch (error) {
            // Se falhar, mostra erro e reabilita o botão
            console.error('❌ Falha ao enviar:', error);
            showStatus('error', traducoes[idiomaAtual]['bug-error'] + ' Tente novamente ou abra o formulário manualmente.');
            
            // Reabilita o botão
            submitBtn.disabled = false;
            submitBtn.textContent = traducoes[idiomaAtual]['bug-button-submit'];
            
            // Oferece opção de abrir o Google Forms manualmente
            const abrirManual = confirm(traducoes[idiomaAtual]['bug-error'] + '\n\nDeseja abrir o formulário do Google Forms para enviar manualmente?');
            if (abrirManual) {
                const googleFormViewUrl = FORM_ACTION_URL.replace('/formResponse', '/viewform');
                window.open(googleFormViewUrl, '_blank');
            }
            return; // Não continua para mostrar agradecimento
        }
        
        } catch (error) {
            console.error('Erro ao enviar:', error);
            showStatus('error', traducoes[idiomaAtual]['bug-error'] + ' ' + (error.message || ''));
            // Reabilita o botão apenas em caso de erro
            submitBtn.disabled = false;
            submitBtn.textContent = traducoes[idiomaAtual]['bug-button-submit'];
        }
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    // Event listeners
    document.getElementById('bugForm').addEventListener('submit', enviarFormulario);
    document.getElementById('btnPortugues')?.addEventListener('click', () => trocarIdioma('pt-BR'));
    document.getElementById('btnItaliano')?.addEventListener('click', () => trocarIdioma('it-IT'));
    
    // Inicializa idioma
    trocarIdioma(idiomaAtual);
    
    // Inicializa os Entry IDs (apenas manuais, devido a CORS)
    if (USE_GOOGLE_FORMS) {
        if (FORM_ACTION_URL === 'YOUR_GOOGLE_FORM_URL' || FORM_ACTION_URL.includes('YOUR_FORM_ID')) {
            console.warn('⚠️ Google Forms não configurado! Configure o FORM_ACTION_URL em bugs-script.js');
        } else {
            inicializarEntryIDs();
        }
    }
});
