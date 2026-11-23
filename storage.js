// ==========================================
// ARMAZENAMENTO LOCAL (LocalStorage + JSON)
// CRUD das mensagens do formulário de contato
// ==========================================
(function (global) {
    'use strict';

    const CHAVE = 'portfolio_mensagens';       // array JSON com as mensagens
    const CHAVE_SEED = 'portfolio_seed_v1';    // marca que a carga inicial já foi avaliada
    const STATUS_VALIDOS = ['nova', 'lida', 'respondida'];
    const LIMITES = { nome: [2, 80], email: [5, 120], mensagem: [10, 1000] };
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    // Se o navegador bloquear o LocalStorage, usa memória (dados somem ao recarregar).
    let memoria = {};
    let storageOk = true;
    try {
        localStorage.setItem('__teste__', '1');
        localStorage.removeItem('__teste__');
    } catch (e) {
        storageOk = false;
    }

    function lerChave(k) {
        if (!storageOk) return k in memoria ? memoria[k] : null;
        return localStorage.getItem(k);
    }

    function gravarChave(k, v) {
        if (!storageOk) { memoria[k] = v; return; }
        localStorage.setItem(k, v);
    }

    // ---------- Validação (usada pelo formulário e pelo painel) ----------
    function validar(d) {
        const erros = {};
        const nome = (d.nome || '').trim();
        const email = (d.email || '').trim();
        const mensagem = (d.mensagem || '').trim();

        if (!nome) erros.nome = 'Informe seu nome.';
        else if (nome.length < LIMITES.nome[0]) erros.nome = 'O nome deve ter ao menos ' + LIMITES.nome[0] + ' caracteres.';
        else if (nome.length > LIMITES.nome[1]) erros.nome = 'O nome deve ter no máximo ' + LIMITES.nome[1] + ' caracteres.';

        if (!email) erros.email = 'Informe seu e-mail.';
        else if (!EMAIL_REGEX.test(email) || email.length > LIMITES.email[1]) erros.email = 'Informe um e-mail válido (ex.: nome@dominio.com).';

        if (!mensagem) erros.mensagem = 'Escreva sua mensagem.';
        else if (mensagem.length < LIMITES.mensagem[0]) erros.mensagem = 'A mensagem deve ter ao menos ' + LIMITES.mensagem[0] + ' caracteres.';
        else if (mensagem.length > LIMITES.mensagem[1]) erros.mensagem = 'A mensagem deve ter no máximo ' + LIMITES.mensagem[1] + ' caracteres.';

        if (d.status !== undefined && STATUS_VALIDOS.indexOf(d.status) === -1) erros.status = 'Status inválido.';
        return erros;
    }

    // ---------- Leitura / escrita do JSON ----------
    function normalizar(r) {
        if (!r || typeof r !== 'object' || typeof r.id !== 'string') return null;
        return {
            id: r.id,
            nome: String(r.nome || ''),
            email: String(r.email || ''),
            mensagem: String(r.mensagem || ''),
            data: typeof r.data === 'string' ? r.data : new Date().toISOString(),
            status: STATUS_VALIDOS.indexOf(r.status) !== -1 ? r.status : 'nova',
            origem: String(r.origem || 'formulario'),
            envioEmail: String(r.envioEmail || 'nao_aplicavel'),
            atualizadoEm: r.atualizadoEm || null
        };
    }

    // Retorna array, ou null se a chave não existir / estiver corrompida.
    function carregar() {
        const bruto = lerChave(CHAVE);
        if (bruto === null) return null;
        try {
            const dados = JSON.parse(bruto);
            if (!Array.isArray(dados)) throw new Error('formato inválido');
            return dados.map(normalizar).filter(Boolean);
        } catch (e) {
            console.warn('[storage] JSON inválido em "' + CHAVE + '". Cópia mantida em "' + CHAVE + '_corrompido".');
            try { gravarChave(CHAVE + '_corrompido', bruto); } catch (_) { /* sem espaço */ }
            return null;
        }
    }

    function salvar(lista) {
        gravarChave(CHAVE, JSON.stringify(lista));
    }

    function gerarId() {
        return 'msg-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }

    function exigirAdmin() {
        if (!global.PortfolioAuth || !global.PortfolioAuth.estaAutenticado()) {
            throw new Error('Operação restrita: autentique-se no painel administrativo.');
        }
    }

    // ---------- 20 registros de teste (ids fixos => sem duplicação) ----------
    const TEXTOS_TESTE = [
        'Gostei da organização do portfólio. Parabéns pelo trabalho!',
        'Gostaria de saber mais detalhes sobre os projetos da galeria.',
        'Vi o portfólio e fiquei interessado em conversar sobre uma oportunidade.',
        'A navegação está clara e o layout funciona bem no celular.',
        'Poderia compartilhar o repositório de um dos projetos?',
        'Ótimo conteúdo nas seções de tendências tecnológicas.',
        'Tenho uma sugestão de melhoria para a página de contato.',
        'Mensagem de validação do CRUD: leitura, edição e exclusão.',
        'Teste de mensagem longa para verificar a quebra de linha na tabela do painel administrativo.',
        'Obrigado pelo retorno! Aguardo novidades sobre os próximos projetos.'
    ];

    function registrosDeTeste() {
        const lista = [];
        for (let i = 1; i <= 20; i++) {
            const n = String(i).padStart(2, '0');
            lista.push({
                id: 'seed-' + n,
                nome: 'Visitante de Teste ' + n,
                email: 'visitante' + n + '@example.com',
                mensagem: '[TESTE ' + n + '] ' + TEXTOS_TESTE[(i - 1) % TEXTOS_TESTE.length],
                data: new Date(Date.UTC(2026, 10, i, 12 + (i % 6), (i * 7) % 60)).toISOString(),
                status: i % 3 === 0 ? 'respondida' : (i % 2 === 0 ? 'lida' : 'nova'),
                origem: 'teste',
                envioEmail: 'nao_aplicavel',
                atualizadoEm: null
            });
        }
        return lista;
    }

    // Junta registros de teste sem duplicar ids. Retorna quantos foram adicionados.
    function mesclarTestes(lista) {
        const ids = new Set(lista.map(r => r.id));
        let add = 0;
        registrosDeTeste().forEach(r => {
            if (!ids.has(r.id)) { lista.push(r); ids.add(r.id); add++; }
        });
        return add;
    }

    // Executada a cada carregamento: injeta os 20 registros só se o LocalStorage estiver
    // vazio no primeiro acesso. A marca CHAVE_SEED impede reinserir após uma exclusão.
    function garantirDadosDeTeste() {
        if (lerChave(CHAVE_SEED)) return 0;
        const lista = carregar();
        let adicionados = 0;
        if (lista === null || lista.length === 0) {
            const nova = lista || [];
            adicionados = mesclarTestes(nova);
            salvar(nova);
        }
        gravarChave(CHAVE_SEED, new Date().toISOString());
        return adicionados;
    }

    // ---------- API pública ----------
    const MensagensDB = {
        chave: CHAVE,
        statusValidos: STATUS_VALIDOS,
        persistente: storageOk,
        validar: validar,
        garantirDadosDeTeste: garantirDadosDeTeste,

        // CREATE — aberto: é usado pelo formulário público.
        criar: function (dados, extra) {
            const erros = validar(dados);
            if (Object.keys(erros).length) { const e = new Error('Dados inválidos'); e.erros = erros; throw e; }
            const lista = carregar() || [];
            const reg = normalizar(Object.assign({
                id: gerarId(),
                nome: dados.nome.trim(),
                email: dados.email.trim(),
                mensagem: dados.mensagem.trim(),
                data: new Date().toISOString(),
                status: 'nova',
                origem: 'formulario',
                envioEmail: 'pendente'
            }, extra || {}));
            lista.push(reg);
            salvar(lista);
            return reg;
        },

        // READ — restrito ao administrador.
        listar: function () {
            exigirAdmin();
            return (carregar() || []).sort((a, b) => b.data.localeCompare(a.data));
        },
        obter: function (id) {
            exigirAdmin();
            return (carregar() || []).find(r => r.id === id) || null;
        },
        total: function () { return (carregar() || []).length; },

        // UPDATE — restrito.
        atualizar: function (id, dados) {
            exigirAdmin();
            const erros = validar(dados);
            if (Object.keys(erros).length) { const e = new Error('Dados inválidos'); e.erros = erros; throw e; }
            const lista = carregar() || [];
            const i = lista.findIndex(r => r.id === id);
            if (i === -1) throw new Error('Registro não encontrado.');
            lista[i] = normalizar(Object.assign({}, lista[i], {
                nome: dados.nome.trim(),
                email: dados.email.trim(),
                mensagem: dados.mensagem.trim(),
                status: dados.status || lista[i].status,
                atualizadoEm: new Date().toISOString()
            }));
            salvar(lista);
            return lista[i];
        },

        // Atualização interna do status do envio de e-mail (feita logo após o envio do formulário).
        registrarEnvioEmail: function (id, situacao) {
            const lista = carregar() || [];
            const r = lista.find(x => x.id === id);
            if (!r) return;
            r.envioEmail = situacao;
            salvar(lista);
        },

        // DELETE — restrito.
        excluir: function (id) {
            exigirAdmin();
            const lista = carregar() || [];
            const nova = lista.filter(r => r.id !== id);
            if (nova.length === lista.length) throw new Error('Registro não encontrado.');
            salvar(nova);
            return true;
        },

        // Recoloca apenas os registros de teste que estiverem faltando (sem duplicar).
        restaurarTestes: function () {
            exigirAdmin();
            const lista = carregar() || [];
            const add = mesclarTestes(lista);
            salvar(lista);
            return add;
        }
    };

    global.MensagensDB = MensagensDB;
    garantirDadosDeTeste();
})(window);
