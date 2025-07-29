'use client';
import { useState } from 'react';

export default function PdfModal({ open, onClose, data = [], onGenerate }) {
  if (!open) return null;

  const [customValue, setCustomValue] = useState('');
  const [onlyNew, setOnlyNew] = useState(true); // ✅ Checkbox começa marcado
  const options = [10, 30, 50, 100];

  const handleCustomGenerate = () => {
    const value = parseInt(customValue, 10);
    if (!isNaN(value) && value > 0) {
      onGenerate(value, onlyNew);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded shadow-lg p-6 w-96">
        <h2 className="text-lg font-bold mb-4">Gerar PDF</h2>
        <p className="mb-2">Escolha o número máximo de leads por impressão:</p>
        <div className="flex flex-col gap-2">
          {options.map((max) => (
            <button
              key={max}
              onClick={() => {
                onGenerate(max, onlyNew);
                onClose();
              }}
              className="px-3 py-1 bg-blue-600 text-white rounded"
            >
              {max} Leads
            </button>
          ))}
          <div className="flex gap-2 mt-2">
            <input
              type="number"
              placeholder="Outro valor"
              className="border p-1 rounded flex-1"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCustomGenerate();
              }}
            />
            <button
              onClick={handleCustomGenerate}
              className="px-3 py-1 bg-green-600 text-white rounded"
            >
              OK
            </button>
          </div>

          {/* ✅ Checkbox para leads inéditos */}
          <label className="flex items-center gap-2 mt-3">
            <input
              type="checkbox"
              checked={onlyNew}
              onChange={(e) => setOnlyNew(e.target.checked)}
            />
            <span className="text-sm">Somente Leads Inéditos</span>
          </label>
        </div>
        <button
          onClick={onClose}
          className="mt-4 px-3 py-1 bg-gray-400 text-white rounded"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

