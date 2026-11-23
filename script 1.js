
// ==========================================
// 1. CONFIGURAÇÃO (Formspree)
// ==========================================
const CONFIG = {
    STORAGE_KEY: "canes_mensagens",
    ADMIN_PASSWORD: "canes2026",
    FORMSPREE_URL: "https://formspree.io/f/xwlowwvj"
};

// Expõe para o restante do site (storage.js / admin.js leem window.PORTFOLIO_CONFIG).
window.PORTFOLIO_CONFIG = window.PORTFOLIO_CONFIG || {};
window.PORTFOLIO_CONFIG.formspree = { endpoint: CONFIG.FORMSPREE_URL };

const INTERVALO_ENVIO_MS = 30 * 1000; // proteção simples contra envios repetidos

// ==========================================
// 1.1 DADOS DOS PROJETOS
// ==========================================
const meusProjetos = [
    {
        titulo: "Projeto 01 - Jogo iradissimo",
        descricao: "Um jogo responsável por um duelo até a morte de cores (inspirado em vídeos do Instagram).",
        link: "vida.html",
        screenshot: "https://i.imgur.com/ObkdRSd.png",
        repositorio: ""
    },
    {
        titulo: "Projeto 02 - Trabalho escolar me orgulhei",
        descricao: "E-commerce, me orgulhei muito.",
        link: "https://github.com/lucassgb2/loja",
        screenshot: "https://i.imgur.com/fmwUJwq.png",
        repositorio: ""
    },
    {
        titulo: "Projeto 03 - Meu Currículo",
        descricao: "Fiquei muito feliz fazendo e editando.",
        link: "https://canva.link/6e42zkt3476rdes",
        screenshot: "https://i.imgur.com/Y5Pkhkg.png",
        repositorio: ""
    }
];

// ==========================================
// 2. RENDERIZAÇÃO DINÂMICA DOS PROJETOS
// ==========================================
function escaparHtml(txt) {
    return String(txt).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderizarProjetos() {
    const container = document.getElementById('projects-container');
    if (!container) return;

    container.innerHTML = '';

    meusProjetos.forEach(projeto => {
        const card = document.createElement('div');
        card.classList.add('project-card');

        const externo = /^https?:\/\//.test(projeto.link || '');
        const imagem = projeto.screenshot
            ? `<img src="${escaparHtml(projeto.screenshot)}" alt="Screenshot do ${escaparHtml(projeto.titulo)}" loading="lazy">`
            : `<span><i class="fa-regular fa-image"></i> Screenshot do projeto<br><small>espaço reservado</small></span>`;
        const botaoProjeto = projeto.link
            ? `<a href="${escaparHtml(projeto.link)}" class="btn-primary"
                   ${externo ? 'target="_blank" rel="noopener noreferrer"' : ''}
                   style="padding: 8px 16px; font-size: 0.8rem; margin-top: 10px;">
                    Ver Projeto
                </a>`
            : '';
        const botaoRepo = projeto.repositorio
            ? `<a href="${escaparHtml(projeto.repositorio)}" class="btn-repo" target="_blank" rel="noopener noreferrer">
                    <i class="fa-brands fa-github"></i> Repositório
                </a>`
            : `<span class="btn-repo btn-repo-pendente" title="Adicione o link em meusProjetos (script.js)">
                    <i class="fa-brands fa-github"></i> Link do repositório: a preencher
                </span>`;

        card.innerHTML = `
            <div class="project-shot${projeto.screenshot ? '' : ' project-shot-vazio'}">${imagem}</div>
            <h3>${projeto.titulo}</h3>
            <p>${projeto.descricao}</p>
            <div class="project-actions">
                ${botaoProjeto}
                ${botaoRepo}
            </div>
        `;

        container.appendChild(card);
    });
}

// ==========================================
// 3. FORMULÁRIO DE CONTATO
//    valida -> salva no LocalStorage (JSON) -> notifica por e-mail (Formspree)
// ==========================================
function formspreeConfigurado() {
    const c = (window.PORTFOLIO_CONFIG || {}).formspree || {};
    return !!(c.endpoint && /^https:\/\/formspree\.io\/f\//.test(c.endpoint));
}

async function enviarEmail(reg) {
    const c = window.PORTFOLIO_CONFIG.formspree;

    const resp = await fetch(c.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            nome: reg.nome,
            email: reg.email,
            _replyto: reg.email,
            mensagem: reg.mensagem,
            data: new Date(reg.data).toLocaleString('pt-BR'),
            _subject: 'Nova mensagem do portfólio'
        })
    });

    // Formspree responde 200/302 em sucesso e 4xx/5xx em erro.
    if (!resp.ok) {
        let detalhe = '';
        try {
            const json = await resp.json();
            detalhe = (json && (json.error || json.message)) || '';
        } catch (_) {
            detalhe = await resp.text().catch(() => '');
        }
        throw new Error('Formspree respondeu ' + resp.status + (detalhe ? ': ' + detalhe : ''));
    }
}

function mostrarFeedback(texto, tipo) {
    const f = document.getElementById('form-feedback');
    if (!f) return;
    f.className = 'alert alert-' + tipo + ' mt-3 mb-0';
    f.textContent = texto;
}

document.addEventListener('DOMContentLoaded', () => {
    renderizarProjetos();

    const form = document.getElementById('contact-form');

    if (form) {
        const campos = {
            nome: document.getElementById('name'),
            email: document.getElementById('email'),
            mensagem: document.getElementById('message')
        };

        function validarCampos() {
            const erros = MensagensDB.validar({
                nome: campos.nome.value, email: campos.email.value, mensagem: campos.mensagem.value
            });
            Object.keys(campos).forEach(k => {
                campos[k].classList.toggle('is-invalid', !!erros[k]);
                campos[k].setAttribute('aria-invalid', erros[k] ? 'true' : 'false');
                const msg = document.getElementById('erro-' + k);
                if (msg) msg.textContent = erros[k] || '';
            });
            return erros;
        }

        // Revalida enquanto o usuário corrige um campo já marcado como inválido.
        Object.keys(campos).forEach(k => campos[k].addEventListener('input', () => {
            if (campos[k].classList.contains('is-invalid')) validarCampos();
        }));

        const contador = document.getElementById('message-contador');
        campos.mensagem.addEventListener('input', () => {
            if (contador) contador.textContent = campos.mensagem.value.length + '/1000';
        });

        form.addEventListener('submit', async function (ev) {
            ev.preventDefault();
            const btn = this.querySelector('button[type="submit"]');
            const rotulo = btn ? btn.innerHTML : '';

            // Campo isca (honeypot): humanos não o preenchem.
            const isca = document.getElementById('website');
            if (isca && isca.value) return;

            const erros = validarCampos();
            if (Object.keys(erros).length) {
                mostrarFeedback('Corrija os campos destacados e tente novamente.', 'danger');
                const primeiro = Object.keys(campos).find(k => erros[k]);
                campos[primeiro].focus();
                return;
            }

            const ultimo = Number(localStorage.getItem('portfolio_ultimo_envio') || 0);
            if (Date.now() - ultimo < INTERVALO_ENVIO_MS) {
                mostrarFeedback('Aguarde alguns segundos antes de enviar outra mensagem.', 'warning');
                return;
            }

            if (btn) {
                btn.innerHTML = 'Enviando... <i class="fa-solid fa-spinner fa-spin"></i>';
                btn.disabled = true;
            }

            let reg;
            try {
                reg = MensagensDB.criar({
                    nome: campos.nome.value, email: campos.email.value, mensagem: campos.mensagem.value
                });
                try { localStorage.setItem('portfolio_ultimo_envio', String(Date.now())); } catch (e) { /* ignora */ }
            } catch (e) {
                mostrarFeedback('Não foi possível salvar a mensagem neste navegador: ' + e.message, 'danger');
                if (btn) { btn.innerHTML = rotulo; btn.disabled = false; }
                return;
            }

            if (!formspreeConfigurado()) {
                MensagensDB.registrarEnvioEmail(reg.id, 'nao_configurado');
                mostrarFeedback('Mensagem salva localmente neste navegador. O envio por e-mail ainda não está configurado neste site, então nenhuma notificação foi enviada.', 'warning');
            } else {
                try {
                    await enviarEmail(reg);
                    MensagensDB.registrarEnvioEmail(reg.id, 'enviado');
                    mostrarFeedback('Mensagem enviada com sucesso! Obrigado pelo contato.', 'success');
                } catch (e) {
                    console.error('[contato] falha no envio via Formspree:', e);
                    MensagensDB.registrarEnvioEmail(reg.id, 'falhou');
                    mostrarFeedback('Sua mensagem foi salva, mas não foi possível enviar a notificação por e-mail agora. Tente novamente mais tarde.', 'warning');
                }
            }

            form.reset();
            if (contador) contador.textContent = '0/1000';
            Object.keys(campos).forEach(k => campos[k].classList.remove('is-invalid'));
            if (btn) { btn.innerHTML = rotulo; btn.disabled = false; }
        });
    }
});