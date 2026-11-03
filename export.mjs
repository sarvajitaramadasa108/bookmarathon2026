import { DatabaseSync } from 'node:sqlite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Operator-only command. There is deliberately no public API for listing registrations.
const db = new DatabaseSync(process.env.DB_PATH || resolve(dirname(fileURLToPath(import.meta.url)), 'data/registrations.sqlite'), { readOnly: true });
const columns = ['reference', 'created_at', 'name', 'mobile', 'age', 'gender', 'area', 'category', 'devotee', 'participation', 'language', 'consent'];
const cell = value => {
  let text = String(value ?? '');
  if (/^\s*[=+@-]/.test(text)) text = `'${text}`; // prevent spreadsheet formula execution
  return `"${text.replaceAll('"', '""')}"`;
};
process.stdout.write('\uFEFF' + columns.join(',') + '\r\n');
for (const row of db.prepare('SELECT * FROM registrations ORDER BY created_at').iterate()) process.stdout.write(columns.map(key => cell(row[key])).join(',') + '\r\n');
db.close();
