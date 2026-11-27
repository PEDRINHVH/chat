(() => {
  'use strict';

  const STORE = 'zapradar_state_v3';
  const COSTS = { search: 35, priority: 20, extraCheck: 20, loverPhoto: 45, conversation: 45, lastSeen: 15, location: 25, deleted: 20, risk: 25 };
  const PACKS = [
    { id: 'p300', tokens: 300, bonus: 0, price: 19.9, label: 'R$ 19,90', note: 'R$ 0,066 por token' },
    { id: 'p800', tokens: 800, bonus: 100, price: 39.9, label: 'R$ 39,90', note: 'R$ 0,044 por token', best: true },
    { id: 'p2000', tokens: 2000, bonus: 500, price: 69.9, label: 'R$ 69,90', note: 'R$ 0,027 por token' }
  ];
  const DDD_LOC = {
    11: { city: 'São Paulo', uf: 'SP' }, 12: { city: 'São José dos Campos', uf: 'SP' }, 13: { city: 'Santos', uf: 'SP' },
    19: { city: 'Campinas', uf: 'SP' }, 21: { city: 'Rio de Janeiro', uf: 'RJ' }, 22: { city: 'Campos dos Goytacazes', uf: 'RJ' },
    27: { city: 'Vitória', uf: 'ES' }, 31: { city: 'Belo Horizonte', uf: 'MG' }, 41: { city: 'Curitiba', uf: 'PR' },
    48: { city: 'Florianópolis', uf: 'SC' }, 51: { city: 'Porto Alegre', uf: 'RS' }, 61: { city: 'Brasília', uf: 'DF' },
    62: { city: 'Goiânia', uf: 'GO' }, 71: { city: 'Salvador', uf: 'BA' }, 81: { city: 'Recife', uf: 'PE' },
    84: { city: 'Natal', uf: 'RN' }, 85: { city: 'Fortaleza', uf: 'CE' }, 92: { city: 'Manaus', uf: 'AM' }
  };
  const AMBIGUOUS_MESSAGES = [
    ['in', 'oi, chegou em casa?', '21:12'],
    ['out', 'acabei de sair, te aviso quando chegar', '21:13'],
    ['in', 'tava morrendo de saudade', '21:14'],
    ['out', 'eu também… não devia 😅', '21:15'],
    ['in', 'posso passar aí mais tarde?', '22:41'],
    ['out', 'hoje não dá, tem gente em casa', '22:43'],
    ['in', 'só um pouco, prometo', '22:44'],
    ['out', 'você sabe que eu não consigo dizer não', '22:46']
  ];
  const EXTRA_MESSAGES = [
    ['in', 'então 22h?', '22:48'],
    ['out', '22h. não se atrasa', '22:49'],
    ['in', 'levo o que você gosta', '22:51'],
    ['out', 'melhor mensagem do dia 🥂', '22:52'],
    ['in', 'apaga essa conversa depois', '22:54'],
    ['out', 'já apaguei 😉', '22:55']
  ];
  const TICKER = [
    'Marina encontrou um número em São Paulo agora',
    'Rafael validou um contato em Curitiba há 32 segundos',
    'Aline desbloqueou um número em Recife há 1 minuto',
    'Carlos localizou um registro em Belo Horizonte agora',
    'Bianca comprou 300 tokens há 2 minutos',
    'Diego encontrou o WhatsApp de um cliente em Manaus agora'
  ];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  const fmt = (n) => n.toLocaleString('pt-BR');

  let state = load();
  let runId = 0;
  let pendingAction = null;
  let pendingSkip = null;
  let selectedPack = PACKS[1];
  let couponApplied = false;
  let ppConfig = null;
  let ppSdkPromise = null;
  let pixInterval = null;
  let queueInterval = null;
  let tickerInterval = null;

  function defaultState() {
    return {
      onboarded: false,
      name: '',
      phone: '',
      tokens: 100,
      plan: 'FREE',
      history: [],
      referrals: { clicks: 0, signups: 0, tokens: 0 },
      lastBonus: null,
      refCode: 'ZD' + Math.floor(100000 + Math.random() * 899999),
      refApplied: false,
      searchesToday: 0
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return defaultState();
      return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) {
      return defaultState();
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify(state, (key, value) => {
        if (key === 'photo' && typeof value === 'string' && value.length > 60000) return undefined;
        return value;
      }));
    } catch (e) {}
  }

  function setScreen(id) {
    ['screenHome', 'screenScan', 'screenResult'].forEach((s) => {
      const el = document.getElementById(s);
      if (el) el.hidden = s !== id;
    });
    $$('.tab').forEach((t) => t.classList.toggle('is-active', id === 'screenHome' && t.dataset.screen === 'home'));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function toast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = msg;
    $('#toastStack').appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity .3s';
      setTimeout(() => el.remove(), 320);
    }, 3200);
  }

  function focusTokens() {
    const el = $('#tokenCount');
    el.classList.remove('is-flash');
    void el.offsetWidth;
    el.classList.add('is-flash');
  }

  function renderWallet() {
    $('#tokenCount').textContent = fmt(state.tokens);
    $('#walletBtn').classList.toggle('is-low', state.tokens < 20);
    const empty = state.tokens < COSTS.search;
    $('#planStrip').classList.toggle('is-empty', empty);
    $('#planBadge').textContent = empty ? 'ESGOTADO' : 'FREE';
    $('#planTitle').textContent = empty ? 'Limite do plano atingido' : 'Plano gratuito ativo';
    $('#planSub').textContent = empty ? 'Recarregue para continuar as análises' : state.tokens + ' tokens disponíveis';
    $('#planRenew').textContent = empty ? 'renove agora' : 'renova em 29d';
  }

  function spend(amount) {
    if (state.tokens < amount) return false;
    state.tokens -= amount;
    save();
    renderWallet();
    focusTokens();
    return true;
  }

  function credit(amount, msg) {
    state.tokens += amount;
    save();
    renderWallet();
    focusTokens();
    if (msg) toast(msg, 'success');
  }

  function formatPhone(digits) {
    const d = digits.replace(/\D/g, '');
    const local = d.length > 11 ? d.slice(-11) : d;
    const ddd = local.slice(0, 2);
    const rest = local.slice(2);
    const tail = rest.length === 9 ? rest.slice(0, 5) + '-' + rest.slice(5) : rest.slice(0, 4) + '-' + rest.slice(4);
    return '(' + ddd + ') ' + tail;
  }

  function normalizePhone(value) {
    let d = value.replace(/\D/g, '');
    if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
    return d;
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rng(seed) {
    let x = seed || 1;
    return () => {
      x ^= x << 13; x >>>= 0;
      x ^= x >> 17;
      x ^= x << 5; x >>>= 0;
      return x / 4294967296;
    };
  }

  function buildRecord(digits) {
    const seed = hash(digits);
    const r = rng(seed);
    const ddd = digits.slice(0, 2);
    const loc = DDD_LOC[ddd] || { city: 'São Paulo', uf: 'SP' };
    const loverSeed = hash('amante|' + digits);
    const localPhoto = '/assets/Foto-' + (1 + (seed % 6)) + '.webp';
    return {
      id: 'ZR-' + String(seed % 1000000).padStart(6, '0'),
      digits,
      ddd,
      full: '+55 ' + formatPhone(digits),
      wa: '55' + digits,
      photo: null,
      localPhoto,
      loverPhoto: '/assets/Foto-' + (1 + (loverSeed % 6)) + '.webp',
      loverName: 'Alex',
      location: loc.city + ' · ' + loc.uf,
      lastSeen: ['há 4 minutos', 'há 18 minutos', 'há 1 hora', 'há 3 horas', 'ontem às 23:41'][seed % 5],
      deleted: 20 + (r() * 30 | 0),
      risk: 62 + (seed % 34),
      totalMessages: 190 + (seed % 70),
      loverPhotoUnlocked: false,
      conversation: false,
      upgraded: false,
      photoSource: 'api',
      unlocked: { lastSeen: false, location: false, deleted: false, risk: false },
      createdAt: Date.now()
    };
  }

  async function fetchWhatsAppPhoto(rec) {
    if (rec.photo) return rec.photo;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 13000);
      const res = await fetch('/api/wa-pic?phone=' + rec.digits, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data && data.photo) {
          rec.photo = data.photo;
          rec.photoSource = 'api';
          return rec.photo;
        }
      }
    } catch (e) {}
    rec.photo = 'https://i.pravatar.cc/400?u=' + rec.digits;
    rec.photoSource = 'fallback';
    return rec.photo;
  }

  function paintAvatar(rec) {
    const img = $('#profilePhoto');
    const fallback = $('#profileFallback');
    const src = rec.photo || rec.localPhoto;
    img.onerror = () => {
      img.hidden = true;
      fallback.hidden = false;
      $('#photoSourceCheck').textContent = '!';
    };
    img.src = src;
    img.hidden = false;
    fallback.hidden = true;
    $('#photoSourceCheck').textContent = rec.photoSource === 'api' ? '✓' : '↺';
  }

  function currentRecord() {
    return state.history.find((h) => h.id === state.currentId) || null;
  }

  function persistRecord(rec) {
    const i = state.history.findIndex((h) => h.id === rec.id);
    if (i >= 0) state.history[i] = rec;
    else state.history.unshift(rec);
    state.history = state.history.slice(0, 12);
    save();
  }

  function historyItem(h) {
    const opened = h.conversation || h.loverPhotoUnlocked;
    const thumb = h.photo || h.localPhoto;
    return `
      <button class="history-item" data-history="${h.id}" type="button">
        <span class="history-avatar"><img src="${thumb}" alt="" onerror="this.style.display='none'"></span>
        <span class="history-copy">
          <strong>${h.full || '+55 ' + formatPhone(h.digits)}</strong>
          <span>${new Date(h.createdAt).toLocaleDateString('pt-BR')} · ${h.totalMessages || 0} mensagens</span>
        </span>
        <span class="history-state ${opened ? '' : 'locked'}">${opened ? 'liberado' : 'bloqueado'}</span>
      </button>`;
  }

  function renderHistory() {
    const list = $('#historyList');
    list.innerHTML = state.history.length
      ? state.history.slice(0, 4).map(historyItem).join('')
      : '<p class="empty-state">Nenhuma busca ainda. Seu primeiro resultado aparece aqui.</p>';
    const modalList = $('#historyModalList');
    if (modalList) {
      modalList.innerHTML = state.history.length
        ? state.history.map(historyItem).join('')
        : '<p class="empty-state">Nenhuma busca registrada.</p>';
    }
  }

  function openModal(id, onClose) {
    closeAllModals(true);
    $('#modalBackdrop').hidden = false;
    const m = document.getElementById(id);
    if (!m) return;
    m.hidden = false;
    m.dataset.onClose = onClose ? '1' : '';
    document.body.style.overflow = 'hidden';
    const focusable = m.querySelector('input, button:not(.modal-close)');
    if (focusable) setTimeout(() => focusable.focus(), 120);
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (!m || m.hidden) return;
    m.hidden = true;
    if ($$('.modal:not([hidden])').length === 0) {
      $('#modalBackdrop').hidden = true;
      document.body.style.overflow = '';
    }
  }

  function closeAllModals(force) {
    if (!force) {
      if (!$('#modalOnboarding').hidden) return;
      if (!$('#modalPaywall').hidden) { cancelPaywall(); return; }
    }
    $$('.modal').forEach((m) => { m.hidden = true; });
    $('#modalBackdrop').hidden = true;
    document.body.style.overflow = '';
  }

  function cancelPaywall() {
    closeModal('modalPaywall');
    if (pendingSkip) {
      const f = pendingSkip;
      pendingSkip = null;
      pendingAction = null;
      f();
    }
  }

  function requireTokens(amount, action) {
    if (state.tokens >= amount) return true;
    pendingAction = action;
    openPaywall(amount);
    return false;
  }

  function openPaywall(need) {
    const needEl = $('#paywallNeed');
    if (needEl) needEl.textContent = need > 0 ? 'Faltam ' + need + ' tokens' : 'Escolha um pacote para recarregar';
    $('#paywallBalance').textContent = state.tokens + ' tokens';
    $('#meterFill').style.width = Math.min(100, (state.tokens / 100) * 100) + '%';
    $('#paywallSub').textContent = need <= 0
      ? 'Mantenha seu radar ativo. Quanto maior o pacote, menor o custo por token.'
      : state.tokens > 0
        ? 'Seu plano FREE chegou ao fim e ainda faltam ' + need + ' tokens para concluir esta análise.'
        : 'Você usou todos os 100 tokens de boas-vindas. Recarregue para continuar a análise deste registro.';
    renderPacks();
    if (ppConfig) applyPpConfig();
    else loadPpConfig();
    openModal('modalPaywall');
  }

  function applyPpConfig() {
    const row = $('#payEmailRow');
    if (row) row.hidden = !ppConfig.configured;
    const btn = $('#paywallBuyBtn');
    if (btn) btn.textContent = ppConfig.configured ? 'Pagar com PerfectPay' : 'Pagar com PIX';
  }

  async function loadPpConfig() {
    try {
      const r = await fetch('/api/pp-config');
      ppConfig = await r.json();
    } catch (e) {
      ppConfig = { configured: false };
    }
    applyPpConfig();
    return ppConfig;
  }

  function ppTotal() {
    return selectedPack.tokens + selectedPack.bonus + (couponApplied ? Math.round(selectedPack.tokens * 0.3) : 0);
  }

  function loadPerfectSdk(url) {
    if (window.Perfect) return Promise.resolve();
    if (ppSdkPromise) return ppSdkPromise;
    ppSdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => { ppSdkPromise = null; reject(new Error('sdk')); };
      document.head.appendChild(s);
    });
    return ppSdkPromise;
  }

  async function beginPayment() {
    if (!ppConfig) await loadPpConfig();
    if (!ppConfig.configured) { openCheckout(); return; }
    const email = ($('#payEmail').value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast('Informe um e-mail válido para o recibo', 'error');
      $('#payEmail').focus();
      return;
    }
    state.email = email;
    save();
    const started = await startPerfectPayment();
    if (!started) toast('Gateway indisponível no momento. Usando PIX.', 'error');
  }

  async function startPerfectPayment() {
    try {
      const res = await fetch('/api/pp-create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pack: selectedPack.id, name: state.name, email: state.email, phone: state.phone })
      });
      const data = await res.json();
      if (!res.ok || !data.client_secret) return false;
      await loadPerfectSdk(ppConfig.sdkUrl);
      if (!window.Perfect) return false;
      const perfect = window.Perfect({ publishableKey: data.publicKey }, { customBackendUrl: data.apiBase });
      const widgets = perfect.widgets({ clientSecret: data.client_secret, appearance: { labels: 'floating' } });
      const total = ppTotal();
      $('#ppPack').textContent = fmt(total) + ' tokens';
      $('#ppPrice').textContent = selectedPack.label;
      $('#perfectElement').innerHTML = '';
      $('#ppMessage').textContent = '';
      $('#ppPayBtn').disabled = false;
      const element = widgets.create('payment', {
        wallets: {
          walletReturnUrl: location.origin,
          applePay: 'auto',
          googlePay: 'auto',
          style: { theme: 'default', type: 'default', height: 55 }
        }
      });
      element.mount('#perfectElement');
      closeModal('modalPaywall');
      openModal('modalPerfectPay');
      localStorage.setItem('pp_pending', JSON.stringify({
        client_secret: data.client_secret,
        pack: selectedPack.id,
        apiBase: data.apiBase,
        publicKey: data.publicKey,
        sdkUrl: ppConfig.sdkUrl,
        total
      }));
      $('#ppPayBtn').onclick = async () => {
        $('#ppPayBtn').disabled = true;
        $('#ppMessage').textContent = 'Processando...';
        try {
          const out = await perfect.confirmPayment({
            elements: widgets,
            confirmParams: { return_url: location.origin + '/acesso/?pagamento=retorno' }
          });
          if (out && out.error) {
            $('#ppMessage').textContent = out.error.message || 'Pagamento não concluído.';
            $('#ppPayBtn').disabled = false;
            return;
          }
          const check = await perfect.retrievePaymentIntent(data.client_secret);
          const status = check && check.paymentIntent && check.paymentIntent.status;
          if (status === 'succeeded') finalizePpPayment();
          else if (status === 'requires_customer_action') $('#ppMessage').textContent = 'Siga as instruções do pagamento.';
          else if (status === 'processing') $('#ppMessage').textContent = 'Pagamento em processamento. O saldo entra assim que aprovado.';
          else { $('#ppMessage').textContent = 'Pagamento não aprovado. Tente novamente.'; $('#ppPayBtn').disabled = false; }
        } catch (e) {
          $('#ppMessage').textContent = 'Falha ao processar o pagamento.';
          $('#ppPayBtn').disabled = false;
        }
      };
      return true;
    } catch (e) {
      return false;
    }
  }

  function finalizePpPayment() {
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem('pp_pending') || 'null'); } catch (e) {}
    const total = pending && pending.total ? pending.total : ppTotal();
    localStorage.removeItem('pp_pending');
    credit(total, '+' + fmt(total) + ' tokens adicionados ao saldo');
    closeModal('modalPerfectPay');
    setTimeout(() => {
      if (pendingAction) {
        const fn = pendingAction;
        pendingAction = null;
        pendingSkip = null;
        fn();
      }
    }, 900);
  }

  async function resumePendingPayment() {
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem('pp_pending') || 'null'); } catch (e) { return; }
    if (!pending || !pending.client_secret) return;
    try {
      if (!ppConfig) await loadPpConfig();
      await loadPerfectSdk(pending.sdkUrl || ppConfig.sdkUrl);
      if (!window.Perfect) return;
      const perfect = window.Perfect({ publishableKey: pending.publicKey || ppConfig.publicKey }, { customBackendUrl: pending.apiBase || ppConfig.apiBase });
      const result = await perfect.retrievePaymentIntent(pending.client_secret);
      const status = result && result.paymentIntent && result.paymentIntent.status;
      if (status === 'succeeded') finalizePpPayment();
      else if (status === 'failed' || status === 'expired') localStorage.removeItem('pp_pending');
    } catch (e) {}
  }

  function renderPacks() {
    $('#packList').innerHTML = PACKS.map((p) => `
      <div class="pack ${p.id === selectedPack.id ? 'is-selected' : ''}" data-pack="${p.id}" role="button" tabindex="0">
        ${p.best ? '<span class="pack-tag">mais vendido</span>' : ''}
        <span class="pack-tokens"><strong>${fmt(p.tokens)} tokens</strong><span>${p.bonus ? '+' + p.bonus + ' de bônus' : 'saldo imediato'}</span></span>
        <span class="pack-price">${p.label}<small>${p.note}</small></span>
      </div>`).join('');
  }

  function selectPack(id) {
    selectedPack = PACKS.find((p) => p.id === id) || PACKS[1];
    renderPacks();
  }

  function openCheckout() {
    const couponBonus = couponApplied ? Math.round(selectedPack.tokens * 0.3) : 0;
    $('#checkoutPack').textContent = fmt(selectedPack.tokens + selectedPack.bonus + couponBonus) + ' tokens' + (couponBonus ? ' · cupom GOD' : '');
    $('#checkoutPrice').textContent = selectedPack.label;
    drawPix(selectedPack.id + state.tokens);
    $('#paymentStatus').classList.remove('is-approved');
    $('#paymentStatusText').innerHTML = 'Aguardando pagamento · expira em <b id="pixTimer">09:58</b>';
    closeModal('modalPaywall');
    openModal('modalCheckout');
    startPixTimer();
  }

  function startPixTimer() {
    clearInterval(pixInterval);
    let left = 598;
    pixInterval = setInterval(() => {
      left--;
      const el = $('#pixTimer');
      if (el) el.textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
      if (left <= 0) {
        clearInterval(pixInterval);
        const s = $('#paymentStatusText');
        if (s) s.textContent = 'PIX expirado. Gere uma nova recarga.';
      }
    }, 1000);
    autoApprove();
  }

  let approveTimeout = null;
  function autoApprove() {
    clearTimeout(approveTimeout);
    approveTimeout = setTimeout(() => confirmPayment(true), 17000);
  }

  function confirmPayment(manual) {
    const box = $('#paymentStatus');
    if (box.classList.contains('is-approved')) return;
    $('#paymentStatusText').textContent = 'Verificando comprovante no banco...';
    clearInterval(pixInterval);
    setTimeout(() => {
      box.classList.add('is-approved');
      $('#paymentStatusText').textContent = 'Pagamento aprovado · saldo liberado';
      const total = selectedPack.tokens + selectedPack.bonus + (couponApplied ? Math.round(selectedPack.tokens * 0.3) : 0);
      credit(total, '+' + fmt(total) + ' tokens adicionados ao saldo');
      setTimeout(() => {
        closeModal('modalCheckout');
        if (pendingAction) {
          const fn = pendingAction;
          pendingAction = null;
          pendingSkip = null;
          fn();
        }
      }, 1300);
    }, manual ? 2200 : 1400);
  }

  function drawPix(seedStr) {
    const c = $('#pixCanvas');
    const ctx = c.getContext('2d');
    const size = 29;
    const cell = c.width / size;
    const seed = hash('pix' + seedStr + Date.now().toString().slice(0, -4));
    const r = rng(seed);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#0f172a';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (r() > 0.52) ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    const finder = (fx, fy) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(fx * cell, fy * cell, 7 * cell, 7 * cell);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(fx * cell, fy * cell, 7 * cell, cell);
      ctx.fillRect(fx * cell, (fy + 6) * cell, 7 * cell, cell);
      ctx.fillRect(fx * cell, fy * cell, cell, 7 * cell);
      ctx.fillRect((fx + 6) * cell, fy * cell, cell, 7 * cell);
      ctx.fillRect((fx + 2) * cell, (fy + 2) * cell, 3 * cell, 3 * cell);
    };
    finder(0, 0); finder(size - 7, 0); finder(0, size - 7);
    const code = '00020126580014BR.GOV.BCB.PIX0136' + state.refCode + '5204000053039865406' + selectedPack.price.toFixed(2).replace('.', '') + '5802BR5913ZAPRADAR LTDA6009SAO PAULO62070503***6304';
    $('#pixCode').textContent = code + (seed % 9000 + 1000);
  }

  function renderResult(rec) {
    state.currentId = rec.id;
    save();
    $('#resultId').textContent = '#' + rec.id;
    $('#resultPhone').textContent = rec.full;
    $('#resultStatus').textContent = 'WhatsApp ativo agora · ' + (DDD_LOC[rec.ddd] ? DDD_LOC[rec.ddd].city : 'Brasil');
    paintAvatar(rec);
    renderLover(rec);
    renderChat(rec);
    renderDetails(rec);
    renderWallet();
    setScreen('screenResult');
  }

  function renderLover(rec) {
    $('#loverImg').src = rec.loverPhoto;
    $('#chatLoverImg').src = rec.loverPhoto;
    $('#loverImg').classList.toggle('is-blurred', !rec.loverPhotoUnlocked);
    $('#chatLoverImg').classList.toggle('is-blurred', !rec.loverPhotoUnlocked);
    $('#loverOverlay').hidden = rec.loverPhotoUnlocked;
    $('#loverName').textContent = rec.loverPhotoUnlocked ? rec.loverName : '•••••';
    $('#loverMeta').textContent = rec.loverPhotoUnlocked ? 'foto revelada · alta afinidade' : '1 foto · alta afinidade';
    $('#chatLoverName').textContent = rec.loverPhotoUnlocked ? rec.loverName : '•••••';
    $('#chatLoverStatus').textContent = rec.loverPhotoUnlocked ? 'online agora' : 'contato oculto';
    $('#loverPhotoBtn').innerHTML = '<span>Ver foto completa</span><span class="btn-cost">' + COSTS.loverPhoto + ' tokens</span>';
    $('#chatBadge').textContent = rec.conversation ? 'completa' : 'amante';
  }

  function renderChat(rec) {
    const msgs = rec.conversation ? AMBIGUOUS_MESSAGES.concat(EXTRA_MESSAGES) : AMBIGUOUS_MESSAGES;
    $('#chatBody').innerHTML = msgs.map(([dir, text, time]) => `
      <div class="bubble bubble-${dir}">${text} <span class="bubble-time">${time}${dir === 'out' ? ' ✓✓' : ''}</span></div>`).join('');
    $('#chatNote').textContent = rec.conversation
      ? 'Conversa completa · ' + rec.totalMessages + ' mensagens · 12 áudios · 6 fotos'
      : msgs.length + ' de ' + rec.totalMessages + ' mensagens · 12 áudios · 6 fotos';
    $('#dripCard').classList.toggle('is-done', rec.conversation);
    $('#dripCard').querySelector('strong').textContent = rec.conversation ? 'Conversa completa liberada' : 'Conversa completa bloqueada';
    $('#dripCard').querySelector('p').textContent = rec.conversation
      ? 'A IA reconstruiu todas as mensagens disponíveis deste número. O restante do histórico é anterior ao período analisado.'
      : 'A IA separou as ' + rec.totalMessages + ' mensagens, 12 áudios e 6 fotos com maior afinidade. Veja o restante da conversa.';
    $('#conversationBtn').hidden = rec.conversation;
  }

  function renderDetails(rec) {
    let open = 0;
    $$('.detail-row').forEach((row) => {
      const key = row.dataset.detail;
      if (rec.unlocked[key]) open++;
      row.classList.toggle('is-open', rec.unlocked[key]);
      row.querySelector('.detail-lock').innerHTML = rec.unlocked[key] ? 'liberado ✓' : '<span>' + COSTS[key] + '</span> 🔒';
      row.querySelectorAll('.detail-value').forEach((e) => e.remove());
      if (rec.unlocked[key]) {
        const val = document.createElement('div');
        val.className = 'detail-value';
        if (key === 'lastSeen') val.textContent = 'Ativo ' + rec.lastSeen;
        else if (key === 'location') val.textContent = rec.location;
        else if (key === 'deleted') val.textContent = rec.deleted + ' mensagens apagadas nos últimos 7 dias';
        else val.textContent = rec.risk + '/100 · ' + (rec.risk > 80 ? 'alto risco de interação' : 'risco moderado');
        row.querySelector('.detail-copy').appendChild(val);
      }
    });
    $('#detailsCount').textContent = open + ' de 4 desbloqueados';
  }

  function unlockDetail(key) {
    const rec = currentRecord();
    if (!rec || rec.unlocked[key]) return;
    if (!requireTokens(COSTS[key], () => unlockDetail(key))) return;
    spend(COSTS[key]);
    rec.unlocked[key] = true;
    persistRecord(rec);
    renderResult(rec);
    toast('Detalhe desbloqueado', 'success');
  }

  function unlockLoverPhoto() {
    const rec = currentRecord();
    if (!rec || rec.loverPhotoUnlocked) return;
    if (!requireTokens(COSTS.loverPhoto, unlockLoverPhoto)) return;
    spend(COSTS.loverPhoto);
    rec.loverPhotoUnlocked = true;
    persistRecord(rec);
    renderResult(rec);
    toast('Foto revelada · ' + rec.loverName + ' é o contato mais próximo', 'success');
  }

  function unlockConversation() {
    const rec = currentRecord();
    if (!rec || rec.conversation) return;
    if (!requireTokens(COSTS.conversation, unlockConversation)) return;
    spend(COSTS.conversation);
    rec.conversation = true;
    persistRecord(rec);
    renderResult(rec);
    toast('Conversa completa liberada', 'success');
  }

  const STAGES = [
    { pct: 8, title: 'Validando número no WhatsApp', ai: 'consultando se o número tem WhatsApp ativo…' },
    { pct: 22, title: 'Baixando foto de perfil', ai: 'puxando a foto direto pela API do WhatsApp…' },
    { pct: 36, title: 'Lendo conversas recentes', ai: 'lendo as últimas mensagens do aparelho…' },
    { pct: 52, title: 'Identificando contato oculto', ai: 'encontrei 1 contato com altíssima afinidade…' },
    { pct: 68, title: 'Analisando padrões da conversa', ai: 'as mensagens indicam encontros fora de hora…' },
    { pct: 84, title: 'Selecionando fotos e áudios', ai: 'separei 6 fotos e 12 áudios para o relatório…' },
    { pct: 97, title: 'Montando o dossiê', ai: 'finalizando o relatório do número…' }
  ];

  function aiSay(text) {
    const el = $('#aiThinking');
    if (!el) return;
    el.classList.remove('is-new');
    void el.offsetWidth;
    el.textContent = text;
    el.classList.add('is-new');
  }

  function resetScanUI(rec) {
    $('#aiStatus').textContent = 'analisando ' + rec.full + '…';
    aiSay('Conectando ao WhatsApp…');
    $('#stageList').innerHTML = STAGES.map((s, i) => `<li class="ai-step" data-stage="${i}"><span class="ai-step-mark"></span><span class="ai-step-title">${s.title}</span><span class="ai-step-pct"></span></li>`).join('');
    $('#progressFill').style.width = '0%';
    $('#progressPercent').textContent = '0%';
    $('#progressStage').textContent = 'Iniciando análise';
    $('#scanSpent').textContent = COSTS.search + ' tokens';
    $('#scanEta').textContent = 'ETA 00:42';
    $('#queueCard').hidden = true;
    $('#priorityBtn').disabled = false;
    $('#queueSkip').disabled = false;
  }

  async function startScan(rec) {
    const myRun = ++runId;
    let upgraded = false;

    let left = 42;
    const etaTick = setInterval(() => {
      left = Math.max(0, left - 1);
      $('#scanEta').textContent = 'ETA 00:' + String(left).padStart(2, '0');
      if (left === 0) clearInterval(etaTick);
    }, 1000);

    const wait = new Promise((resolve) => {
      $('#queueCard').hidden = false;
      let q = 47;
      $('#queuePosition').textContent = 'posição ' + q;
      const clockStart = Date.now();
      const total = 95;
      queueInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - clockStart) / 1000);
        const remaining = Math.max(0, total - elapsed);
        $('#queueClock').textContent = String(Math.floor(remaining / 60)).padStart(2, '0') + ':' + String(remaining % 60).padStart(2, '0');
        if (elapsed % 9 === 0) {
          q = Math.max(1, q - 3);
          $('#queuePosition').textContent = 'posição ' + q;
        }
        if (remaining === 0) {
          clearInterval(queueInterval);
          aiSay('sua análise chegou na vez. iniciando o dossiê…');
          resolve();
        }
      }, 1000);

      let priorityUsed = false;
      const priority = async () => {
        if (priorityUsed) return;
        if ($('#queueCard').hidden) return;
        priorityUsed = true;
        if (!state.tokens) { priorityUsed = false; return; }
        if (!spend(COSTS.priority)) {
          pendingAction = () => { priorityUsed = false; priority(); };
          openPaywall(COSTS.priority);
          return;
        }
        $('#scanSpent').textContent = (COSTS.search + COSTS.priority) + ' tokens';
        clearInterval(queueInterval);
        $('#queueCard').hidden = true;
        aiSay('prioridade ativada. a IA começou por você…');
        resolve();
      };
      $('#priorityBtn').onclick = priority;
      $('#queueSkip').onclick = () => {
        clearInterval(queueInterval);
        $('#queueCard').hidden = true;
        aiSay('aguardando na fila padrão. a IA chama você em instantes…');
        resolve();
      };
    });

    await wait;
    if (myRun !== runId) return;
    $('#queueCard').hidden = true;
    await sleep(1200);

    for (let i = 0; i < STAGES.length; i++) {
      if (myRun !== runId) return;
      const stage = STAGES[i];
      const li = $('.ai-step[data-stage="' + i + '"]');
      $$('.ai-step').forEach((s) => s.classList.remove('is-active'));
      if (li) li.classList.add('is-active');
      $('#progressStage').textContent = stage.title;
      aiSay(stage.ai);
      if (i === 1) await Promise.race([fetchWhatsAppPhoto(rec), sleep(9000)]);
      const target = stage.pct;
      $('#progressFill').style.width = target + '%';
      let shown = i === 0 ? 0 : STAGES[i - 1].pct;
      const tick = setInterval(() => {
        shown = Math.min(target, shown + 1);
        $('#progressPercent').textContent = shown + '%';
      }, 34);
      await sleep(1500 + Math.random() * 1100);
      clearInterval(tick);
      $('#progressPercent').textContent = target + '%';
      if (li) {
        li.classList.remove('is-active');
        li.classList.add('is-done');
        const pct = li.querySelector('.ai-step-pct');
        if (pct) pct.textContent = 'ok';
      }
    }

    if (myRun !== runId) return;

    if (!upgraded) {
      const confirmed = await extraCheck(rec);
      if (!confirmed) {
        rec.accuracy = Math.max(41, rec.accuracy - 17);
        rec.partial = true;
        aiSay('seguindo com resultado parcial. alguns registros ficaram de fora…');
      } else {
        rec.accuracy = Math.min(97, rec.accuracy + 6);
        rec.upgraded = true;
      }
    }

    if (myRun !== runId) return;
    $('#progressStage').textContent = 'Análise concluída';
    $('#progressFill').style.width = '100%';
    $('#progressPercent').textContent = '100%';
    aiSay('análise concluída. abrindo o dossiê do número…');
    await sleep(1100);
    clearInterval(etaTick);
    persistRecord(rec);
    renderResult(rec);
    toast('Análise concluída. Veja o que a IA encontrou.', 'success');
  }

  function extraCheck(rec) {
    return new Promise((resolve) => {
      if (!rec) return resolve(false);
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        pendingSkip = null;
        closeModal('modalUpgrade');
        resolve(ok);
      };
      $('#upgradeCost').textContent = COSTS.extraCheck;
      openModal('modalUpgrade');
      $('#upgradeSkipBtn').onclick = () => { pendingAction = null; finish(false); };
      $('#upgradeConfirmBtn').onclick = () => {
        if (spend(COSTS.extraCheck)) {
          $('#scanSpent').textContent = (COSTS.search + COSTS.extraCheck) + ' tokens';
          aiSay('verificação extra autorizada. confirmando o contato…');
          finish(true);
          return;
        }
        pendingAction = () => {
          if (spend(COSTS.extraCheck)) {
            $('#scanSpent').textContent = (COSTS.search + COSTS.extraCheck) + ' tokens';
            aiSay('verificação extra autorizada. confirmando o contato…');
            finish(true);
          } else {
            finish(false);
          }
        };
        pendingSkip = () => finish(false);
        openPaywall(COSTS.extraCheck);
      };
    });
  }

  function doSearch() {
    const digits = normalizePhone($('#personPhone').value);
    const err = $('#phoneError');
    if (digits.length < 10 || digits.length > 11) {
      err.classList.add('show');
      $('#personPhone').focus();
      return;
    }
    err.classList.remove('show');
    if (!requireTokens(COSTS.search, doSearch)) return;
    spend(COSTS.search);
    state.searchesToday++;
    const rec = buildRecord(digits);
    resetScanUI(rec);
    setScreen('screenScan');
    startScan(rec);
  }

  function claimBonus() {
    const today = new Date().toDateString();
    if (state.lastBonus === today) {
      toast('Bônus de hoje já resgatado');
      return;
    }
    state.lastBonus = today;
    save();
    credit(10, '+10 tokens de bônus diário');
    $('#bonusCard').classList.add('is-claimed');
    $('#dailyBonusBtn').disabled = true;
  }

  function renderBonus() {
    const today = new Date().toDateString();
    const claimed = state.lastBonus === today;
    $('#bonusCard').classList.toggle('is-claimed', claimed);
    $('#dailyBonusBtn').disabled = claimed;
    $('#dailyBonusBtn').textContent = claimed ? 'Resgatado' : 'Resgatar';
  }

  function openReferral() {
    state.referrals.clicks++;
    save();
    const link = 'https://zapradar.app/?ref=' + state.refCode;
    $('#shareLink').textContent = link;
    $('#refClicks').textContent = state.referrals.clicks;
    $('#refSignups').textContent = state.referrals.signups;
    $('#refTokens').textContent = state.referrals.tokens;
    openModal('modalReferral');
  }

  function copyRef() {
    const link = 'https://zapradar.app/?ref=' + state.refCode;
    copy(link);
    toast('Link copiado. Envie para seus amigos.', 'success');
    setTimeout(() => {
      if (state.referrals.signups < state.referrals.clicks + 1) {
        state.referrals.signups++;
        state.referrals.tokens += 75;
        credit(75, 'Seu convite foi aceito · +75 tokens');
        save();
      }
    }, 4200);
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
  }

  function supportReply(text) {
    const body = $('#supportBody');
    const out = document.createElement('div');
    out.className = 'support-msg support-msg-out';
    out.textContent = text;
    body.appendChild(out);
    const typing = document.createElement('div');
    typing.className = 'support-msg support-msg-in support-msg-typing';
    typing.textContent = 'digitando...';
    body.appendChild(typing);
    body.scrollTop = body.scrollHeight;
    setTimeout(() => {
      typing.remove();
      const t = text.toLowerCase();
      let reply = 'Cada busca consome 35 tokens. Se o saldo acabar, a recarga libera o número na hora.';
      if (t.includes('acab')) reply = 'Seus 100 tokens gratuitos são únicos. O plano de 800 tokens com bônus é o mais usado e libera a análise completa.';
      if (t.includes('errado')) reply = 'A foto é puxada direto da API do WhatsApp. Se a conversa não for do contato, refaça a análise com o número completo com DDD.';
      if (t.includes('free') || t.includes('plano')) reply = 'O plano FREE dá 100 tokens de boas-vindas. A análise custa 35, a foto do amante 45 e a conversa completa 45. Depois disso, só recarregando.';
      const inMsg = document.createElement('div');
      inMsg.className = 'support-msg support-msg-in';
      inMsg.textContent = reply;
      body.appendChild(inMsg);
      body.scrollTop = body.scrollHeight;
    }, 1100);
  }

  function bind() {
    $('#onboardForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#onboardName').value.trim();
      const phone = $('#onboardPhone').value.replace(/\D/g, '');
      if (name.length < 2 || phone.length < 10) {
        toast('Preencha seu nome e um WhatsApp válido', 'error');
        return;
      }
      state.name = name;
      state.phone = phone;
      state.onboarded = true;
      const ref = new URLSearchParams(location.search).get('ref');
      if (ref) {
        state.refApplied = true;
        state.tokens += 25;
      }
      save();
      closeModal('modalOnboarding');
      renderWallet();
      toast(ref ? 'Acesso ativado · +125 tokens (bônus de indicação)' : 'Acesso ativado · 100 tokens de boas-vindas', 'success');
      if (ref) setTimeout(() => toast('Convite validado. Você também pode indicar e ganhar.'), 2600);
    });

    $('#onboardPhone').addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 11);
      if (v.length > 6) v = '(' + v.slice(0, 2) + ') ' + v.slice(2, 7) + '-' + v.slice(7);
      else if (v.length > 2) v = '(' + v.slice(0, 2) + ') ' + v.slice(2);
      e.target.value = v;
    });

    $('#searchForm').addEventListener('submit', (e) => { e.preventDefault(); doSearch(); });
    $('#personPhone').addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 11 && v.startsWith('55')) v = v.slice(2);
      v = v.slice(0, 11);
      if (v.length > 6) v = '(' + v.slice(0, 2) + ') ' + v.slice(2, 7) + '-' + v.slice(7);
      else if (v.length > 2) v = '(' + v.slice(0, 2) + ') ' + v.slice(2);
      e.target.value = v;
      $('#phoneError').classList.remove('show');
    });

    $('#walletBtn').addEventListener('click', () => { openPaywall(state.tokens < 20 ? 20 : 0); });
    $('#buyTokensBtn').addEventListener('click', openPaywall);
    $('#paywallBuyBtn').addEventListener('click', beginPayment);
    $('#packList').addEventListener('click', (e) => {
      const p = e.target.closest('[data-pack]');
      if (p) selectPack(p.dataset.pack);
    });
    $('#packList').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const p = e.target.closest('[data-pack]');
      if (p) { e.preventDefault(); selectPack(p.dataset.pack); }
    });

    $('#couponBtn').addEventListener('click', () => {
      const v = $('#couponInput').value.trim().toUpperCase();
      if (couponApplied) return toast('Cupom já aplicado');
      if (v === 'GOD' || v === '#GOD') {
        couponApplied = true;
        toast('Cupom GOD aplicado · +30% de tokens', 'success');
        $('#couponBtn').textContent = 'Aplicado';
        $('#couponBtn').disabled = true;
      } else if (v) {
        toast('Cupom inválido', 'error');
      }
    });

    $('#copyPixBtn').addEventListener('click', () => {
      copy($('#pixCode').textContent);
      toast('Código PIX copiado');
    });
    $('#simulatePayBtn').addEventListener('click', () => confirmPayment(true));

    $('#loverPhotoBtn').addEventListener('click', unlockLoverPhoto);
    $('#conversationBtn').addEventListener('click', unlockConversation);
    $('#newSearchBtn').addEventListener('click', () => { setScreen('screenHome'); $('#personPhone').focus(); });
    $('#detailList').addEventListener('click', (e) => {
      const row = e.target.closest('[data-detail]');
      if (row) unlockDetail(row.dataset.detail);
    });

    const openHistory = (id) => {
      state.currentId = id;
      const rec = currentRecord();
      renderResult(rec);
      if (rec && !rec.photo) fetchWhatsAppPhoto(rec).then(() => renderResult(rec));
    };
    $('#historyList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-history]');
      if (b) openHistory(b.dataset.history);
    });
    $('#historyModalList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-history]');
      if (b) { closeModal('modalHistory'); openHistory(b.dataset.history); }
    });
    $('#clearHistory').addEventListener('click', () => {
      state.history = [];
      state.currentId = null;
      save();
      renderHistory();
      toast('Histórico limpo');
    });

    $('#referralBtn').addEventListener('click', openReferral);
    $('#copyRefBtn').addEventListener('click', copyRef);
    $('#dailyBonusBtn').addEventListener('click', claimBonus);

    $('#supportFab').addEventListener('click', () => { openModal('modalSupport'); $('.support-badge').hidden = true; });
    $('#supportForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = $('#supportInput').value.trim();
      if (!v) return;
      supportReply(v);
      $('#supportInput').value = '';
    });
    $('#supportQuick').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) supportReply(b.dataset.q);
    });

    $$('[data-open]').forEach((b) => b.addEventListener('click', () => {
      const what = b.dataset.open;
      $$('.tab').forEach((t) => t.classList.toggle('is-active', t === b));
      if (what === 'history') { renderHistory(); openModal('modalHistory'); }
      if (what === 'store') openPaywall(state.tokens < 20 ? 20 : 0);
      if (what === 'support') { openModal('modalSupport'); $('.support-badge').hidden = true; }
    }));

    $$('[data-modal]').forEach((b) => b.addEventListener('click', () => {
      const id = 'modal' + b.dataset.modal[0].toUpperCase() + b.dataset.modal.slice(1);
      openModal(id);
    }));

    $$('[data-close]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.close === 'modalPaywall') cancelPaywall();
      else closeModal(b.dataset.close);
    }));
    $('#modalBackdrop').addEventListener('click', () => closeAllModals());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllModals(); });
  }

  function startTicker() {
    let i = 0;
    tickerInterval = setInterval(() => {
      i = (i + 1) % TICKER.length;
      const el = $('#tickerText');
      el.style.opacity = '0';
      setTimeout(() => { el.textContent = TICKER[i]; el.style.opacity = '1'; }, 260);
    }, 6500);
  }

  function init() {
    bind();
    renderWallet();
    renderHistory();
    renderBonus();
    startTicker();
    loadPpConfig();
    resumePendingPayment();
    $('#tickerText').style.transition = 'opacity .25s';
    if (!state.onboarded) {
      setTimeout(() => openModal('modalOnboarding'), 450);
    }
    const ref = new URLSearchParams(location.search).get('ref');
    if (ref && state.onboarded && !state.refApplied) {
      setTimeout(() => toast('Convite ' + ref + ' identificado · ative sua conta para ganhar bônus'), 1200);
    }
  }

  init();
})();
