export function downloadJson(data, filename) {
  downloadBlob(JSON.stringify(data, null, 2), filename, 'application/json');
}

export function downloadCsv(rows, filename) {
  if (!rows.length) {
    downloadBlob('', filename, 'text/csv');
    return;
  }

  const columns = Object.keys(rows[0]);
  const lines = [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))
  ];
  downloadBlob(lines.join('\n'), filename, 'text/csv');
}

function csvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const text = Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function downloadBlob(text, filename, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
