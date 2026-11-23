// ==========================================
// PAINEL ADMINISTRATIVO OCULTO
// Autenticação + CRUD das mensagens (LocalStorage)
// ==========================================
(function (global) {
    'use strict';

    const CHAVE_AUTH = 'portfolio_admin_auth';
    const CHAVE_LOCK = 'portfolio_admin_lock';
    const ITERACOES = 150000;
    const TEMPO_SESSAO_MS = 15 * 60 * 1000;
    const MAX_TENTATIVAS = 5;
    const POR_PAGINA = 10;

    // ---------- Auth ----------
    let sessaoAtiva = false;   // só em memória: recarregar a página encerra a sessão
    let timerSessao = null;

    const enc = new TextEncoder();
    const b64 = buf => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
    const deB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

    async function derivar(senha, salt, iter) {
        const base = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
        return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: iter }, base, 256);
    }

    function iguais(a, b) {
        if (a.length !== b.length) return false;
        let r = 0;
        for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
        return r === 0;
    }

    function lerJSON(k) {
        try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; }
    }

    function senhaDefinida() {
        const a = lerJSON(CHAVE_AUTH);
        return !!(a && a.salt && a.hash);
    }

    function segundosBloqueado() {
        const l = lerJSON(CHAVE_LOCK);
        if (!l || !l.ate) return 0;
        return Math.max(0, Math.ceil((l.ate - Date.now()) / 1000));
    }

    function registrarFalha() {
        const l = lerJSON(CHAVE_LOCK) || { falhas: 0, ate: 0 };
        l.falhas += 1;
        if (l.falhas % MAX_TENTATIVAS === 0) {
            const bloco = l.falhas / MAX_TENTATIVAS;
            l.ate = Date.now() + Math.min(30 * Math.pow(2, bloco - 1), 900) * 1000;
        }
        localStorage.setItem(CHAVE_LOCK, JSON.stringify(l));
        return l;
    }

    function renovarSessao() {
        clearTimeout(timerSessao);
        timerSessao = setTimeout(() => {
            sair();
            abrirLogin();
            avisar('Sessão encerrada por inatividade. Entre novamente para continuar.', 'warning', true);
        }, TEMPO_SESSAO_MS);
    }

    const PortfolioAuth = {
        estaAutenticado: () => sessaoAtiva,
        senhaDefinida: senhaDefinida,

        async definirSenha(senha) {
            if (!global.crypto || !crypto.subtle) throw new Error('Este navegador não oferece Web Crypto. Abra o site por HTTPS ou localhost.');
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const hash = await derivar(senha, salt, ITERACOES);
            localStorage.setItem(CHAVE_AUTH, JSON.stringify({ v: 1, iter: ITERACOES, salt: b64(salt), hash: b64(hash) }));
            sessaoAtiva = true;
            renovarSessao();
        },

        async entrar(senha) {
            if (!global.crypto || !crypto.subtle) throw new Error('Este navegador não oferece Web Crypto. Abra o site por HTTPS ou localhost.');
            const espera = segundosBloqueado();
            if (espera > 0) return { ok: false, bloqueado: espera };
            const a = lerJSON(CHAVE_AUTH);
            const hash = b64(await derivar(senha, deB64(a.salt), a.iter));
            if (iguais(hash, a.hash)) {
                localStorage.removeItem(CHAVE_LOCK);
                sessaoAtiva = true;
                renovarSessao();
                return { ok: true };
            }
            const l = registrarFalha();
            return { ok: false, bloqueado: segundosBloqueado(), restantes: MAX_TENTATIVAS - (l.falhas % MAX_TENTATIVAS) };
        },

        // Toda operação do painel passa por aqui.
        exigir() {
            if (!sessaoAtiva) { abrirLogin(); throw new Error('Sessão administrativa inválida.'); }
            renovarSessao();
        }
    };
    global.PortfolioAuth = PortfolioAuth;

    // ---------- Utilidades de UI ----------
    const $ = id => document.getElementById(id);
    let modalLogin, modalRegistro, modalExcluir;
    let estado = { busca: '', status: '', pagina: 1, idAtual: null, modo: 'criar' };

    function avisar(msg, tipo, noLogin) {
        const alvo = $(noLogin ? 'login-aviso' : 'admin-aviso');
        if (!alvo) return;
        alvo.className = 'alert alert-' + (tipo || 'info') + ' py-2 small mb-3';
        alvo.textContent = msg;
        alvo.classList.remove('d-none');
        if (!noLogin) {
            clearTimeout(avisar._t);
            avisar._t = setTimeout(() => alvo.classList.add('d-none'), 6000);
        }
    }

    function fmtData(iso) {
        const d = new Date(iso);
        return isNaN(d) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    }

    const ROTULO_STATUS = { nova: 'Nova', lida: 'Lida', respondida: 'Respondida' };
    const ROTULO_EMAIL = {
        enviado: 'E-mail enviado', falhou: 'Falha no envio do e-mail',
        nao_configurado: 'Envio por e-mail não configurado', pendente: 'Envio pendente',
        nao_aplicavel: 'Não se aplica (registro de teste/manual)'
    };

    function el(tag, cls, texto) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (texto !== undefined) e.textContent = texto;
        return e;
    }

    // ---------- Login ----------
    function abrirLogin() {
        if (!modalLogin) return;
        const definida = senhaDefinida();
        $('login-titulo').textContent = definida ? 'Acesso administrativo' : 'Criar senha de administrador';
        $('login-ajuda').textContent = definida
            ? 'Informe a senha para gerenciar as mensagens.'
            : 'Primeiro acesso neste navegador: defina uma senha (mínimo de 8 caracteres). Ela será guardada apenas como hash.';
        $('login-confirma-wrap').classList.toggle('d-none', definida);
        $('login-senha').value = '';
        $('login-confirma').value = '';
        $('login-aviso').classList.add('d-none');
        $('login-senha').setAttribute('autocomplete', definida ? 'current-password' : 'new-password');
        modalLogin.show();
        $('modal-login').addEventListener('shown.bs.modal', () => $('login-senha').focus(), { once: true });
    }

    async function enviarLogin(ev) {
        ev.preventDefault();
        const senha = $('login-senha').value;
        const btn = $('login-enviar');
        btn.disabled = true;
        try {
            if (!senhaDefinida()) {
                if (senha.length < 8) { avisar('A senha deve ter ao menos 8 caracteres.', 'danger', true); return; }
                if (senha !== $('login-confirma').value) { avisar('A confirmação não confere com a senha.', 'danger', true); return; }
                await PortfolioAuth.definirSenha(senha);
            } else {
                const r = await PortfolioAuth.entrar(senha);
                if (!r.ok) {
                    avisar(r.bloqueado
                        ? 'Muitas tentativas. Aguarde ' + r.bloqueado + ' s para tentar novamente.'
                        : 'Senha incorreta. Tentativas restantes: ' + r.restantes + '.', 'danger', true);
                    $('login-senha').value = '';
                    return;
                }
            }
            modalLogin.hide();
            mostrarPainel();
        } catch (e) {
            avisar(e.message, 'danger', true);
        } finally {
            btn.disabled = false;
        }
    }

    function mostrarPainel() {
        $('painel-admin').classList.remove('d-none');
        if (location.hash === '#admin') history.replaceState(null, '', location.pathname + location.search);
        renderizar();
        $('painel-admin').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function sair() {
        sessaoAtiva = false;
        clearTimeout(timerSessao);
        const p = $('painel-admin');
        if (p) p.classList.add('d-none');
        const corpo = $('admin-tbody');
        if (corpo) corpo.textContent = '';
        [modalRegistro, modalExcluir].forEach(m => { if (m) m.hide(); });
    }

    // ---------- Listagem (READ) ----------
    function filtrados() {
        const termo = estado.busca.trim().toLowerCase();
        return MensagensDB.listar().filter(r =>
            (!estado.status || r.status === estado.status) &&
            (!termo || (r.nome + ' ' + r.email + ' ' + r.mensagem).toLowerCase().indexOf(termo) !== -1));
    }

    function renderizar() {
        let lista;
        try { PortfolioAuth.exigir(); lista = filtrados(); } catch (e) { return; }
        const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
        estado.pagina = Math.min(estado.pagina, paginas);
        const ini = (estado.pagina - 1) * POR_PAGINA;
        const pagina = lista.slice(ini, ini + POR_PAGINA);

        $('admin-contagem').textContent = lista.length + ' registro(s)' +
            (lista.length !== MensagensDB.total() ? ' (de ' + MensagensDB.total() + ' no total)' : '');

        const tbody = $('admin-tbody');
        tbody.textContent = '';
        if (!pagina.length) {
            const tr = el('tr');
            const td = el('td', 'text-center py-4 admin-vazio', 'Nenhuma mensagem encontrada.');
            td.colSpan = 6;
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
        pagina.forEach(r => {
            const tr = el('tr');
            tr.appendChild(el('td', '', r.nome));
            tr.appendChild(el('td', 'd-none d-md-table-cell', r.email));
            tr.appendChild(el('td', 'd-none d-lg-table-cell admin-msg', r.mensagem));
            tr.appendChild(el('td', 'text-nowrap d-none d-sm-table-cell', fmtData(r.data)));
            const tdSt = el('td');
            tdSt.appendChild(el('span', 'badge admin-badge admin-badge-' + r.status, ROTULO_STATUS[r.status]));
            tr.appendChild(tdSt);
            const tdAc = el('td', 'text-end');
            [['ver', 'fa-eye', 'Ver'], ['editar', 'fa-pen', 'Editar'], ['excluir', 'fa-trash', 'Excluir']].forEach(a => {
                const b = el('button', 'btn btn-sm admin-icone');
                b.type = 'button';
                b.title = a[2] + ' mensagem de ' + r.nome;
                b.setAttribute('aria-label', b.title);
                b.dataset.acao = a[0];
                b.dataset.id = r.id;
                b.textContent = a[2];
                tdAc.appendChild(b);
            });
            tr.appendChild(tdAc);
            tbody.appendChild(tr);
        });

        const nav = $('admin-paginacao');
        nav.textContent = '';
        for (let p = 1; p <= paginas; p++) {
            const li = el('li', 'page-item' + (p === estado.pagina ? ' active' : ''));
            const b = el('button', 'page-link', String(p));
            b.type = 'button';
            b.dataset.pagina = p;
            li.appendChild(b);
            nav.appendChild(li);
        }
    }

    // ---------- Criar / Ver / Editar ----------
    function abrirRegistro(modo, id) {
        try { PortfolioAuth.exigir(); } catch (e) { return; }
        estado.modo = modo;
        estado.idAtual = id || null;
        const f = $('form-registro');
        f.reset();
        f.querySelectorAll('.is-invalid').forEach(x => x.classList.remove('is-invalid'));
        $('registro-aviso').classList.add('d-none');
        $('registro-meta').classList.add('d-none');
        let r = null;
        if (id) {
            r = MensagensDB.obter(id);
            if (!r) { avisar('Registro não encontrado.', 'danger'); return; }
            $('reg-nome').value = r.nome;
            $('reg-email').value = r.email;
            $('reg-mensagem').value = r.mensagem;
            $('reg-status').value = r.status;
            const meta = $('registro-meta');
            meta.textContent = '';
            [['Recebida em', fmtData(r.data)],
             ['Origem', r.origem],
             ['E-mail de notificação', ROTULO_EMAIL[r.envioEmail] || r.envioEmail],
             ['Última edição', r.atualizadoEm ? fmtData(r.atualizadoEm) : '—'],
             ['ID', r.id]].forEach(par => {
                const d = el('div');
                d.appendChild(el('strong', '', par[0] + ': '));
                d.appendChild(document.createTextNode(par[1]));
                meta.appendChild(d);
            });
            meta.classList.remove('d-none');
        } else {
            $('reg-status').value = 'nova';
        }
        const ver = modo === 'ver';
        f.querySelectorAll('input, textarea, select').forEach(c => { c.disabled = ver; });
        $('registro-salvar').classList.toggle('d-none', ver);
        $('registro-titulo').textContent = { criar: 'Nova mensagem', editar: 'Editar mensagem', ver: 'Detalhes da mensagem' }[modo];
        modalRegistro.show();
    }

    function salvarRegistro(ev) {
        ev.preventDefault();
        try { PortfolioAuth.exigir(); } catch (e) { return; }
        const dados = {
            nome: $('reg-nome').value, email: $('reg-email').value,
            mensagem: $('reg-mensagem').value, status: $('reg-status').value
        };
        const erros = MensagensDB.validar(dados);
        ['nome', 'email', 'mensagem'].forEach(c => {
            $('reg-' + c).classList.toggle('is-invalid', !!erros[c]);
            $('erro-reg-' + c).textContent = erros[c] || '';
        });
        if (Object.keys(erros).length) return;
        try {
            if (estado.modo === 'editar') {
                MensagensDB.atualizar(estado.idAtual, dados);
                avisar('Registro atualizado com sucesso.', 'success');
            } else {
                MensagensDB.criar(dados, { origem: 'admin', status: dados.status, envioEmail: 'nao_aplicavel' });
                avisar('Registro cadastrado com sucesso.', 'success');
            }
            modalRegistro.hide();
            renderizar();
        } catch (e) {
            const a = $('registro-aviso');
            a.textContent = e.message;
            a.classList.remove('d-none');
        }
    }

    // ---------- Excluir ----------
    function pedirExclusao(id) {
        try { PortfolioAuth.exigir(); } catch (e) { return; }
        const r = MensagensDB.obter(id);
        if (!r) return;
        estado.idAtual = id;
        $('excluir-nome').textContent = r.nome;
        modalExcluir.show();
    }

    function confirmarExclusao() {
        try {
            PortfolioAuth.exigir();
            MensagensDB.excluir(estado.idAtual);
            modalExcluir.hide();
            avisar('Registro excluído.', 'success');
            renderizar();
        } catch (e) {
            avisar(e.message, 'danger');
        }
    }

    // ---------- Inicialização ----------
    function iniciar() {
        if (!$('modal-login') || !global.bootstrap) return;
        modalLogin = new bootstrap.Modal($('modal-login'));
        modalRegistro = new bootstrap.Modal($('modal-registro'));
        modalExcluir = new bootstrap.Modal($('modal-excluir'));

        $('login-form').addEventListener('submit', enviarLogin);
        $('form-registro').addEventListener('submit', salvarRegistro);
        $('excluir-confirmar').addEventListener('click', confirmarExclusao);
        $('admin-sair').addEventListener('click', () => { sair(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
        $('admin-novo').addEventListener('click', () => abrirRegistro('criar'));
        $('admin-restaurar').addEventListener('click', () => {
            try {
                PortfolioAuth.exigir();
                const n = MensagensDB.restaurarTestes();
                avisar(n ? n + ' registro(s) de teste restaurado(s).' : 'Todos os 20 registros de teste já existem. Nada foi duplicado.', n ? 'success' : 'info');
                renderizar();
            } catch (e) { /* sem sessão */ }
        });
        $('admin-busca').addEventListener('input', e => { estado.busca = e.target.value; estado.pagina = 1; renderizar(); });
        $('admin-filtro-status').addEventListener('change', e => { estado.status = e.target.value; estado.pagina = 1; renderizar(); });
        $('admin-paginacao').addEventListener('click', e => {
            const b = e.target.closest('[data-pagina]');
            if (b) { estado.pagina = Number(b.dataset.pagina); renderizar(); }
        });
        $('admin-tbody').addEventListener('click', e => {
            const b = e.target.closest('[data-acao]');
            if (!b) return;
            if (b.dataset.acao === 'excluir') pedirExclusao(b.dataset.id);
            else abrirRegistro(b.dataset.acao === 'ver' ? 'ver' : 'editar', b.dataset.id);
        });

        // Acesso discreto: URL com #admin ou 5 cliques rápidos no "©" do rodapé.
        const gatilho = () => { if (sessaoAtiva) mostrarPainel(); else abrirLogin(); };
        if (location.hash === '#admin') gatilho();
        window.addEventListener('hashchange', () => { if (location.hash === '#admin') gatilho(); });
        const copy = $('rodape-copy');
        if (copy) {
            let cliques = [];
            copy.addEventListener('click', () => {
                const agora = Date.now();
                cliques = cliques.filter(t => agora - t < 3000).concat(agora);
                if (cliques.length >= 5) { cliques = []; gatilho(); }
            });
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})(window);
