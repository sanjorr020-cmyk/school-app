// Пакеты занятий, история уровня и воронка заявок. Работает поверх app.js:
// использует window.schoolState / schoolSave / schoolRender и хук window.onSchoolRender.

(function () {
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
        const cls = prompt('Класс ученика, например 7А:', '');
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
