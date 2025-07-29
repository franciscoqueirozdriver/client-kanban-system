'use client';
import { useEffect, useState } from 'react';

export default function PrintPage() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    try {
      const savedData = localStorage.getItem('printData');
      if (savedData) setRows(JSON.parse(savedData));
    } catch {
      setRows([]);
    }

    // ✅ Fecha a aba e redireciona para /reports depois da impressão
    window.addEventListener('afterprint', () => {
      if (window.opener) {
        window.opener.location.href = '/reports';
      }
      window.close();
    });

    setTimeout(() => window.print(), 500);
  }, []);

  const dateStr = new Date().toLocaleDateString('pt-BR');

  return (
    <div className="print-container">
      <h1>Lista de Prospecção</h1>
      <p className="subtitle">Gerado em {dateStr}</p>

      <table className="report-table">
        <thead>
          <tr>
            <th>Empresa</th>
            <th>Segmento</th>
            <th>Porte</th>
            <th>Contato</th>
            <th>Cargo</th>
            <th>Telefones</th>
            <th>Email</th>
            <th>LinkedIn</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.company}</td>
              <td>{r.segment}</td>
              <td>{r.size}</td>
              <td>{r.nome}</td>
              <td>{r.cargo}</td>
              <td>{[r.telefone, r.celular].filter(Boolean).join(' / ')}</td>
              <td>{r.email}</td>
              <td>{r.linkedin}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 10mm;
        }

        body {
          font-family: Arial, sans-serif;
          font-size: 11px;
          color: #000;
          background: #fff;
        }

        .print-container {
          width: 100%;
          padding: 0;
        }

        h1 {
          text-align: center;
          font-size: 18px;
          margin: 0;
        }

        .subtitle {
          text-align: center;
          font-size: 12px;
          margin: 4px 0 12px 0;
        }

        .report-table {
          width: 100%;
          border-collapse: collapse;
        }

        .report-table th,
        .report-table td {
          border: 1px solid #000;
          padding: 4px 6px;
          text-align: left;
          word-break: break-word;
        }

        .report-table th {
          background: #f0f0f0;
          font-weight: bold;
          font-size: 12px;
        }

        .report-table td {
          font-size: 11px;
        }

        @media print {
          body {
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}

