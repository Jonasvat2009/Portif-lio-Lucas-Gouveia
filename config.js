// ==========================================
// CONFIGURAÇÃO DA AUTOMAÇÃO DE E-MAIL (Formspree)
// ==========================================
// O Formspree envia o formulário diretamente por HTTPS, sem back-end.
// O e-mail de destino e o limite de envios são definidos no painel do Formspree.
// Nenhuma chave privada ou senha fica exposta: o endpoint é público por natureza.
window.PORTFOLIO_CONFIG = {
    formspree: {
        endpoint: 'https://formspree.io/f/xwlowwvj'
    }
};