const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

function normalizeString(str) {
  if (!str) return '';
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/__+/g, '_')
    .replace(/^_|_$/g, '');
}

const filePath = '/mnt/data/Deals.ods';
const workbook = xlsx.readFile(filePath);

const newMapping = {
  tabs: {},
  columns: {},
};

workbook.SheetNames.forEach(sheetName => {
  const normalizedSheetName = normalizeString(sheetName);
  newMapping.tabs[sheetName] = normalizedSheetName;

  const worksheet = workbook.Sheets[sheetName];
  const headers = xlsx.utils.sheet_to_json(worksheet, { header: 1 })[0];

  newMapping.columns[normalizedSheetName] = {};
  headers.forEach(header => {
    const normalizedHeader = normalizeString(header);
    if(header) {
      newMapping.columns[normalizedSheetName][header] = normalizedHeader;
    }
  });
});

const outputPath = path.join(__dirname, '..', 'config', 'generated_mapping.json');
fs.writeFileSync(outputPath, JSON.stringify(newMapping, null, 2));

console.log('Mapping generated successfully at', outputPath);
