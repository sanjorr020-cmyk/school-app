// Пакеты занятий, история уровня и воронка заявок. Работает поверх app.js:
// использует window.schoolState / schoolSave / schoolRender и хук window.onSchoolRender.

(function () {
  const ADMIN_MODE = new URLSearchParams(window.location.search).get('demo') === 'admin';
  'use strict';

  const CONFIG = window.SCHOOL_CONFIG || {};
  const PACKAGE_SIZE = CONFIG.packageSize || 12;
  const LEVELS = CONFIG.levels || ['Beginner', 'Elementary', 'Pre-Intermediate', 'Intermediate', 'Upper-Intermediate', 'Advanced'];
  const PLACES = CONFIG.places || ['Филиал 1', 'Филиал 2', 'Онлайн'];
  const STAGES = { new: 'Новая', consult: 'Консультация', trial: 'Пробное занятие', package: 'Пакет оформлен', lost: 'Не оформил' };
  const USED_STATUSES = ['present', 'late', 'absent'];

  const $ = (id) => document.getElementById(id);
  const state = () => window.schoolState();
  const save = () => window.schoolSave();
  const render = () => window.schoolRender();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const fmt = (iso) => {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  };
  const newId = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // Занятия пакета: отметки «был», «опоздал», «не был» с даты начала пакета.
  function usedLessons(student) {
    if (!student.package) return 0;
    let n = 0;
    Object.entries(state().attendance).forEach(([date, day]) => {
      if (date >= student.package.start && USED_STATUSES.includes(day[student.id])) n += 1;
    });
    return n;
  }

  function lessonsLeft(student) {
    return student.package ? Math.max(0, student.package.total - usedLessons(student)) : null;
  }

  function monthsBetween(a, b) {
    const [ay, am] = a.split('-').map(Number);
    const [by, bm] = b.split('-').map(Number);
    return Math.max(0, (by - ay) * 12 + (bm - am));
  }

  const sortedLevels = (s) => (s.levels || []).slice().sort((a, b) => a.date.localeCompare(b.date));

  // ---------- Карточка ученика: место, пакет, уровни ----------
  let selectedId = null;

  function renderDetail() {
    const box = $('student-detail');
    if (!box) return;
    const s = state().students.find((x) => x.id === selectedId);
    if (!s) {
      box.innerHTML = '';
      return;
    }
    const left = lessonsLeft(s);
    const levels = sortedLevels(s);
    box.innerHTML = `
      <div class="detail">
        <h3>${esc(s.name)}, ${esc(s.class)}</h3>
        <div class="row filter">
          <label>Место занятий:
            <select id="ex-place">${PLACES.map((p) => `<option ${s.place === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
          </label>
        </div>

        <h3>Пакет занятий</h3>
        ${s.package
          ? `<p class="summary">Осталось ${left} из ${s.package.total}. Пакет с ${fmt(s.package.start)}.</p>
             ${left <= 2 ? '<p class="warn">Пора продлить пакет.</p>' : ''}`
          : '<p class="summary">Пакет ещё не оформлен.</p>'}
        <div class="row">
          <input id="ex-pkg-total" type="number" min="1" max="60" value="${s.package ? s.package.total : PACKAGE_SIZE}" />
          <input id="ex-pkg-start" type="date" value="${s.package ? s.package.start : todayISO()}" />
          <button type="button" class="btn" id="ex-pkg-save">Сохранить пакет</button>
        </div>
        <p class="summary">Занятия списываются автоматически: каждая отметка «был», «опоздал» или «не был» с даты начала пакета уменьшает остаток.</p>

        <h3>История уровня</h3>
        ${levels.length ? levels.map((l) => `
          <div class="card">
            <div><b>${esc(l.level)}</b> <span class="meta">${fmt(l.date)}</span></div>
            <button type="button" class="att-btn" data-ex-del-level="${l.id}">Удалить</button>
          </div>`).join('') : '<div class="empty">Уровни ещё не записаны.</div>'}
        <div class="row">
          <select id="ex-level">${LEVELS.map((l) => `<option>${esc(l)}</option>`).join('')}</select>
          <input id="ex-level-date" type="date" value="${todayISO()}" />
          <button type="button" class="btn" id="ex-level-add">Добавить уровень</button>
        </div>
      </div>`;
  }

  function bindDetail() {
    const box = $('student-detail');
    box.addEventListener('click', (e) => {
      const t = e.target;
      const s = state().students.find((x) => x.id === selectedId);
      if (!s) return;
      if (t.id === 'ex-pkg-save') {
        const total = Math.round(Number($('ex-pkg-total').value));
        const start = $('ex-pkg-start').value;
        if (!(total >= 1 && total <= 60) || !start) {
          alert('Укажите число занятий от 1 до 60 и дату начала пакета');
          return;
        }
        s.package = { total, start };
        save();
        render();
      } else if (t.id === 'ex-level-add') {
        const level = $('ex-level').value;
        const date = $('ex-level-date').value || todayISO();
        s.levels = [...(s.levels || []), { id: newId(), level, date }];
        save();
        render();
      } else if (t.dataset.exDelLevel) {
        s.levels = (s.levels || []).filter((l) => l.id !== t.dataset.exDelLevel);
        save();
        render();
      }
    });
    box.addEventListener('change', (e) => {
      if (e.target.id !== 'ex-place') return;
      const s = state().students.find((x) => x.id === selectedId);
      if (s) {
        s.place = e.target.value;
        save();
      }
    });
  }

  function bindStudents() {
    $('students-list').addEventListener('click', (e) => {
      const id = e.target.dataset.openStudent;
      if (!id) return;
      selectedId = id;
      render();
      $('student-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // В списке учеников показываем остаток занятий рядом с кнопкой «Подробнее».
  function decorateStudents() {
    document.querySelectorAll('[data-open-student]').forEach((btn) => {
      const s = state().students.find((x) => x.id === btn.dataset.openStudent);
      if (!s || !s.package) return;
      btn.insertAdjacentHTML('beforebegin', `<span class="meta">осталось ${lessonsLeft(s)} </span>`);
    });
  }

  // ---------- Заявки: воронка от первого контакта до пакета ----------
  function renderPipeline() {
    const box = $('pipeline-list');
    if (!box) return;
    const leads = state().leads || [];
    if (!leads.length) {
      box.innerHTML = '<div class="empty">Заявок пока нет. Добавьте первую выше.</div>';
      return;
    }
    box.innerHTML = Object.entries(STAGES).map(([key, label]) => {
      const items = leads.filter((l) => l.stage === key);
      if (!items.length) return '';
      return `<h3>${esc(label)} (${items.length})</h3>` + items.map((l) => `
        <div class="card">
          <div>
            <b>${esc(l.name)}</b> <span class="meta">${esc(l.source)}, ${fmt(l.createdAt)}</span>
            ${l.contact || l.note ? `<div class="meta">${esc(l.contact || '')}${l.contact && l.note ? '. ' : ''}${esc(l.note || '')}</div>` : ''}
          </div>
          <div class="pipe-actions">
            <select data-pipe-stage="${l.id}">${Object.entries(STAGES).map(([k, v]) =>
              `<option value="${k}" ${k === l.stage ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
            ${l.stage !== 'package' ? `<button type="button" class="att-btn" data-pipe-student="${l.id}">В ученики</button>` : ''}
            <button type="button" class="att-btn" data-pipe-del="${l.id}">Удалить</button>
          </div>
        </div>`).join('');
    }).join('');
  }

  function bindPipeline() {
    $('pipe-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('pipe-name').value.trim();
      if (!name) return;
      state().leads = state().leads || [];
      state().leads.push({
        id: newId(),
        name,
        contact: $('pipe-contact').value.trim(),
        source: $('pipe-source').value,
        note: $('pipe-note').value.trim(),
        stage: 'new',
        createdAt: todayISO(),
      });
      save();
      e.target.reset();
      render();
    });

    const box = $('pipeline-list');
    box.addEventListener('change', (e) => {
      const id = e.target.dataset.pipeStage;
      if (!id) return;
      const lead = state().leads.find((l) => l.id === id);
      if (lead) {
        lead.stage = e.target.value;
        save();
        render();
      }
    });
    box.addEventListener('click', (e) => {
      const t = e.target;
      if (t.dataset.pipeDel) {
        if (!confirm('Удалить заявку?')) return;
        state().leads = state().leads.filter((l) => l.id !== t.dataset.pipeDel);
        save();
        render();
      } else if (t.dataset.pipeStudent) {
        const lead = state().leads.find((l) => l.id === t.dataset.pipeStudent);
        if (!lead) return;
        const cls = prompt('Группа ученика, например Speaking A2:', '');
        if (!cls || !cls.trim()) return;
        state().students.push({
          id: newId(),
          name: lead.name,
          class: cls.trim(),
          place: '',
          package: { total: PACKAGE_SIZE, start: todayISO() },
          levels: [],
        });
        lead.stage = 'package';
        save();
        render();
      }
    });
  }

  // ---------- Кабинет родителя: остаток и путь по уровням ----------
  function renderParentExtra() {
    const box = $('parent-extra');
    if (!box) return;
    const sel = $('parent-student');
    const s = state().students.find((x) => x.id === (sel && sel.value));
    if (!s) {
      box.innerHTML = '';
      return;
    }
    const left = lessonsLeft(s);
    const levels = sortedLevels(s);
    box.innerHTML = `
      <h3>Занятия</h3>
      ${s.package
        ? `<p class="summary">Осталось ${left} из ${s.package.total}</p>`
        : '<p class="summary">Пакет ещё не оформлен.</p>'}
      <h3>Путь по уровням</h3>
      ${levels.length ? levels.map((l, i) => `
        <div class="card">
          <div><b>${esc(l.level)}</b>
            <span class="meta">${fmt(l.date)}${i ? `, через ${monthsBetween(levels[i - 1].date, l.date)} мес.` : ''}</span>
          </div>
        </div>`).join('') : '<div class="empty">Уровень пока не записан.</div>'}`;
  }

  // Вызывается из app.js после каждого обновления экрана.
  window.onSchoolRender = function () {
    decorateStudents();
    renderDetail();
    renderPipeline();
    renderParentExtra();
  };

  bindStudents();
  bindDetail();
  bindPipeline();
  render();
})();


// Демо-путь ученика. Выбор вида не является авторизацией.
(function () {
  const ADMIN_MODE = new URLSearchParams(window.location.search).get('demo') === 'admin';
  'use strict';
  if (!document.getElementById('demo-entry')) return;
  const $ = (id) => document.getElementById(id);
  const state = () => window.schoolState();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => 'flow-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  let role = null;
  let studentId = null;
  let section = 'lesson';
  const dateParts = (date) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Almaty', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const dateISO = (date) => { const p = dateParts(date); return p.year + '-' + p.month + '-' + p.day; };
  const validUrl = (value) => {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }
    catch (_) { return ''; }
  };
  const formatDate = (iso) => new Date(iso + 'T12:00:00+05:00').toLocaleDateString('ru-RU', {
    timeZone: 'Asia/Almaty', day: 'numeric', month: 'long', year: 'numeric'
  });
  function persist(statusId, successText) {
    const ok = window.schoolSave();
    if (statusId && $(statusId)) $(statusId).textContent = ok ? successText : 'Не удалось сохранить в браузере. Проверьте доступ к хранилищу; после закрытия изменения могут исчезнуть.';
    return ok;
  }
  function fillEntry() {
    const selected = $('demo-student').value;
    $('demo-student').innerHTML = state().students.map((s) =>
      '<option value="' + esc(s.id) + '">' + esc(s.name) + ' · ' + esc(s.class) + '</option>').join('');
    if (state().students.some((s) => s.id === selected)) $('demo-student').value = selected;
    $('demo-student-label').hidden = $('demo-role').value === 'admin';
  }
  function activateTab(name) {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
  }
  function showSection(name) {
    section = name;
    document.querySelectorAll('[data-learning-section]').forEach((b) => {
      b.classList.toggle('active', b.dataset.learningSection === name);
      b.setAttribute('aria-pressed', String(b.dataset.learningSection === name));
    });
    $('next-lesson-view').hidden = role === 'student' && name !== 'lesson';
    $('homework-view').hidden = role === 'student' && name !== 'homework';
    $('learning-progress').hidden = role === 'student' && name !== 'progress';
    $('learning-overview').hidden = role === 'student' && name !== 'progress';
    $('parent-extra').hidden = role === 'student' && name !== 'progress';
    $('parent-view').hidden = role === 'student';
    const titles = { lesson: 'Урок', homework: 'Домашка', progress: 'Прогресс' };
    $('section-title').textContent = role === 'student' ? (titles[name] || '') : 'Вид ученика';
    updateNavDot();
  }
  // Точка на «Домашке»: есть невыполненное задание со сроком в ближайшие 3 дня.
  function updateNavDot() {
    const s = selectedStudent();
    const n = s ? (s.homework || []).filter((h) => !h.answer).length : 0;
    const el = $('nav-dot');
    el.textContent = n ? 'Без ответа: ' + n : '';
    el.hidden = !n;
  }
  function enter(nextRole, id) {
    if (nextRole === 'student' && !state().students.some((s) => s.id === id)) {
      $('demo-entry-status').textContent = 'Выберите ученика или загрузите учебный пример.';
      return;
    }
    role = nextRole; studentId = nextRole === 'student' ? id : null;
    window.schoolDemoStudentId = studentId;
    document.body.dataset.demoRole = role;
    $('demo-login').hidden = true; $('cabinet').hidden = false;
    $('student-nav').hidden = role !== 'student';
    $('demo-current-role').textContent = role === 'student' ? 'Демо' : 'Администратор · демо';
    if (studentId) $('parent-student').value = studentId;
    activateTab(role === 'student' ? 'parent' : 'students');
    showSection('lesson');
    window.schoolRender();
    $('brand-name').focus();
    window.scrollTo(0, 0);
  }
  $('demo-role').addEventListener('change', fillEntry);
  document.querySelectorAll('[data-demo-pick]').forEach((btn) => btn.addEventListener('click', () => {
    $('demo-role').value = btn.dataset.demoPick;
    fillEntry();
    $('demo-entry').requestSubmit();
  }));
  $('demo-entry').addEventListener('submit', (e) => {
    e.preventDefault(); enter($('demo-role').value, $('demo-student').value);
  });
  $('change-demo-role').addEventListener('click', () => {
    role = null; studentId = null; window.schoolDemoStudentId = null;
    document.body.dataset.demoRole = 'none';
    $('cabinet').hidden = true; $('demo-login').hidden = false;
    fillEntry(); $('demo-role').focus();
  });
  $('student-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-learning-section]');
    if (btn) { showSection(btn.dataset.learningSection); window.scrollTo(0, 0); }
  });

  // Демо‑экран входа: логин и пароль вымышленные, ничего не проверяются.
  function showDemoLogin(sampleId) {
    const box = $('demo-creds');
    box.hidden = false;
    box.dataset.sampleId = sampleId;
    box.innerHTML = `
      <p class="meta">Демо‑данные для входа. Вымышленные, не проверяются, защиты нет.</p>
      <label>Логин<input value="alex.demo" readonly /></label>
      <label>Пароль<input type="password" value="demo-pass-2026" readonly /></label>
      <button type="button" class="btn" id="demo-creds-go">Войти</button>`;
  }
  $('demo-creds').addEventListener('click', (e) => {
    if (e.target.id !== 'demo-creds-go') return;
    const id = $('demo-creds').dataset.sampleId;
    $('demo-student').value = id;
    $('demo-role').value = 'student';
    fillEntry();
    $('demo-entry').requestSubmit();
  });
  if (!ADMIN_MODE) {
    document.querySelectorAll('.entry-roles, #demo-entry, #demo-creds, [data-demo-pick], #change-demo-role').forEach((el) => { el.hidden = true; });
  }
  $('load-learning-demo').addEventListener('click', () => {
    let sample = state().students.find((s) => s.learningDemo === true);
    if (!sample) {
      const tomorrow = new Date(Date.now() + 86400000);
      const due = new Date(Date.now() + 3 * 86400000);
      sample = {
        id: uid(), learningDemo: true, name: 'Демо · Алекс', class: 'Speaking A2', place: 'Онлайн',
        package: { total: 12, start: dateISO(new Date()) },
        levels: [{ id: uid(), level: 'Elementary', date: dateISO(new Date()) }],
        teacherComment: 'Демо: уверенно строите простые предложения. Потренируйте вопросы в прошедшем времени.',
        nextGoal: 'Рассказать о своих выходных на английском за одну минуту.',
        nextLesson: { date: dateISO(tomorrow), time: '18:00', title: 'Speaking practice', teacher: 'Демо · преподаватель',
          url: 'https://meet.google.com/', demo: true },
        homework: [{ id: uid(), title: 'Подготовьте пять предложений о своих выходных. Используйте Past Simple.',
          due: dateISO(due), materials: 'https://learnenglish.britishcouncil.org/grammar' }]
      };
      state().students.push(sample);
      if (!state().messages.some((m) => m.class === sample.class)) state().messages.push({ id: uid(), class: sample.class, text: 'Демо: разговорный клуб в субботу, 11:00. Запись у администратора.', date: dateISO(new Date()) });
    }
    fillEntry(); $('demo-student').value = sample.id; $('demo-role').value = 'student'; fillEntry();
    $('demo-entry').requestSubmit();
  });
  function selectedStudent() {
    return state().students.find((s) => s.id === (role === 'student' ? studentId : $('parent-student').value));
  }
  function videoPreview() {
    return '';
  }

  const lessonStart = (lesson) => {
    if (!lesson || !/^\d{4}-\d{2}-\d{2}$/.test(lesson.date || '') || !/^\d{2}:\d{2}$/.test(lesson.time || '')) return NaN;
    return new Date(lesson.date + 'T' + lesson.time + ':00+05:00').getTime();
  };
  const confirmedPrices = () => ((window.SCHOOL_CONFIG || {}).priceList || []).filter((p) =>
    p && p.confirmed === true && typeof p.id === 'string' && p.source &&
    Number.isInteger(p.lessons) && p.lessons > 0 && Number.isFinite(p.totalPriceKzt) && p.totalPriceKzt > 0);
  function packageView(s) {
    if (!s) return '';
    const pkg = s.package;
    if (!pkg || !(pkg.total > 0)) return '<section class="package-focus"><h2>Пакет занятий</h2><p>Пакет пока не оформлен. Уточните программу у администратора.</p></section>';
    const used = Object.entries(state().attendance).filter(([date, day]) =>
      date >= pkg.start && ['present', 'late', 'absent'].includes(day[s.id])).length;
    const left = Math.max(0, pkg.total - used);
    const price = confirmedPrices().find((p) => p.id === pkg.priceId && p.lessons === pkg.total);
    const money = (n) => new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 2 }).format(n) + ' ₸';
    return '<section class="package-focus"><p class="eyebrow">Пакет занятий</p><h2>Осталось ' + left + ' из ' + esc(pkg.total) + '</h2>' +
      '<progress value="' + Math.min(used, pkg.total) + '" max="' + esc(pkg.total) + '" aria-label="Списано занятий в пакете"></progress>' +
      (used > pkg.total ? '<p class="summary">Отметок сверх пакета: ' + (used - pkg.total) + '.</p>' : '') +
      (price ? '<p class="lesson-price">Одно занятие — ' + money(price.totalPriceKzt / price.lessons) +
        '</p><p class="summary">' + esc(price.label || 'Пакет') + ': ' + money(price.totalPriceKzt) + ' за ' + price.lessons +
        ' занятий. Источник прайса: ' + esc(price.source) + '.</p>' :
        '') +
      (left <= 2 ? '<p class="package-reminder">Пакет подходит к концу. Обсудите следующие занятия с администратором.</p>' : '') + '</section>';
  }
  const icsEscape = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/\r\n|\n|\r/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  const foldIcsLine = (line) => {
    const encoder = new TextEncoder();
    let result = '', size = 0;
    for (const char of line) {
      const bytes = encoder.encode(char).length;
      if (size + bytes > 75) { result += '\r\n '; size = 1; }
      result += char; size += bytes;
    }
    return result;
  };
  function calendarContent(s, now) {
    const l = s && s.nextLesson;
    const start = lessonStart(l);
    if (!Number.isFinite(start)) throw new Error('Сначала добавьте дату и время урока.');
    const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const duration = Number(l.durationMinutes);
    const details = ['Время урока: ' + l.date + ' ' + l.time + ' по Астане (UTC+5).',
      'Преподаватель: ' + (l.teacher || 'Уточняется')];
    if (!duration) details.push('Продолжительность не указана.');
    if (l.demo) details.push('Учебный пример. Ссылка ведёт на главную сервиса, не в реальное занятие.');
    const url = validUrl(l.url);
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FASTSPEAK//Lessons//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', 'UID:' + encodeURIComponent(s.id) + '-' + l.date.replace(/-/g, '') + l.time.replace(':', '') + '@fastspeak.local',
      'DTSTAMP:' + stamp(now), 'DTSTART:' + stamp(start)];
    if (Number.isInteger(duration) && duration >= 15 && duration <= 240) lines.push('DTEND:' + stamp(start + duration * 60000));
    lines.push('SUMMARY:' + icsEscape('FASTSPEAK · ' + (l.title || 'Английский язык')),
      'DESCRIPTION:' + icsEscape(details.join('\n')));
    if (url) lines.push('URL:' + url, 'LOCATION:' + icsEscape(url));
    lines.push('BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape('Скоро урок английского'),
      'END:VALARM', 'END:VEVENT', 'END:VCALENDAR');
    return lines.map(foldIcsLine).join('\r\n') + '\r\n';
  }
  $('next-lesson-view').addEventListener('click', (e) => {
    if (!e.target.closest('[data-add-calendar]')) return;
    const s = selectedStudent();
    const status = $('calendar-status');
    try {
      const content = calendarContent(s, Date.now());
      const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'fastspeak-' + s.nextLesson.date + '.ics';
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status.textContent = 'Файл .ics подготовлен. Откройте его в календаре. Если Telegram не предлагает сохранить файл, откройте приложение во внешнем браузере.';
    } catch (error) {
      status.textContent = 'Не удалось подготовить календарь: ' + error.message;
    }
  });

  // Очередь уроков: прошедший ближайший урок уходит в «Прошедшие», следующий из очереди становится ближайшим.
  function advanceLessons(s) {
    s.lessonQueue = Array.isArray(s.lessonQueue) ? s.lessonQueue : [];
    s.lessonsDone = Array.isArray(s.lessonsDone) ? s.lessonsDone : [];
    let moved = false;
    while (s.nextLesson && Number.isFinite(lessonStart(s.nextLesson)) && lessonStart(s.nextLesson) + 60 * 60 * 1000 < Date.now()) {
      s.lessonsDone.push(s.nextLesson);
      s.nextLesson = s.lessonQueue.length ? s.lessonQueue.shift() : null;
      moved = true;
    }
    if (moved) save();
  }
  function markCurrentDone(s) {
    if (!s.nextLesson) return;
    s.lessonQueue = Array.isArray(s.lessonQueue) ? s.lessonQueue : [];
    s.lessonsDone = Array.isArray(s.lessonsDone) ? s.lessonsDone : [];
    s.lessonsDone.push(s.nextLesson);
    s.nextLesson = s.lessonQueue.length ? s.lessonQueue.shift() : null;
    save();
  }
  const LESSON_ICONS = {
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
  };
  function lessonRow(l, label, icon, past) {
    return '<div class="lesson-row' + (past ? ' is-past' : '') + '"><span class="lesson-date">' + esc(formatDate(l.date)) + (l.time ? ' · ' + esc(l.time) : '') +
      '</span><span class="lesson-title">' + esc(l.title || 'Урок') + '</span><span class="lesson-status">' + LESSON_ICONS[icon] + esc(label) + '</span></div>';
  }
  function lessonRowsView(s) {
    const queue = s.lessonQueue || [];
    const done = s.lessonsDone || [];
    if (!queue.length && !done.length) return '';
    return '<section class="lesson-list"><h3>Уроки</h3>' +
      queue.map((l) => lessonRow(l, 'Запланирован', 'calendar', false)).join('') +
      done.slice().reverse().map((l) => lessonRow(l, 'Прошедший', 'clock', true)).join('') + '</section>';
  }
  function classMessagesView(s) {
    const msgs = (state().messages || []).filter((m) => m.class === s.class).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (!msgs.length) return '';
    return '<section class="class-messages"><h3>Сообщения от школы</h3>' + msgs.map((m) =>
      '<div class="card"><span>' + esc(formatDate(m.date)) + ' · ' + esc(m.text) + '</span></div>').join('') + '</section>';
  }
  function lessonQueueBlock(s) {
    const queue = s.lessonQueue || [];
    const done = s.lessonsDone || [];
    return '<section class="lesson-queue"><h3>Очередь уроков</h3>' +
      '<p class="summary">Прошедший урок переходит в «Прошедшие», следующий из очереди становится ближайшим. Урок можно отметить проведённым вручную.</p>' +
      '<p class="summary">Сейчас: ' + (s.nextLesson ? esc(formatDate(s.nextLesson.date)) + ' · ' + esc(s.nextLesson.time) : 'ближайшего урока нет') +
      ' · в очереди: ' + queue.length + ' · проведено: ' + done.length + '</p>' +
      (s.nextLesson ? '<button class="att-btn" type="button" data-mark-lesson-done>Отметить текущий урок проведённым</button>' : '') +
      queue.map((q) => '<div class="card"><span>' + esc(formatDate(q.date)) + ' · ' + esc(q.time) + ' · ' + esc(q.title || 'Урок') + '</span><button class="att-btn" type="button" data-remove-queued="' + esc(q.id) + '">Убрать</button></div>').join('') +
      '<form id="lesson-queue-form" class="flow-form"><h4>Добавить урок в очередь</h4>' +
      '<label>Дата<input name="date" type="date" required></label><label>Время по Астане (UTC+5)<input name="time" type="time" required></label>' +
      '<label>Название урока<input name="title" maxlength="120"></label><label>Преподаватель<input name="teacher" maxlength="120"></label>' +
      '<label>Ссылка на Zoom или Meet (HTTPS)<input name="url" type="url" placeholder="https://meet.google.com/…"></label>' +
      '<button class="btn" type="submit">Добавить в очередь</button></form><p id="lesson-queue-status" role="status" class="summary"></p></section>';
  }

  function lessonView(s) {
    if (!s) return '<div class="empty">Выберите ученика для просмотра урока.</div>';
    const poster = videoPreview('lesson');
    const l = s.nextLesson;
    if (!l || !l.date || !l.time) return '<section class="lesson-focus">' + poster + '<h2>Ближайший урок: ждём расписание</h2><p>Дата и ссылка появятся после заполнения карточки ученика администратором.</p></section>';
    const start = lessonStart(l);
    if (!Number.isFinite(start) || start + 60 * 60 * 1000 < Date.now()) return '<section class="lesson-focus">' + poster + '<h2>Ближайший урок: ожидаем</h2><p>Предыдущее занятие завершилось. Администратор добавит следующую дату.</p></section>';
    const url = validUrl(l.url);
    return '<section class="lesson-focus">' + poster + '<span class="lesson-chip">' + (start <= Date.now() ? 'Идёт сейчас' : 'Ближайший') + '</span><h2>' + esc(l.title || 'Английский язык') + '</h2>' +
      '<p class="lesson-when">' + esc(formatDate(l.date)) + ' · ' + esc(l.time) + '</p><p class="meta">Время по Астане (UTC+5)</p>' +
      '<p>Преподаватель: ' + esc(l.teacher || 'Уточняется') + '</p>' +
      (url ? '<a class="btn join-lesson" data-external-link href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + (l.demo ? 'Открыть Google Meet' : 'Подключиться к уроку') + '</a>' :
        '<button class="btn" type="button" disabled>Ссылка пока не добавлена</button>') +
      '<button type="button" class="att-btn calendar-button" data-add-calendar>Добавить урок в календарь</button><p id="calendar-status" role="status" class="summary"></p>' +
      (l.demo ? '<p class="summary">Демо-ссылка открывает Google Meet без подключения к уроку.</p>' : '') + '</section>';
  }
  function homeworkView(s) {
    if (!s) return '';
    const tasks = s.homework || [];
    return '<section class="homework-section"><h2>Домашнее задание</h2><p class="summary">Ответ сохранится на этом устройстве. Преподаватель его не получит.</p>' +
      (tasks.length ? tasks.map((h, index) => {
        const url = validUrl(h.materials);
        return '<article class="homework-card">' + videoPreview(index % 2 ? 'board' : 'homework') + '<h3>' + esc(h.title) + '</h3><p class="meta">Срок: ' + esc(formatDate(h.due)) +
          (h.due < dateISO(new Date()) && !h.answer ? ' · Срок прошёл' : '') + '</p>' +
          (url ? '<a data-external-link href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Материалы задания</a>' : '') +
          '<form class="homework-answer flow-form" data-homework-id="' + esc(h.id) + '"><label>Ваш ответ<textarea name="answer" required maxlength="8000" rows="4">' + esc(h.answer || '') + '</textarea></label>' +
          '<button class="btn" type="submit">Сохранить ответ</button><p class="summary answer-status" role="status">' +
          (h.savedAt ? 'Ответ сохранён локально. Не отправлен преподавателю.' : '') + '</p></form></article>';
      }).join('') : '<div class="empty">Пока нет заданий. Они появятся после добавления администратором.</div>') + '</section>';
  }
  function estimateView(s) {
    const plan = s.levelEstimate;
    const levels = (window.SCHOOL_CONFIG || {}).levels || [];
    const history = (s.levels || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const currentLevel = history.length ? history[history.length - 1].level : '';
    const valid = plan && levels.includes(plan.targetLevel) &&
      (levels.indexOf(currentLevel) < 0 || levels.indexOf(plan.targetLevel) > levels.indexOf(currentLevel)) &&
      Number.isInteger(plan.remainingLessons) && plan.remainingLessons > 0 &&
      Number.isInteger(plan.sessionsPerWeek) && plan.sessionsPerWeek > 0 &&
      plan.assessedBy && /^\d{4}-\d{2}-\d{2}$/.test(plan.assessedAt || '');
    if (!valid) return '';
    const weeks = Math.ceil(plan.remainingLessons / plan.sessionsPerWeek);
    const months = Math.max(0.5, Math.round(weeks / 4.345 * 2) / 2);
    const period = weeks < 4 ? weeks + ' нед.' : new Intl.NumberFormat('ru-RU').format(months) + ' мес.';
    return '<section class="level-estimate"><p class="eyebrow">ОРИЕНТИР, НЕ ОБЕЩАНИЕ</p><h3>До ' + esc(plan.targetLevel) +
      ' — примерно ' + period + '</h3><p>При ' + plan.sessionsPerWeek + ' занятиях в неделю.</p><p class="summary">Основание: оценка на ' +
      esc(formatDate(plan.assessedAt)) + ' — около ' + plan.remainingLessons + ' занятий до следующего уровня. Преподаватель: ' +
      esc(plan.assessedBy) + '.</p><p class="summary">Срок зависит от регулярности, самостоятельной практики и результатов проверки уровня. Это оценка на указанную дату, а не обратный отсчёт.</p></section>';
  }
  function progressView(s) {
    if (!s) return '';
    return '<section class="progress-focus"><h2>Ваш следующий шаг</h2>' +
      (s.teacherComment ? '<h3>Комментарий преподавателя</h3><p>' + esc(s.teacherComment) + '</p>' : '') +
      (s.nextGoal ? '<h3>Следующая цель</h3><p>' + esc(s.nextGoal) + '</p>' : '') + estimateView(s) + '</section>';
  }
  $('student-detail').addEventListener('submit', (e) => {
    if (e.target.id !== 'lesson-queue-form') return;
    e.preventDefault();
    const s = state().students.find((x) => x.id === adminStudentId);
    if (!s) return;
    const f = new FormData(e.target);
    const date = String(f.get('date') || '');
    const time = String(f.get('time') || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      $('lesson-queue-status').textContent = 'Укажите дату и время урока.';
      return;
    }
    const rawUrl = String(f.get('url') || '').trim();
    const url = rawUrl ? validUrl(rawUrl) : '';
    if (rawUrl && !url) {
      $('lesson-queue-status').textContent = 'Ссылка должна начинаться с https://';
      return;
    }
    s.lessonQueue = Array.isArray(s.lessonQueue) ? s.lessonQueue : [];
    s.lessonQueue.push({ id: uid(), date, time, title: String(f.get('title') || '').trim(), teacher: String(f.get('teacher') || '').trim(), url: url || '' });
    s.lessonQueue.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    if (!s.nextLesson) s.nextLesson = s.lessonQueue.shift();
    save();
    window.schoolRender();
  });
  $('student-detail').addEventListener('click', (e) => {
    const s = state().students.find((x) => x.id === adminStudentId);
    if (!s) return;
    if (e.target.hasAttribute('data-mark-lesson-done')) {
      markCurrentDone(s);
      window.schoolRender();
    } else if (e.target.dataset.removeQueued) {
      s.lessonQueue = (s.lessonQueue || []).filter((q) => q.id !== e.target.dataset.removeQueued);
      save();
      window.schoolRender();
    }
  });

  function adminEditor() {
    const detail = $('student-detail').querySelector('.detail');
    if (!detail) return;
    const s = state().students.find((x) => x.id === adminStudentId);
    if (!s) return;
    const l = s.nextLesson || {};
    const estimate = s.levelEstimate || {};
    const levels = (window.SCHOOL_CONFIG || {}).levels || [];
    const tariffOptions = confirmedPrices().map((p) => '<option value="' + esc(p.id) + '"' +
      (s.package && s.package.priceId === p.id ? ' selected' : '') + '>' + esc(p.label || p.id) + ' · ' + p.lessons + ' занятий</option>').join('');
    detail.insertAdjacentHTML('beforeend', lessonQueueBlock(s) + '<form id="learning-admin-form" class="flow-form"><h3>Ближайший онлайн-урок</h3>' +
      '<label>Дата<input name="date" type="date" value="' + esc(l.date || '') + '"></label><label>Время по Астане (UTC+5)<input name="time" type="time" value="' + esc(l.time || '') + '"></label>' +
      '<label>Продолжительность, минут (если известна)<input name="duration" type="number" min="15" max="240" step="1" value="' + esc(l.durationMinutes || '') + '"></label>' +
      '<label>Название урока<input name="title" maxlength="120" value="' + esc(l.title || '') + '"></label><label>Преподаватель<input name="teacher" maxlength="120" value="' + esc(l.teacher || '') + '"></label>' +
      '<label>Ссылка на Zoom или Meet (HTTPS)<input name="url" type="url" placeholder="https://meet.google.com/…" value="' + esc(l.url || '') + '"></label>' +
      '<label>Комментарий преподавателя<textarea name="comment" maxlength="2000" rows="3">' + esc(s.teacherComment || '') + '</textarea></label>' +
      '<label>Следующая цель<textarea name="goal" maxlength="1000" rows="2">' + esc(s.nextGoal || '') + '</textarea></label>' +
      '<button class="btn" type="submit">Сохранить урок и прогресс</button></form><p id="learning-admin-status" role="status" class="summary"></p>' +
      '<form id="motivation-admin-form" class="flow-form"><h3>Прайс и ориентир уровня</h3>' +
      (tariffOptions ? '<label>Тариф из подтверждённого прайса<select name="priceId"><option value="">Цена не выбрана</option>' + tariffOptions + '</select></label>' :
        '<p class="summary">Подтверждённый прайс школы пока не добавлен. Цены ученику не показываются.</p>') +
      '<p class="summary">Срок заполняется по оценке преподавателя. Оставьте целевой уровень пустым, чтобы скрыть ориентир.</p>' +
      '<label>Следующий уровень<select name="targetLevel"><option value="">Без оценки срока</option>' +
      levels.map((level) => '<option' + (estimate.targetLevel === level ? ' selected' : '') + '>' + esc(level) + '</option>').join('') + '</select></label>' +
      '<label>Занятий до уровня по оценке преподавателя<input name="remainingLessons" type="number" min="1" max="500" step="1" value="' + esc(estimate.remainingLessons || '') + '"></label>' +
      '<label>План занятий в неделю<input name="sessionsPerWeek" type="number" min="1" max="7" step="1" value="' + esc(estimate.sessionsPerWeek || '') + '"></label>' +
      '<label>Кто оценил<input name="assessedBy" maxlength="120" value="' + esc(estimate.assessedBy || '') + '"></label>' +
      '<label>Дата оценки<input name="assessedAt" type="date" value="' + esc(estimate.assessedAt || '') + '"></label>' +
      '<button class="btn" type="submit">Сохранить тариф и ориентир</button></form><p id="motivation-admin-status" role="status" class="summary"></p>' +
      '<form id="homework-admin-form" class="flow-form"><h3>Новое домашнее задание</h3><label>Задание<textarea name="task" required maxlength="2000" rows="3"></textarea></label>' +
      '<label>Срок<input name="due" type="date" required></label><label>Ссылка на материалы (HTTPS)<input name="materials" type="url" placeholder="https://…"></label>' +
      '<button class="btn" type="submit">Добавить задание</button></form><p id="homework-admin-status" role="status" class="summary"></p>' +
      '<div class="admin-homework-list">' + (s.homework || []).map((h) => '<article class="homework-card"><b>' + esc(h.title) + '</b><p class="meta">' + esc(formatDate(h.due)) +
        '</p><p class="answer-copy">' + esc(h.answer || 'Ответа в этом браузере пока нет.') + '</p><button class="att-btn" type="button" data-delete-homework="' + esc(h.id) + '">Удалить задание</button></article>').join('') + '</div>');
  }
  let adminStudentId = null;

  $('students-list').addEventListener('click', (e) => {
    if (e.target.dataset.openStudent) { adminStudentId = e.target.dataset.openStudent; window.schoolRender(); }
  });
  $('student-detail').addEventListener('submit', (e) => {
    if (role !== 'admin') return;
    e.preventDefault();
    const s = state().students.find((x) => x.id === adminStudentId);
    if (!s) return;
    const values = new FormData(e.target);
    if (e.target.id === 'learning-admin-form') {
      const date = values.get('date'), time = values.get('time'), url = values.get('url').trim();
      const durationRaw = values.get('duration');
      const duration = durationRaw ? Number(durationRaw) : null;
      if (durationRaw && (!Number.isInteger(duration) || duration < 15 || duration > 240)) {
        $('learning-admin-status').textContent = 'Продолжительность: целое число от 15 до 240 минут.'; return;
      }
      if (!!date !== !!time || (url && (!date || !validUrl(url)))) {
        $('learning-admin-status').textContent = 'Заполните дату и время вместе. Ссылка должна начинаться с https://.'; return;
      }
      const old = s.nextLesson;
      s.nextLesson = date ? { date, time, durationMinutes: duration, title: values.get('title').trim(), teacher: values.get('teacher').trim(), url,
        demo: !!(old && old.demo && url === old.url) } : null;
      s.teacherComment = values.get('comment').trim(); s.nextGoal = values.get('goal').trim();
      const ok = persist(); window.schoolRender();
      $('learning-admin-status').textContent = ok ? 'Урок и прогресс сохранены в этом браузере.' : 'Не удалось сохранить в браузере.';
    } else if (e.target.id === 'motivation-admin-form') {
      const targetLevel = values.get('targetLevel');
      const remainingLessons = Number(values.get('remainingLessons'));
      const sessionsPerWeek = Number(values.get('sessionsPerWeek'));
      const assessedAt = values.get('assessedAt'), assessedBy = (values.get('assessedBy') || '').trim();
      const history = (s.levels || []).slice().sort((a, b) => a.date.localeCompare(b.date));
      const currentLevel = history.length ? history[history.length - 1].level : '';
      const levels = (window.SCHOOL_CONFIG || {}).levels || [];
      if (targetLevel && (!levels.includes(targetLevel) ||
        (levels.indexOf(currentLevel) >= 0 && levels.indexOf(targetLevel) <= levels.indexOf(currentLevel)) ||
        !Number.isInteger(remainingLessons) || remainingLessons < 1 || remainingLessons > 500 ||
        !Number.isInteger(sessionsPerWeek) || sessionsPerWeek < 1 || sessionsPerWeek > 7 ||
        !assessedBy || !assessedAt || assessedAt > dateISO(new Date()))) {
        $('motivation-admin-status').textContent = 'Выберите уровень выше текущего, число занятий (1–500), план в неделю (1–7), преподавателя и дату оценки не в будущем.'; return;
      }
      const priceId = values.get('priceId');
      const price = confirmedPrices().find((p) => p.id === priceId);
      if (priceId && (!price || !s.package || price.lessons !== s.package.total)) {
        $('motivation-admin-status').textContent = 'Число занятий тарифа должно совпадать с числом занятий в пакете ученика.'; return;
      }
      if (s.package && priceId !== null) s.package.priceId = priceId;
      s.levelEstimate = targetLevel ? { targetLevel, remainingLessons, sessionsPerWeek, assessedAt, assessedBy } : null;
      const ok = persist(); window.schoolRender();
      $('motivation-admin-status').textContent = ok ? 'Тариф и ориентир сохранены в этом браузере.' : 'Не удалось сохранить в браузере.';
    } else if (e.target.id === 'homework-admin-form') {
      const materials = values.get('materials').trim(), title = values.get('task').trim(), due = values.get('due');
      if (!title || !due || (materials && !validUrl(materials))) {
        $('homework-admin-status').textContent = 'Укажите задание, срок и корректную HTTPS-ссылку на материалы.'; return;
      }
      (s.homework ||= []).push({ id: uid(), title, due, materials });
      const ok = persist(); window.schoolRender();
      $('homework-admin-status').textContent = ok ? 'Задание добавлено в этом браузере.' : 'Не удалось сохранить в браузере.';
    }
  });
  $('student-detail').addEventListener('click', (e) => {
    if (role !== 'admin' || !e.target.dataset.deleteHomework) return;
    const s = state().students.find((x) => x.id === adminStudentId);
    if (!s || !confirm('Удалить задание и локальный ответ?')) return;
    s.homework = (s.homework || []).filter((h) => h.id !== e.target.dataset.deleteHomework);
    persist(); window.schoolRender();
  });
  $('homework-view').addEventListener('submit', (e) => {
    const form = e.target.closest('.homework-answer');
    if (!form) return;
    e.preventDefault();
    const s = selectedStudent();
    const h = s && (s.homework || []).find((x) => x.id === form.dataset.homeworkId);
    const answer = new FormData(form).get('answer').trim();
    if (!h || !answer) return;
    h.answer = answer; h.savedAt = new Date().toISOString();
    const ok = persist();
    form.querySelector('.answer-status').textContent = ok ? 'Ответ сохранён локально. Не отправлен преподавателю.' : 'Не удалось сохранить ответ в браузере.';
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-external-link]');
    const tg = window.Telegram && window.Telegram.WebApp;
    if (a && tg && tg.openLink && validUrl(a.href)) { e.preventDefault(); tg.openLink(a.href); }
  });
  const previousRender = window.onSchoolRender;
  window.onSchoolRender = function () {
    if (previousRender) previousRender();
    const s = selectedStudent();
    if (s) advanceLessons(s);
    $('next-lesson-view').innerHTML = lessonView(s) + packageView(s) + lessonRowsView(s) + classMessagesView(s);
    $('homework-view').innerHTML = homeworkView(s);
    $('learning-progress').innerHTML = progressView(s);
    showSection(section);
    if (role === 'admin') adminEditor();
  };
  $('brand-name').setAttribute('tabindex', '-1');
  fillEntry();
  window.schoolRender();
})();

