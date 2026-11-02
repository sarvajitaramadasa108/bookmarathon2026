import { copy, devotees, statistics } from './content.js';
import { validateRegistration } from './validation.js';

let language = 'en';
try { if (localStorage.getItem('marathon-language') === 'te') language = 'te'; } catch {}
let year = 2025;
let errors = {};
let messageKey = '';
let sending = false;
let requestId = crypto.randomUUID();
const form = document.querySelector('#registration-form');
const message = document.querySelector('#form-message');
const t = key => copy[language][key];
const number = value => new Intl.NumberFormat(language === 'te' ? 'te-IN' : 'en-IN').format(value);

function renderStatistics() {
  const cards = document.querySelector('#stat-cards');
  const table = document.querySelector('#stat-table');
  cards.replaceChildren(); table.replaceChildren();
  statistics.forEach(category => {
    const estimated = category.estimated?.includes(year);
    const card = document.createElement('article'); card.className = 'stat-card';
    const count = document.createElement('span'); count.className = 'stat-number';
    count.textContent = number(category.values[year - 2023]) + (estimated ? '*' : '');
    const label = document.createElement('span'); label.className = 'stat-label'; label.textContent = t(category.key);
    const meta = document.createElement('span'); meta.className = 'stat-meta';
    meta.textContent = `${category.pages} ${t('pages')}${estimated ? ` · ${t('estimated')}` : ''}`;
    const bar = document.createElement('div'); bar.className = 'stat-bar'; bar.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('span');
    fill.style.width = `${category.values[year - 2023] / Math.max(...category.values) * 100}%`;
    bar.append(fill); card.append(count, label, meta, bar); cards.append(card);
    const row = document.createElement('tr');
    const heading = document.createElement('th'); heading.scope = 'row'; heading.textContent = t(category.key); row.append(heading);
    category.values.forEach((value, i) => {
      const cell = document.createElement('td'); cell.textContent = number(value);
      if (category.estimated?.includes(2023 + i)) {
        const badge = document.createElement('span'); badge.className = 'estimate-badge'; badge.textContent = `* ${t('estimated')}`; cell.append(badge);
      }
      row.append(cell);
    });
    table.append(row);
  });
}

function renderErrors() {
  for (const key of ['name', 'mobile', 'age', 'gender', 'area', 'devotee', 'participation', 'consent']) {
    document.getElementById(`${key}-error`).textContent = errors[key] ? t(errors[key]) : '';
    const fields = key === 'participation' ? form.querySelectorAll('[name="participation"]') : [document.getElementById(key)];
    fields.forEach(field => field.setAttribute('aria-invalid', String(Boolean(errors[key]))));
  }
}

function renderLanguage() {
  document.documentElement.lang = language;
  document.title = language === 'te' ? 'పుస్తక మారథాన్ 2026 | హరే కృష్ణ వైకుంఠం' : 'Book Marathon 2026 | Hare Krishna Vaikuntham';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-placeholder]').forEach(el => { el.placeholder = t(el.dataset.placeholder); });
  document.querySelectorAll('[data-alt]').forEach(el => { el.alt = t(el.dataset.alt); });
  document.querySelectorAll('[data-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.aria)); });
  document.querySelectorAll('[data-lang]').forEach(el => { el.setAttribute('aria-pressed', String(el.dataset.lang === language)); });
  const select = document.querySelector('#devotee');
  const selected = select.value;
  while (select.options.length > 1) select.remove(1);
  devotees.forEach(([en, te]) => { select.add(new Option(language === 'te' ? te : en, en)); });
  select.value = selected;
  renderStatistics(); renderErrors();
  message.textContent = messageKey ? t(messageKey) : '';
  if (sending) form.querySelector('[type="submit"] [data-i18n]').textContent = t('sending');
}

document.querySelectorAll('[data-lang]').forEach(button => button.addEventListener('click', () => {
  language = button.dataset.lang;
  try { localStorage.setItem('marathon-language', language); } catch {}
  renderLanguage();
}));
document.querySelectorAll('[data-year]').forEach(button => button.addEventListener('click', () => {
  year = Number(button.dataset.year);
  document.querySelectorAll('[data-year]').forEach(el => el.setAttribute('aria-pressed', String(Number(el.dataset.year) === year)));
  renderStatistics();
}));
form.addEventListener('input', event => {
  requestId = crypto.randomUUID();
  const key = event.target.name;
  if (errors[key]) { delete errors[key]; renderErrors(); }
  messageKey = ''; message.hidden = true;
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (sending) return;
  const values = Object.fromEntries(new FormData(form));
  values.consent = document.querySelector('#consent').checked; values.language = language;
  const validation = validateRegistration(values);
  errors = validation.errors; renderErrors();
  if (!validation.valid) {
    const first = Object.keys(errors)[0];
    (first === 'participation' ? form.querySelector('[name="participation"]') : document.getElementById(first)).focus();
    return;
  }
  sending = true; message.hidden = true; messageKey = '';
  const controls = [...form.querySelectorAll('input,select,button')];
  controls.forEach(el => { el.disabled = true; });
  form.setAttribute('aria-busy', 'true');
  form.querySelector('[type="submit"] [data-i18n]').textContent = t('sending');
  try {
    const response = await fetch('/api/registrations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validation.data, requestId }), signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok) {
      if (result.errors) { errors = result.errors; renderErrors(); }
      throw new Error(response.status === 429 ? 'rate' : response.status >= 500 ? 'unavailable' : 'error');
    }
    if (typeof result.reference !== 'string') throw new Error('error');
    document.querySelector('#registration-reference').textContent = result.reference;
    form.hidden = true;
    const success = document.querySelector('#success-panel'); success.hidden = false; success.focus();
    form.reset(); requestId = crypto.randomUUID();
  } catch (error) {
    messageKey = ['rate', 'unavailable'].includes(error.message) ? error.message : 'error';
    message.textContent = t(messageKey); message.hidden = false; message.focus();
  } finally {
    sending = false; controls.forEach(el => { el.disabled = false; });
    form.removeAttribute('aria-busy');
    form.querySelector('[type="submit"] [data-i18n]').textContent = t('submit');
  }
});
document.querySelector('#register-another').addEventListener('click', () => {
  document.querySelector('#success-panel').hidden = true; form.hidden = false;
  errors = {}; renderErrors(); document.querySelector('#name').focus();
});
renderLanguage();
