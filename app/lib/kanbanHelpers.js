// /app/lib/kanbanHelpers.js
export const KANBAN_COLUMNS = [
  'Lead Selecionado',
  'Tentativa de Contato',
  'Contato Efetuado',
  'Conversa Iniciada',
  'Reunião Agendada',
  'Enviado Spotter',
  'Perdido',
];

export function normalizeStatus(raw = '') {
  const x = String(raw).trim().toLowerCase();
  if (!x) return '';
  if (x.includes('spotter')) return 'Enviado Spotter';
  if (x.startsWith('perd')) return 'Perdido';
  if (x.startsWith('tentat')) return 'Tentativa de Contato';
  if (x.startsWith('contato efetuado')) return 'Contato Efetuado';
  if (x.startsWith('conversa iniciada')) return 'Conversa Iniciada';
  if (x.startsWith('reuni')) return 'Reunião Agendada';
  if (x.startsWith('lead selecionado')) return 'Lead Selecionado';
  const maybe = KANBAN_COLUMNS.find(c => c.toLowerCase() === x);
  return maybe || 'Lead Selecionado';
}

export function baseVisibleFilter(item) {
  const v = item?.Status_Kanban;
  return v !== null && v !== undefined && String(v).trim() !== '';
}
