# Portfólio Web Dinâmico — Lucas Gouveia Biscassi

Atividade final do 4º bimestre (Canes Solution). Site estático em **HTML5, CSS3, JavaScript e Bootstrap 5**, sem construtores de site e sem banco de dados relacional.

## Estrutura

| Arquivo | Função |
|---|---|
| `index.html` | Página única: apresentação, habilidades, áreas do conhecimento, tendências, galeria, contato, painel admin (oculto) |
| `style.css` | CSS original + estilos das novas seções (carregado depois do Bootstrap) |
| `script.js` | Galeria de projetos (dados em `meusProjetos`) e formulário de contato (Formspree) |
| `storage.js` | CRUD em LocalStorage (JSON) e carga automática de 20 registros de teste |
| `admin.js` | Autenticação e painel administrativo |
| `config.js` | Configuração da automação de e-mail (endpoint Formspree) |
| `vida.html` | Projeto 01 (jogo), mantido como estava |
| `contato.php` | Versão anterior do envio por PHP, mantida mas **não utilizada** (hospedagem estática não executa PHP) |
| `img/` | Pasta para os screenshots dos projetos |

## Como executar
Abra `index.html` no navegador ou sirva a pasta (`python3 -m http.server`). Precisa de internet para carregar Bootstrap, fontes e ícones por CDN. O painel admin usa Web Crypto, que exige `https://`, `localhost` ou `file://`.

## Acesso à área administrativa (testar o CRUD)
O painel não tem link visível. Duas formas de abrir:
1. Acrescente `#admin` ao endereço: `.../index.html#admin`
2. Clique **5 vezes rápido** no texto “© 2026 — Desenvolvido por…” do rodapé.

**Primeiro acesso:** o site pede para **criar uma senha** (mínimo de 8 caracteres) e a guarda apenas como hash PBKDF2‑SHA256 com salt no LocalStorage deste navegador. Nenhuma senha está no código. Nos acessos seguintes, informe a mesma senha.

Dentro do painel:
- **Ler:** tabela com busca, filtro por status, paginação e botão *Ver* (detalhes).
- **Cadastrar:** botão *Nova*.
- **Editar:** botão *Editar* em cada linha.
- **Excluir:** botão *Excluir* (pede confirmação).
- **Restaurar testes:** recoloca apenas os registros de teste que faltam, sem duplicar.
- **Sair:** encerra a sessão. A sessão também cai após 15 min de inatividade ou ao recarregar a página.

Proteções: login com hash, bloqueio temporário após 5 tentativas erradas, operações de leitura/edição/exclusão recusadas pelo código sem sessão ativa, dados exibidos como texto (sem executar HTML).

> **Limite honesto:** como não há servidor, essa autenticação protege apenas contra uso casual. Quem tem acesso ao navegador e ao DevTools pode ler o LocalStorage. Os dados ficam só no navegador de quem usa o site; por isso o painel mostra as mensagens enviadas **naquele navegador**. A notificação real chega por e-mail (abaixo).
> Para redefinir a senha: no DevTools, apague as chaves `portfolio_admin_auth` e `portfolio_admin_lock` do LocalStorage.

## Armazenamento (LocalStorage + JSON)
- Chave `portfolio_mensagens`: array JSON com `id, nome, email, mensagem, data, status, origem, envioEmail`.
- No primeiro acesso (chave inexistente ou vazia), `storage.js` injeta **20 registros de teste** com ids fixos (`seed-01` a `seed-20`), e-mails `@example.com`. A chave `portfolio_seed_v1` impede nova injeção a cada carregamento e depois de exclusões. Se já houver mensagens, nada é injetado nem apagado.
- JSON corrompido: a cópia é guardada em `portfolio_mensagens_corrompido` e os dados são recriados.

## Automação de e-mail (Etapa 2.2): Formspree
**Por que Formspree:** o site é estático (sem back-end), então o PHP `mail()` não funciona em hospedagens como GitHub Pages. O Formspree recebe o POST do formulário por HTTPS, tem plano gratuito, não exige servidor nem biblioteca extra (o código usa `fetch`) e mantém o e-mail de destino no painel do serviço, fora do código.

**Fluxo do formulário:** valida → salva no LocalStorage → envia ao Formspree → registra o resultado (`enviado`, `falhou` ou `nao_configurado`) e informa o visitante. Há campo isca anti‑spam e intervalo de 30 s entre envios.

**Configuração (já preenchida):**
- Endpoint: `https://formspree.io/f/xwlowwvj` (definido em `config.js`).
- O e-mail de destino e o limite de envios são configurados no painel do Formspree.

**Importante:** o endpoint do Formspree é público por natureza (fica no navegador), mas o e-mail de destino **não** aparece no código. Nenhuma chave privada ou senha é usada.

## Galeria de projetos
Edite `meusProjetos` em `script.js`: `screenshot` (ex.: `"img/projeto-01.png"`) e `repositorio` (URL do GitHub). Campos vazios exibem espaços reservados.

## Bootstrap
Bootstrap 5.3.3 via CDN, carregado antes do `style.css`, usado em navbar, grid, modais, tabela e paginação. O CSS original foi mantido e tem prioridade.

## Responsividade
Testada em 375 px, 768 px e 1280 px. Menu recolhido no celular, cards em 1 coluna no celular e 2 no desktop.