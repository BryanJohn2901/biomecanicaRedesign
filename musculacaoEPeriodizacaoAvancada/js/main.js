AOS.init({
    duration: 800,
    offset: 100,
    once: true,
    easing: 'ease-out-cubic',
});

var popup = document.getElementById('popup-inscricao');
var formInscricao = document.getElementById('form_bb');
var inputTelefone = document.getElementById('phone');
var erroTelefone = document.getElementById('erro-telefone');
var btnEnviar = document.getElementById('btn-enviar-form');

var WEBHOOK_URL = 'https://hook.us1.make.com/bhigavwc6bfhskmnicov25r6jv9fnt1p?produto=MPA';
var REDIRECT_BASE = 'https://pos.personaltraineracademy.com.br/obg-obrigado-mpa/';

function getUrlParams() {
    var params = {};
    var search = window.location.search.replace(/^\?/, '');
    if (!search) return params;
    search.split('&').forEach(function (pair) {
        var p = pair.split('=');
        var k = decodeURIComponent(p[0]);
        var v = p[1] != null ? decodeURIComponent(p[1].replace(/\+/g, ' ')) : '';
        params[k] = v;
    });
    return params;
}

function applyUtmParams(params) {
    if (!params || typeof params !== 'object') return;
    var utmSource = params.utm_source || '';
    var utmTerm = params.utm_term || '';
    var utmCampaign = params.utm_campaign || '';
    var utmMedium = params.utm_medium || '';
    var utmContent = params.utm_content || '';
    if (utmSource || utmTerm || utmCampaign || utmMedium || utmContent) {
        try {
            sessionStorage.setItem('utm_source', utmSource);
            sessionStorage.setItem('utm_term', utmTerm);
            sessionStorage.setItem('utm_campaign', utmCampaign);
            sessionStorage.setItem('utm_medium', utmMedium);
            sessionStorage.setItem('utm_content', utmContent);
        } catch (e) {}
    }
    var urlEl = document.getElementById('url');
    var uSource = document.getElementById('utm_source');
    var uTerm = document.getElementById('utm_term');
    var uCampaign = document.getElementById('utm_campaign');
    var uMedium = document.getElementById('utm_medium');
    var uContent = document.getElementById('utm_content');
    if (uSource) uSource.value = utmSource;
    if (uTerm) uTerm.value = utmTerm;
    if (uCampaign) uCampaign.value = utmCampaign;
    if (uMedium) uMedium.value = utmMedium;
    if (uContent) uContent.value = utmContent;
    if (urlEl) urlEl.value = window.location.href;
}

function getUtmParams() {
    var params = getUrlParams();
    var hasUtm = params.utm_source || params.utm_term || params.utm_campaign || params.utm_medium || params.utm_content;
    if (hasUtm) return params;
    try {
        return {
            utm_source: sessionStorage.getItem('utm_source') || '',
            utm_term: sessionStorage.getItem('utm_term') || '',
            utm_campaign: sessionStorage.getItem('utm_campaign') || '',
            utm_medium: sessionStorage.getItem('utm_medium') || '',
            utm_content: sessionStorage.getItem('utm_content') || '',
        };
    } catch (e) {
        return params;
    }
}

function abrirPopup() {
    var params = getUtmParams();
    applyUtmParams(params);
    popup.setAttribute('aria-hidden', 'false');
    popup.classList.add('flex');
    popup.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function fecharPopup() {
    popup.setAttribute('aria-hidden', 'true');
    popup.classList.remove('flex');
    popup.classList.add('hidden');
    document.body.style.overflow = '';
}

['btn-inscreva-nav', 'btn-inscreva-hero', 'btn-matricule', 'btn-garantir-vaga'].forEach(function (id) {
    var btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', abrirPopup);
});
document.getElementById('popup-fechar').addEventListener('click', fecharPopup);
popup.addEventListener('click', function (e) {
    if (e.target === popup) fecharPopup();
});
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && popup.getAttribute('aria-hidden') === 'false') fecharPopup();
});

applyUtmParams(getUtmParams());

inputTelefone.addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '');
    erroTelefone.classList.add('hidden');
});

formInscricao.addEventListener('submit', async function (e) {
    e.preventDefault();
    var nome = document.getElementById('name').value.trim();
    var email = document.getElementById('email').value.trim();
    var telDigitos = inputTelefone.value.replace(/\D/g, '');
    if (telDigitos.length < 10) {
        erroTelefone.classList.remove('hidden');
        inputTelefone.focus();
        return;
    }
    erroTelefone.classList.add('hidden');
    var telefoneFormatado = '+55' + telDigitos;

    document.getElementById('url').value = window.location.href;
    var utm_source = document.getElementById('utm_source').value || '';
    var utm_term = document.getElementById('utm_term').value || '';
    var utm_campaign = document.getElementById('utm_campaign').value || '';
    var utm_medium = document.getElementById('utm_medium').value || '';
    var utm_content = document.getElementById('utm_content').value || '';
    var urlAtual = document.getElementById('url').value || window.location.href;

    var payload = {
        nome: nome,
        email: email,
        telefone: telefoneFormatado,
        utm_source: utm_source,
        utm_medium: utm_medium,
        utm_campaign: utm_campaign,
        utm_term: utm_term,
        utm_content: utm_content,
        url: urlAtual,
        produto: 'MPA'
    };

    btnEnviar.disabled = true;
    btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processando...';

    try {
        await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error('Erro ao enviar webhook, prosseguindo com o redirecionamento.', err);
    } finally {
        var sep = REDIRECT_BASE.indexOf('?') !== -1 ? '&' : '?';
        window.location.href = REDIRECT_BASE + sep +
            'nome=' + encodeURIComponent(nome) +
            '&email=' + encodeURIComponent(email) +
            '&telefone=' + encodeURIComponent(telefoneFormatado) +
            '&utm_source=' + encodeURIComponent(utm_source) +
            '&utm_term=' + encodeURIComponent(utm_term) +
            '&utm_campaign=' + encodeURIComponent(utm_campaign) +
            '&utm_medium=' + encodeURIComponent(utm_medium) +
            '&utm_content=' + encodeURIComponent(utm_content) +
            '&url=' + encodeURIComponent(urlAtual);
    }
});

(function () {
    var aviso = document.getElementById('aviso-cookies');
    if (!aviso) return;
    if (!localStorage.getItem('lgpd-aceito')) {
        setTimeout(function () {
            aviso.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
        }, 1500);
    }
    function hideAviso(choice) {
        localStorage.setItem('lgpd-aceito', choice);
        aviso.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
    }
    document.getElementById('btn-cookies-aceitar').addEventListener('click', function () { hideAviso('true'); });
    document.getElementById('btn-cookies-recusar').addEventListener('click', function () { hideAviso('false'); });
})();
