const columns = [
  ['created_at', 'Registered'], ['name', 'Name'], ['whatsapp_mobile', 'WhatsApp'], ['age', 'Age'],
  ['gender', 'Gender'], ['area', 'Area'], ['category', 'Category'], ['devotee', 'Devotee'],
  ['availability', 'Availability'], ['language', 'Language'],
];
const labels = Object.fromEntries(columns);
let key = sessionStorage.getItem('bm_admin_key') || '';
let rows = [];
let visible = [];

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const pretty = (column, value) => {
  if (column === 'created_at' && value) return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  if (column === 'gender') return value === 'male' ? 'Male' : value === 'female' ? 'Female' : value;
  if (column === 'category') return value === 'FOLK' ? 'FOLK' : value === 'CONGREGATION' ? 'Congregation' : value;
  if (column === 'availability') return ({ full_day: 'Every day · Full day', evenings: 'Every day · Evenings', weekends: 'Saturdays and Sundays' })[value] || value;
  if (column === 'language') return value === 'te' ? 'Telugu' : 'English';
  return value ?? '';
};

function renderFilters() {
  $('#filters').innerHTML = columns.map(([column, label]) => `<div class="filter"><label for="filter-${column}">${label}<input id="filter-${column}" data-filter="${column}" placeholder="Filter ${label.toLowerCase()}" autocomplete="off"></label></div>`).join('');
  $('#filters').addEventListener('input', renderTable);
}

function renderHead() { $('#table-head').innerHTML = `<tr>${columns.map(([, label]) => `<th>${label}</th>`).join('')}</tr>`; }

function renderTable() {
  const filters = Object.fromEntries([...document.querySelectorAll('[data-filter]')].map((input) => [input.dataset.filter, input.value.trim().toLowerCase()]));
  visible = rows.filter((row) => columns.every(([column]) => !filters[column] || String(pretty(column, row[column])).toLowerCase().includes(filters[column])));
  $('#count').textContent = visible.length;
  $('#table-body').innerHTML = visible.map((row) => `<tr>${columns.map(([column]) => `<td>${escapeHtml(pretty(column, row[column]))}</td>`).join('')}</tr>`).join('');
  $('#empty').hidden = visible.length > 0;
}

function exportExcel() {
  if (!visible.length) return;
  const header = columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join('');
  const body = visible.map((row) => `<tr>${columns.map(([column]) => `<td>${escapeHtml(pretty(column, row[column]))}</td>`).join('')}</tr>`).join('');
  const html = `<html><head><meta charset="UTF-8"></head><body><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `book-marathon-responses-${new Date().toISOString().slice(0, 10)}.xls`; link.click(); URL.revokeObjectURL(url);
}

async function load() {
  $('#status').textContent = 'Loading…'; $('#reload').disabled = true;
  try {
    const response = await fetch('/api/responses', { headers: { 'x-admin-key': key }, cache: 'no-store' });
    if (response.status === 401) throw new Error('The admin key is not valid.');
    if (!response.ok) throw new Error('Could not load responses. Check your Vercel environment variables.');
    rows = (await response.json()).rows || []; renderTable();
    $('#status').textContent = `Last refreshed ${new Date().toLocaleString('en-IN')}`;
  } catch (error) { $('#status').textContent = error.message; }
  finally { $('#reload').disabled = false; }
}

function openDashboard() { $('#access-card').hidden = true; $('#dashboard').hidden = false; renderFilters(); renderHead(); load(); }
$('#access-form').addEventListener('submit', (event) => { event.preventDefault(); key = $('#admin-key').value.trim(); sessionStorage.setItem('bm_admin_key', key); openDashboard(); });
$('#reload').addEventListener('click', load); $('#export').addEventListener('click', exportExcel);
if (key) { $('#admin-key').value = key; openDashboard(); }
