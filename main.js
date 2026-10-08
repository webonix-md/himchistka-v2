/* PUFOS — меню, калькулятор, комплекты, до/после, появление блоков */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmt = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };

  /* ---------- шапка и мобильное меню ---------- */
  var hdr = $('#hdr');
  var onScroll = function () { hdr.classList.toggle('scrolled', window.scrollY > 10); };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  var burger = $('#burger'), nav = $('#nav');
  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', open);
  });
  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') { nav.classList.remove('open'); burger.setAttribute('aria-expanded', false); }
  });

  /* ---------- уведомление ---------- */
  var toast = $('#toast'), tTimer;
  function say(text) {
    toast.textContent = text;
    toast.classList.add('on');
    clearTimeout(tTimer);
    tTimer = setTimeout(function () { toast.classList.remove('on'); }, 3600);
  }

  // Viber не принимает текст в ссылке на чат — копируем его в буфер
  function copy(text, done) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () {});
    } else {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      ta.remove();
    }
  }

  /* ---------- WhatsApp с готовым текстом ---------- */
  $$('.js-wa-plain').forEach(function (a) {
    a.href = a.href.split('?')[0] + '?text=' + encodeURIComponent(a.dataset.text);
  });

  /* ---------- данные цен ---------- */
  var dataEl = $('#calc-data');
  var D = JSON.parse(dataEl.textContent);
  var cur = D.currency;
  var items = {};
  D.groups.forEach(function (g, gi) { g.items.forEach(function (it) { it.group = gi; items[it.id] = it; }); });

  // цены «от …» в карточках берутся из того же JSON
  $$('[data-from]').forEach(function (el) {
    var k = el.dataset.from;
    if (k === 'min') el.textContent = fmt(D.minOrder);
    else if (items[k]) el.textContent = fmt(items[k].price);
  });
  $$('.js-free').forEach(function (el) { el.textContent = D.rugFreeFrom; });
  $$('.js-disc').forEach(function (el) { el.textContent = D.setDiscount; });

  /* ---------- калькулятор ---------- */
  var list = $('#calc-list'), tabs = $('#calc-tabs'), sum = $('#sum');
  var qty = {};
  var groupsEl = [];

  D.groups.forEach(function (g, gi) {
    var t = document.createElement('button');
    t.className = 'tab'; t.type = 'button'; t.setAttribute('role', 'tab');
    t.setAttribute('aria-selected', gi === 0); t.textContent = g.title;
    t.addEventListener('click', function () { showGroup(gi); });
    tabs.appendChild(t);

    var box = document.createElement('div');
    box.className = 'calc__group'; box.hidden = gi !== 0;
    g.items.forEach(function (it) {
      var row = document.createElement('div');
      row.className = 'row'; row.dataset.id = it.id;
      var unit = it.unit ? '<small>/' + it.unit + '</small>' : '';
      row.innerHTML =
        '<div class="row__name">' + it.name + (it.note ? '<small>' + it.note + '</small>' : '') + '</div>' +
        '<div class="row__price">' + fmt(it.price) + ' ' + cur + unit + '</div>' +
        '<div class="qty"><button type="button" data-d="-1" aria-label="−"><svg class="ico"><use href="#i-minus"/></svg></button>' +
        '<input type="number" inputmode="numeric" min="0" max="999" value="0" aria-label="' + it.name + (it.unit ? ', ' + it.unit : '') + '">' +
        '<button type="button" data-d="1" aria-label="+"><svg class="ico"><use href="#i-plus"/></svg></button></div>';
      box.appendChild(row);
    });
    list.appendChild(box);
    groupsEl.push(box);
  });

  function showGroup(gi) {
    groupsEl.forEach(function (b, i) { b.hidden = i !== gi; });
    $$('.tab', tabs).forEach(function (t, i) { t.setAttribute('aria-selected', i === gi); });
  }

  function setQty(id, v) {
    v = Math.max(0, Math.min(999, Math.round(+v || 0)));
    qty[id] = v;
    var row = $('.row[data-id="' + id + '"]', list);
    $('input', row).value = v;
    row.classList.toggle('on', v > 0);
    update();
  }

  list.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-d]'); if (!b) return;
    var id = b.closest('.row').dataset.id;
    setQty(id, (qty[id] || 0) + (+b.dataset.d));
  });
  list.addEventListener('input', function (e) {
    if (e.target.tagName !== 'INPUT') return;
    var id = e.target.closest('.row').dataset.id;
    setQty(id, e.target.value);
  });

  function lineText(it, n) {
    return it.name + (it.note ? ' (' + it.note + ')' : '') + (it.unit ? ': ' + n + ' ' + it.unit : ' × ' + n);
  }

  var total = 0;
  function message() {
    var lines = [sum.dataset.msgHead];
    Object.keys(qty).forEach(function (id) {
      if (qty[id] > 0) lines.push('— ' + lineText(items[id], qty[id]));
    });
    lines.push(sum.dataset.msgTotal.replace('{sum}', fmt(total)));
    lines.push(sum.dataset.msgTail);
    return lines.join('\n');
  }

  var wa = $('.js-wa', sum), waBase = wa.getAttribute('href');
  function update() {
    var ul = $('#sum-list'); ul.innerHTML = '';
    total = 0;
    var rugM2 = 0, any = false;
    Object.keys(qty).forEach(function (id) {
      var n = qty[id]; if (!n) return;
      var it = items[id]; any = true;
      var s = it.price * n; total += s;
      if (it.rug) rugM2 += n;
      var li = document.createElement('li');
      li.innerHTML = '<span>' + lineText(it, n) + '</span><b>' + fmt(s) + ' ' + cur + '</b>';
      ul.appendChild(li);
    });
    if (!any) ul.innerHTML = '<li class="sum__empty">' + sum.dataset.empty + '</li>';
    $('#sum-total').textContent = fmt(total) + ' ' + cur;

    var warn = [];
    if (any && total < D.minOrder) warn.push(sum.dataset.min.replace('{min}', fmt(D.minOrder)));
    if (rugM2 > 0 && rugM2 < D.rugFreeFrom) warn.push(sum.dataset.rugfree.replace('{free}', D.rugFreeFrom).replace('{m2}', rugM2));
    $('#sum-warn').textContent = warn.join(' ');

    wa.href = waBase + '?text=' + encodeURIComponent(any ? message() : sum.dataset.msgHead);
  }

  $('.js-viber', sum).addEventListener('click', function () {
    copy(message(), function () { say(sum.dataset.copied); });
  });

  // «+» в карточках услуг — добавить предмет и перейти к калькулятору
  $$('[data-add]').forEach(function (b) {
    b.addEventListener('click', function () {
      var it = items[b.dataset.add]; if (!it) return;
      setQty(it.id, (qty[it.id] || 0) + (it.unit ? 5 : 1));
      showGroup(it.group);
      say(sum.dataset.added.replace('{name}', it.name));
      $('#calc').scrollIntoView({ behavior: 'smooth' });
    });
  });

  update();

  /* ---------- комплекты ---------- */
  function setPrice(key) {
    var s = 0, set = D.sets[key];
    Object.keys(set).forEach(function (id) { s += items[id].price * set[id]; });
    var disc = Math.floor(s * (1 - D.setDiscount / 100) / 10) * 10;
    return { full: s, price: disc };
  }
  $$('.set__price[data-set]').forEach(function (el) {
    var p = setPrice(el.dataset.set);
    el.innerHTML = '<b>' + fmt(p.price) + ' ' + cur + '</b><s>' + fmt(p.full) + ' ' + cur + '</s>';
  });
  $$('.js-set').forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.dataset.set, set = D.sets[key], p = setPrice(key);
      var lines = [sum.dataset.setMsg.replace('{title}', b.dataset.title)];
      Object.keys(set).forEach(function (id) { lines.push('— ' + lineText(items[id], set[id])); });
      lines.push(sum.dataset.msgTotal.replace('{sum}', fmt(p.price)));
      lines.push(sum.dataset.msgTail);
      window.open(waBase + '?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
    });
  });

  /* ---------- до / после ---------- */
  var ba = $('#ba');
  if (ba) {
    var range = $('.ba__range', ba);
    var setPos = function () { ba.style.setProperty('--pos', range.value + '%'); };
    range.addEventListener('input', setPos); setPos();
    $$('[data-ba]').forEach(function (t) {
      t.addEventListener('click', function () {
        $$('[data-ba]').forEach(function (x) { x.setAttribute('aria-selected', x === t); });
        var k = t.dataset.ba;
        $('.ba__before', ba).src = 'img/ba-' + k + '-before.webp';
        $('.ba__after', ba).src = 'img/ba-' + k + '-after.webp';
        range.value = 50; setPos();
      });
    });
  }

  /* ---------- появление при прокрутке ---------- */
  var rv = $$('.rv');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    rv.forEach(function (el) { io.observe(el); });
  } else {
    rv.forEach(function (el) { el.classList.add('in'); });
  }
})();
