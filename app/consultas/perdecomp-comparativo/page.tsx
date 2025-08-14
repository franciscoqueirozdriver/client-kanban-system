'use client';

import { useState, useEffect } from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';
import AutocompleteInput from '@/components/AutocompleteInput';

// --- Type Definitions ---
interface Company {
  'Cliente_ID': string;
  'Nome da Empresa': string;
  'CNPJ Empresa': string;
  [key: string]: any; // Allow other properties
}

interface Competitor extends Company {
  id: number; // Unique ID for list rendering
}

interface PerdcompData {
  // Define structure based on what the API returns and UI needs
  cnpj: string;
  nome: string;
  ultimaConsulta?: string;
  quantidade: number;
  valorPorTipo: Record<string, number>;
  valorTotal: number;
  comprovantes: { html: string; pdf: string }[];
}


// --- Main Page Component ---
export default function PerdcompComparativoPage() {
  // --- State Management ---
  const [client, setClient] = useState<Company | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 5);
    return d.toISOString().split('T')[0];
  });
  const [comparisonData, setComparisonData] = useState<PerdcompData[]>([]);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({}); // Loading state per CNPJ
  const [newApiDataToSave, setNewApiDataToSave] = useState<any[]>([]);


  // --- Effects ---
  // Recalculate start date when end date changes
  useEffect(() => {
    const end = new Date(endDate);
    end.setFullYear(end.getFullYear() - 5);
    setStartDate(end.toISOString().split('T')[0]);
  }, [endDate]);

  // --- Handlers ---
  const handleAddCompetitor = () => {
    if (competitors.length < 3) {
      setCompetitors([...competitors, { id: Date.now(), 'Nome da Empresa': '', 'CNPJ Empresa': '', 'Cliente_ID': '' }]);
    }
  };

  const handleRemoveCompetitor = (id: number) => {
    setCompetitors(competitors.filter(c => c.id !== id));
  };

  const handleUpdateCompetitor = (id: number, company: Company) => {
    setCompetitors(
        competitors.map(c => c.id === id ? { ...c, ...company } : c)
    );
  };

  const handleClearCompetitor = (id: number) => {
    setCompetitors(
        competitors.map(c => c.id === id ? { id: c.id, 'Nome da Empresa': '', 'CNPJ Empresa': '', 'Cliente_ID': '' } : c)
    );
  }

  const processAndSetData = (data: any[], company: Company) => {
    const valorPorTipo = data.reduce((acc, item) => {
        const tipo = item.Tipo_Pedido || 'Desconhecido';
        const valor = parseFloat(item.Valor_Total) || 0;
        acc[tipo] = (acc[tipo] || 0) + valor;
        return acc;
    }, {} as Record<string, number>);

    const valorTotal = Object.values(valorPorTipo).reduce((sum, v) => sum + v, 0);

    const newCard: PerdcompData = {
        cnpj: company['CNPJ Empresa'],
        nome: company['Nome da Empresa'],
        ultimaConsulta: data[0]?.Data_Consulta,
        quantidade: data.length,
        valorPorTipo,
        valorTotal,
        comprovantes: data.map(item => ({
            html: item.URL_Comprovante_HTML || '',
            pdf: item.URL_Comprovante_PDF || ''
        })).filter(c => c.html || c.pdf),
    };

    setComparisonData(prev => {
        const others = prev.filter(p => p.cnpj !== company['CNPJ Empresa']);
        return [...others, newCard];
    });
  };

  const fetchDataForCnpj = async (company: Company, force = false) => {
    const cnpj = company['CNPJ Empresa'];
    if (!cnpj || cnpj.replace(/\D/g, '').length !== 14) return;

    setIsLoading(prev => ({ ...prev, [cnpj]: true }));

    try {
        const response = await fetch('/api/infosimples/perdcomp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cnpj,
                periodoInicio: startDate,
                periodoFim: endDate,
                force,
            }),
        });
        const result = await response.json();

        if (!result.ok) throw new Error(result.message);

        if (result.fonte === 'planilha') {
            processAndSetData(result.linhas, company);
        } else if (result.fonte === 'api') {
            const dataToSave = result.itens.map((item: any) => {
                const perdcompId = `PDC-${new Date().toISOString().replace(/\D/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                return [
                    company['Cliente_ID'] || '',
                    company['Nome da Empresa'] || '',
                    perdcompId,
                    cnpj.replace(/\D/g, ''),
                    item.tipo_de_pedido || '',
                    item.situacao_do_pedido || '',
                    item.periodo_apuracao_inicio || '',
                    item.periodo_apuracao_fim || '',
                    parseFloat(item.valor_total_do_credito) || 0,
                    item.numero_processo || '',
                    item.data_protocolo || '',
                    item.data_ultima_atualizacao || '',
                    item.receitas?.length || 0,
                    item.origens_credito?.length || 0,
                    item.darfs?.length || 0,
                    item.site_receipts?.html || '',
                    item.site_receipts?.pdf || '',
                    new Date().toISOString(),
                ];
            });
            setNewApiDataToSave(prev => [...prev, ...dataToSave]);

            // Also display the data immediately
            const mappedDataForUI = dataToSave.map(row => ({
                'Cliente_ID': row[0], 'Nome da Empresa': row[1], 'Perdcomp_ID': row[2], 'CNPJ': row[3],
                'Tipo_Pedido': row[4], 'Situacao': row[5], 'Periodo_Inicio': row[6], 'Periodo_Fim': row[7],
                'Valor_Total': row[8], 'Numero_Processo': row[9], 'Data_Protocolo': row[10], 'Ultima_Atualizacao': row[11],
                'Quantidade_Receitas': row[12], 'Quantidade_Origens': row[13], 'Quantidade_DARFs': row[14],
                'URL_Comprovante_HTML': row[15], 'URL_Comprovante_PDF': row[16], 'Data_Consulta': row[17]
            }));
            processAndSetData(mappedDataForUI, company);
        }
    } catch (error) {
        console.error(`Failed to fetch data for ${cnpj}:`, error);
        // You might want to display an error message on the card
    } finally {
        setIsLoading(prev => ({ ...prev, [cnpj]: false }));
    }
  };

  const handleSearch = async () => {
      setComparisonData([]);
      setNewApiDataToSave([]);
      const allCompanies = [client, ...competitors].filter((c): c is Company => c !== null && !!c['CNPJ Empresa']);
      for (const company of allCompanies) {
          fetchDataForCnpj(company, false);
      }
  };

  const handleForceConsult = (cnpj: string) => {
      const company = [client, ...competitors].find(c => c?.['CNPJ Empresa'] === cnpj);
      if (company) {
          fetchDataForCnpj(company, true);
      }
  }

  const handleSave = async () => {
    if (newApiDataToSave.length === 0) return;
    // Potentially add a confirmation dialog here
    try {
        const response = await fetch('/api/perdecomp/salvar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ linhas: newApiDataToSave }),
        });
        const result = await response.json();
        if (result.ok) {
            // alert(`Sucesso! ${result.inseridos} novos registros foram salvos.`);
            setNewApiDataToSave([]); // Clear the save queue
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error("Failed to save new data:", error);
        // alert(`Erro ao salvar: ${error.message}`);
    }
  }

  // --- Render ---
  return (
    <div className="container mx-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-violet-700 dark:text-violet-500">PER/DCOMP Comparativo</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Compare os pedidos de restituição, ressarcimento e compensação de até 4 empresas.</p>
      </header>

      {/* == Form Section == */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Client Input */}
          <div>
            <label className="font-semibold block mb-2">Cliente Principal</label>
            <AutocompleteInput
                placeholder="Digite o Nome ou CNPJ do Cliente"
                onSelect={setClient}
                onClear={() => setClient(null)}
            />
          </div>

          {/* Date Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                  <label htmlFor="endDate" className="font-semibold block mb-2">Período Fim</label>
                  <input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border rounded bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
              </div>
              <div>
                  <label htmlFor="startDate" className="font-semibold block mb-2">Período Início (5 anos)</label>
                  <input type="date" id="startDate" value={startDate} readOnly className="w-full p-2 border rounded bg-gray-200 dark:bg-gray-600 border-gray-300 dark:border-gray-500 cursor-not-allowed" />
              </div>
          </div>
        </div>

        {/* Competitors Section */}
        <div className="mt-6">
            <h3 className="font-semibold text-lg mb-2">Concorrentes (até 3)</h3>
            <div className="space-y-4">
                {competitors.map((comp, index) => (
                    <div key={comp.id} className="flex items-center gap-4">
                        <AutocompleteInput
                            placeholder={`Nome ou CNPJ do Concorrente ${index + 1}`}
                            onSelect={(company) => handleUpdateCompetitor(comp.id, company)}
                            onClear={() => handleClearCompetitor(comp.id)}
                        />
                        <button onClick={() => handleRemoveCompetitor(comp.id)} className="p-2 text-red-500 hover:text-red-700 dark:hover:text-red-400">
                            <FaTrash />
                        </button>
                    </div>
                ))}
            </div>
            {competitors.length < 3 && (
                <button onClick={handleAddCompetitor} className="mt-4 flex items-center gap-2 text-violet-600 dark:text-violet-400 hover:underline">
                    <FaPlus /> Adicionar Concorrente
                </button>
            )}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-end gap-4">
            {newApiDataToSave.length > 0 && (
                <button onClick={handleSave} className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700">
                    Salvar {newApiDataToSave.length} Novos Registros na Planilha
                </button>
            )}
            <button onClick={handleSearch} disabled={Object.values(isLoading).some(v => v)} className="bg-violet-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-violet-700 disabled:bg-gray-400 disabled:cursor-wait">
                {Object.values(isLoading).some(v => v) ? 'Consultando...' : 'Consultar / Atualizar'}
            </button>
        </div>
      </div>

      {/* == Comparison Grid Section == */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {comparisonData.map((card) => (
            <div key={card.cnpj} className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-md relative">
                {isLoading[card.cnpj] && <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white"></div></div>}
                <div className="flex justify-between items-start">
                    <h4 className="font-bold text-lg w-4/5">{card.nome || '---'}</h4>
                    {/* Placeholder for a menu or action button */}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 font-mono">{card.cnpj}</p>

                {card.ultimaConsulta && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        Última consulta: {new Date(card.ultimaConsulta).toLocaleDateString()}
                        <button onClick={() => handleForceConsult(card.cnpj)} className="ml-2 text-violet-500 hover:underline">
                            (Fazer nova consulta)
                        </button>
                    </div>
                )}

                <div className="space-y-2 text-sm">
                    <p><strong>Quantidade:</strong> <span className="font-mono float-right">{card.quantidade}</span></p>
                    <p><strong>Valor Total:</strong> <span className="font-mono float-right text-green-500">{card.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>

                    <div className="pt-2">
                        <p className="font-semibold">Valores por Tipo:</p>
                        <table className="w-full text-left text-xs mt-1">
                            <tbody>
                            {Object.entries(card.valorPorTipo).map(([tipo, valor]) =>(
                                <tr key={tipo} className="border-b border-gray-200 dark:border-gray-700">
                                    <td className="py-1">{tipo}</td>
                                    <td className="py-1 text-right font-mono">{valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>

                    {card.comprovantes.length > 0 && (
                        <div className="pt-2">
                            <p className="font-semibold">Comprovantes:</p>
                            <ul className="list-disc list-inside mt-1 space-y-1">
                                {card.comprovantes.map((comp, i) => (
                                    <li key={i}>
                                        {comp.html && <a href={comp.html} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">HTML</a>}
                                        {comp.html && comp.pdf && ' / '}
                                        {comp.pdf && <a href={comp.pdf} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">PDF</a>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
          ))}
      </div>
    </div>
  );
}
