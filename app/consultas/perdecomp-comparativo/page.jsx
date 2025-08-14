'use client';

import { useState, useEffect } from 'react';
import Autocomplete from '../../../../components/Perdecomp/Autocomplete';
import { FaSync, FaFilePdf, FaFileCode } from 'react-icons/fa';

// --- Sub-components ---

const CompanyForm = ({ companyData, onUpdate, onEnrich, isEnriching }) => {
    const [formData, setFormData] = useState(companyData);

    useEffect(() => {
        // This allows the form to be updated from the outside (e.g., after enrichment)
        setFormData(companyData);
    }, [companyData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const newFormData = { ...formData, [name]: value };
        setFormData(newFormData);
        onUpdate(newFormData); // Inform parent of the change
    };

    const fields = [
        { name: 'Nome_da_Empresa', label: 'Nome da Empresa' },
        { name: 'CNPJ_Empresa', label: 'CNPJ Empresa' },
        { name: 'Site_Empresa', label: 'Site' },
        { name: 'Telefones_Empresa', label: 'Telefones' },
        { name: 'CEP_Empresa', label: 'CEP' },
        { name: 'Logradouro_Empresa', label: 'Logradouro' },
        { name: 'Numero_Empresa', label: 'Número' },
        { name: 'Bairro_Empresa', label: 'Bairro' },
        { name: 'Cidade_Empresa', label: 'Cidade' },
        { name: 'Estado_Empresa', label: 'Estado' },
        { name: 'Pais_Empresa', label: 'País' },
        { name: 'Observacao_Empresa', label: 'Observação' },
    ];

    return (
        <div className="mt-2 p-4 border border-dashed border-gray-600 rounded-lg bg-gray-800/50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {fields.map(field => (
                    <div key={field.name}>
                        <label className="block text-sm font-medium text-gray-400">{field.label}</label>
                        <input
                            type="text"
                            name={field.name}
                            value={formData[field.name] || ''}
                            onChange={handleChange}
                            className="w-full mt-1 p-2 border rounded bg-gray-700 text-white"
                        />
                    </div>
                ))}
            </div>
            <div className="mt-4">
                <button
                    onClick={onEnrich}
                    disabled={isEnriching}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500 transition-colors"
                >
                    {isEnriching ? 'Enriquecendo...' : 'Enriquecer Dados do Cadastro'}
                </button>
            </div>
        </div>
    );
};

const CompanyInput = ({ value, onChange }) => {
    const [isEnriching, setIsEnriching] = useState(false);

    const handleFormUpdate = (updatedData) => {
        onChange(updatedData);
    };

    const handleEnrich = async () => {
        if (!value) return;
        setIsEnriching(true);
        try {
            // The prompt implies a POST request to an existing perplexity/enrichment route.
            // Based on the file list, `/pages/api/companies.js` seems plausible.
            const response = await fetch('/api/companies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // The body format is a guess based on `lib/perplexity.js`
                body: JSON.stringify({ client: value }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'A resposta da API não foi OK.');
            }

            const enrichedData = await response.json();
            // The API might return the full enriched object or just the new fields.
            // Merging them ensures we keep any manually entered data.
            onChange({ ...value, ...enrichedData });

        } catch (error) {
            console.error("Enrichment failed:", error);
            // Optionally, show a toast or alert to the user
        } finally {
            setIsEnriching(false);
        }
    };

    return (
        <div>
            <Autocomplete
                onSelect={onChange}
                selectedValue={value}
                onClear={() => onChange(null)}
            />
            {value?.isNew && (
                <CompanyForm
                    companyData={value}
                    onUpdate={handleFormUpdate}
                    onEnrich={handleEnrich}
                    isEnriching={isEnriching}
                />
            )}
        </div>
    );
};

const ComparisonResults = ({ data, onForceRefresh }) => {
    if (!data || data.length === 0) return null;

    const StatCard = ({ label, value }) => (
        <div className="bg-gray-700/50 p-3 rounded">
            <p className="text-sm text-gray-400">{label}</p>
            <p className="text-lg font-bold">{value}</p>
        </div>
    );

    return (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {data.map((item, index) => (
                <div key={item.cnpj || index} className="bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col">
                    <div className="flex-grow">
                        <h3 className="font-bold text-xl truncate">{item.nome || '---'}</h3>
                        <p className="text-sm text-gray-400 mb-2">{item.cnpj}</p>
                        {item.ultimaConsulta && <p className="text-xs text-green-400 mb-2">Última consulta: {new Date(item.ultimaConsulta).toLocaleDateString()}</p>}

                        <div className="space-y-2 mb-4">
                            <StatCard label="Qtd. PER/DCOMPs" value={item.quantidade} />
                            <StatCard label="Valor Total" value={item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                        </div>

                        <h4 className="font-semibold mb-1">Valor por Tipo:</h4>
                        <div className="text-sm space-y-1 mb-4">
                            {Object.entries(item.valorPorTipo).map(([tipo, valor]) => (
                                <div key={tipo} className="flex justify-between">
                                    <span>{tipo}</span>
                                    <span className="font-mono">{valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                            ))}
                        </div>

                        <h4 className="font-semibold mb-1">Comprovantes:</h4>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                            {item.comprovantes.map((c, i) => (
                                <div key={i} className="flex items-center justify-between text-xs bg-gray-700/50 p-1 rounded">
                                    <span>{c.id}</span>
                                    <div className="flex gap-2">
                                        {c.html && <a href={c.html} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300"><FaFileCode /></a>}
                                        {c.pdf && <a href={c.pdf} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300"><FaFilePdf /></a>}
                                    </div>
                                </div>
                            ))}
                            {item.comprovantes.length === 0 && <p className="text-xs text-gray-500">Nenhum comprovante no período.</p>}
                        </div>
                    </div>
                    <div className="mt-4">
                         <button onClick={() => onForceRefresh(item.cnpj)} className="w-full flex items-center justify-center gap-2 text-sm bg-violet-600/50 hover:bg-violet-600/80 p-2 rounded">
                            <FaSync />
                            Fazer nova consulta
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};


// --- Main Page Component ---

export default function PerdecompComparativoPage() {
    const [client, setClient] = useState(null);
    const [competitors, setCompetitors] = useState([]);
    const [endDate, setEndDate] = useState(new Date());
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 5);
        return d;
    });
    const [comparisonData, setComparisonData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const newStartDate = new Date(endDate);
        newStartDate.setFullYear(newStartDate.getFullYear() - 5);
        setStartDate(newStartDate);
    }, [endDate]);

    const formatDate = (date) => date.toISOString().split('T')[0];

    const processApiResults = (apiResponse, company) => {
        const newRowsToSave = [];
        const now = new Date().toISOString();
        const randomHex = [...Array(4)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        const perdcompIdBase = `PDC-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`;

        const mappedLines = (apiResponse.itens || []).map((item, index) => {
            const newRow = {
                Cliente_ID: company.Cliente_ID || '',
                Nome_da_Empresa: company.Nome_da_Empresa || '',
                Perdcomp_ID: `${perdcompIdBase}-${randomHex}${index}`,
                CNPJ: company.CNPJ_Empresa.replace(/\D/g, ''),
                Tipo_Pedido: item.tipo_pedido,
                Situacao: item.situacao,
                Periodo_Inicio: item.periodo_apuracao_inicio,
                Periodo_Fim: item.periodo_apuracao_fim,
                Valor_Total: item.valor_total_credito,
                Numero_Processo: item.numero_processo,
                Data_Protocolo: item.data_protocolo,
                Ultima_Atualizacao: item.ultima_atualizacao,
                Quantidade_Receitas: item.receitas?.length || 0,
                Quantidade_Origens: item.origens_credito?.length || 0,
                Quantidade_DARFs: item.darfs?.length || 0,
                URL_Comprovante_HTML: item.site_receipts?.html || item.url_comprovante_html || '',
                URL_Comprovante_PDF: item.site_receipts?.pdf || item.url_comprovante_pdf || '',
                Data_Consulta: now,
            };
            newRowsToSave.push(newRow);
            return newRow;
        });

        return { mappedLines, newRowsToSave };
    };

    const aggregateDataForDisplay = (lines, company) => {
        if (!lines || lines.length === 0) {
            return {
                cnpj: company.CNPJ_Empresa,
                nome: company.Nome_da_Empresa,
                quantidade: 0,
                valorTotal: 0,
                valorPorTipo: {},
                comprovantes: [],
                ultimaConsulta: new Date().toISOString(),
            };
        }

        const valorPorTipo = lines.reduce((acc, curr) => {
            const tipo = curr.Tipo_Pedido || 'Não especificado';
            const valor = parseFloat(curr.Valor_Total) || 0;
            acc[tipo] = (acc[tipo] || 0) + valor;
            return acc;
        }, {});

        const valorTotal = Object.values(valorPorTipo).reduce((sum, v) => sum + v, 0);

        const comprovantes = lines.map(l => ({
            id: l.Perdcomp_ID,
            html: l.URL_Comprovante_HTML,
            pdf: l.URL_Comprovante_PDF,
        })).filter(c => c.html || c.pdf);

        return {
            cnpj: company.CNPJ_Empresa,
            nome: company.Nome_da_Empresa,
            quantidade: lines.length,
            valorTotal,
            valorPorTipo,
            comprovantes,
            ultimaConsulta: lines[0]?.Data_Consulta,
        };
    };

    const handleConsult = async (singleCnpj = null, force = false) => {
        setIsLoading(true);

        const allCompanies = [client, ...competitors.map(c => c.data)];
        const targets = allCompanies.filter(c => c?.CNPJ_Empresa && (singleCnpj === null || c.CNPJ_Empresa.replace(/\D/g, '') === singleCnpj.replace(/\D/g, '')));

        let allRowsToSave = [];
        const newComparisonData = [];

        for (const company of targets) {
            const res = await fetch('/api/infosimples/perdcomp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cnpj: company.CNPJ_Empresa,
                    periodoInicio: formatDate(startDate),
                    periodoFim: formatDate(endDate),
                    force: force,
                }),
            });

            const result = await res.json();
            let finalLines = [];

            if (result.ok && result.fonte === 'api') {
                const { mappedLines, newRowsToSave } = processApiResults(result, company);
                finalLines = mappedLines;
                allRowsToSave = allRowsToSave.concat(newRowsToSave);
            } else if (result.ok && result.fonte === 'planilha') {
                finalLines = result.linhas;
            }

            newComparisonData.push(aggregateDataForDisplay(finalLines, company));
        }

        if (allRowsToSave.length > 0) {
            await fetch('/api/perdecomp/salvar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ linhas: allRowsToSave }),
            });
        }

        if (singleCnpj) {
            // If refreshing a single one, update it in the existing data
            setComparisonData(prevData => prevData.map(d => d.cnpj.replace(/\D/g, '') === singleCnpj.replace(/\D/g, '') ? newComparisonData[0] : d));
        } else {
            setComparisonData(newComparisonData);
        }

        setIsLoading(false);
    };

    const handleAddCompetitor = () => {
        if (competitors.length < 3) {
            setCompetitors([...competitors, { id: Date.now(), data: null }]);
        }
    };

    const handleUpdateCompetitor = (index, data) => {
        const newCompetitors = [...competitors];
        newCompetitors[index].data = data;
        setCompetitors(newCompetitors);
    };

    const handleRemoveCompetitor = (id) => {
        setCompetitors(competitors.filter(c => c.id !== id));
    };

    return (
        <div className="p-4 md:p-8 text-white min-h-screen bg-gray-900">
            <h1 className="text-2xl font-bold mb-6">PER/DCOMP - Comparativo</h1>

            <div className="bg-gray-800/50 p-6 rounded-lg shadow-xl space-y-6">
                <div>
                    <h2 className="text-xl font-semibold mb-2">Cliente</h2>
                    <CompanyInput value={client} onChange={setClient} />
                </div>

                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xl font-semibold">Concorrentes ({competitors.length}/3)</h2>
                        <button
                            onClick={handleAddCompetitor}
                            disabled={competitors.length >= 3}
                            className="bg-violet-600 hover:bg-violet-700 px-4 py-2 rounded disabled:bg-gray-600"
                        >
                            Adicionar Concorrente
                        </button>
                    </div>
                    <div className="space-y-4">
                        {competitors.map((comp, index) => (
                            <div key={comp.id} className="flex items-center gap-2">
                                <div className="flex-grow">
                                    <CompanyInput
                                        value={comp.data}
                                        onChange={(data) => handleUpdateCompetitor(index, data)}
                                    />
                                </div>
                                <button onClick={() => handleRemoveCompetitor(comp.id)} className="text-red-500 hover:text-red-700 p-2">
                                    Remover
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-wrap gap-4">
                    <div>
                        <label htmlFor="endDate" className="block text-sm font-medium mb-1">Período Fim</label>
                        <input
                            type="date"
                            id="endDate"
                            value={formatDate(endDate)}
                            onChange={(e) => setEndDate(new Date(e.target.value))}
                            className="p-2 border rounded bg-gray-700 text-white"
                        />
                    </div>
                    <div>
                        <label htmlFor="startDate" className="block text-sm font-medium mb-1">Período Início (Automático)</label>
                        <input
                            type="date"
                            id="startDate"
                            value={formatDate(startDate)}
                            readOnly
                            className="p-2 border rounded bg-gray-600 text-gray-300"
                        />
                    </div>
                </div>

                <div>
                    <button
                        onClick={() => handleConsult(null, false)}
                        disabled={isLoading}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded disabled:bg-gray-600"
                    >
                        {isLoading ? 'Consultando...' : 'Consultar / Atualizar Comparação'}
                    </button>
                </div>
            </div>

            <ComparisonResults data={comparisonData} onForceRefresh={(cnpj) => handleConsult(cnpj, true)} />
        </div>
    );
}
