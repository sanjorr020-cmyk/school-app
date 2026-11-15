// Настройка приложения под конкретную школу.
// Меняйте только этот файл: название, цвета, классы и демо‑данные.
// Вариант Б: оформление FastSpeak. Логотип и материалы уточняются по оригиналам.
// Демо‑ученики вымышленные.
window.SCHOOL_CONFIG = {
  name: 'FASTSPEAK',
  subtitle: 'Школа разговорного английского',
  accent: '#ff5135',
  // Занятий в пакете (абонементе) по умолчанию и варианты уровней и мест занятий.
  packageSize: 12,
  levels: ['Beginner', 'Elementary', 'Pre-Intermediate', 'Intermediate', 'Upper-Intermediate', 'Advanced'],
  places: ['Филиал 1', 'Филиал 2', 'Онлайн'],
  // Адрес сервера бота (HTTPS), например https://bot.example.com. Пусто — уведомления и заявки выключены.
  apiUrl: '',
  classes: ['5А', '5Б', '6А', '6Б', '7А', '7Б', '8А', '8Б', '9А', '9Б', '10А', '11А'],
  // Демо‑данные добавляются, только если журнал пустой. Уберите блок demo для чистого старта.
  demo: {
    students: [
      { name: 'Иванов Иван', class: '7А', place: 'Филиал 1', levels: [{ level: 'Elementary', date: '2026-06-01' }, { level: 'Intermediate', date: '2026-10-15' }] },
      { name: 'Петрова Анна', class: '7А', place: 'Онлайн', levels: [{ level: 'Pre-Intermediate', date: '2026-09-01' }] },
      { name: 'Сейтжанов Арман', class: '7Б', place: 'Филиал 2', levels: [] },
    ],
    // weekday: 1 — понедельник … 5 — пятница
    schedule: [
      { class: '7А', weekday: 1, time: '08:30', subject: 'Математика', teacher: 'Ахметова Д.К.', room: '101' },
      { class: '7А', weekday: 1, time: '09:30', subject: 'Казахский язык', teacher: 'Нурланова А.Б.', room: '204' },
      { class: '7А', weekday: 1, time: '10:30', subject: 'Физика', teacher: 'Касымов Т.С.', room: '312' },
      { class: '7А', weekday: 2, time: '08:30', subject: 'История', teacher: 'Жуманов Е.А.', room: '118' },
      { class: '7А', weekday: 2, time: '09:30', subject: 'Английский язык', teacher: 'Смит Л.', room: '207' },
      { class: '7Б', weekday: 1, time: '08:30', subject: 'Математика', teacher: 'Ахметова Д.К.', room: '101' },
      { class: '7Б', weekday: 1, time: '09:30', subject: 'Химия', teacher: 'Бекова З.М.', room: '305' },
    ],
    grades: [
      { name: 'Иванов Иван', subject: 'Математика', value: 5 },
      { name: 'Иванов Иван', subject: 'Физика', value: 4 },
      { name: 'Петрова Анна', subject: 'Математика', value: 4 },
    ],
    messages: [
      { class: '7А', text: 'Завтра родительское собрание в 18:00, кабинет 101.' },
    ],
    leads: [
      { name: 'Пример заявителя', contact: '', source: 'Сайт', stage: 'new', note: 'Пробное занятие на следующей неделе' },
    ],
  },
};
