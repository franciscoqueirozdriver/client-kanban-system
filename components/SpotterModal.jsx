'use client';
import { useState, useEffect } from 'react';
import { FaSpinner } from 'react-icons/fa';

// Maps layout field names to simpler keys for form state
const fieldMap = {
  "Nome do Lead": "nomeLead", "Origem": "origem", "Sub-Origem": "subOrigem",
  "Mercado": "mercado", "Produto": "produto", "Site": "site", "País": "pais",
  "Estado": "estado", "Cidade": "cidade", "Logradouro": "logradouro",
  "Número": "numero", "Bairro": "bairro", "Complemento": "complemento",
  "CEP": "cep", "DDI": "ddi", "Telefones": "telefones", "Observação": "observacao",
  "CPF/CNPJ": "cpfCnpj",
  "Nome Contato": "nomeContato", "E-mail Contato": "emailContato",
  "Cargo Contato": "cargoContato", "DDI Contato": "ddiContato",
  "Telefones Contato": "telefonesContato",
  "Tipo do Serv. Comunicação": "tipoServComunicacao",
  "ID do Serv. Comunicação": "idServComunicacao", "Área": "area",
  "Nome da Empresa": "nomeEmpresa", "Etapa": "etapa", "Funil": "funil"
};

const reversedFieldMap = Object.entries(fieldMap).reduce((acc, [key, value]) => {
    acc[value] = key;
    return acc;
}, {});

export default function SpotterModal({ isOpen, onClose, initialData, onSent }) {
  const [formData, setFormData] = useState({});
  const [isSending, setIsSending] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [errors, setErrors] = useState([]); // {field, message}

  useEffect(() => {
    if (isOpen && initialData) {
      const client = initialData;
      const initialFormState = {
        [fieldMap["Nome do Lead"]]: client?.company ?? "Lead sem título",
        [fieldMap["Origem"]]: client?.origem ?? process.env.NEXT_PUBLIC_DEFAULT_CONTACT_ORIGEM ?? "Kanban",
        [fieldMap["Mercado"]]: client?.segment ?? "Geral",
        [fieldMap["Telefones"]]: client?.contacts?.[0]?.normalizedPhones?.join(";") || "",
        [fieldMap["Área"]]: (Array.isArray(client?.opportunities) && client.opportunities.length > 0 ? client.opportunities.join(";") : client?.segment) ?? "Geral",
        [fieldMap["Etapa"]]: client?.status ?? "Novo",
        [fieldMap["Nome da Empresa"]]: client?.company ?? "",
        [fieldMap["Nome Contato"]]: client?.contacts?.[0]?.name ?? "",
        [fieldMap["E-mail Contato"]]: client?.contacts?.[0]?.email?.split(';')[0].trim() ?? process.env.NEXT_PUBLIC_DEFAULT_CONTACT_EMAIL,
        [fieldMap["Telefones Contato"]]: client?.contacts?.[0]?.normalizedPhones?.join(";") || "",
        [fieldMap["Cargo Contato"]]: client?.contacts?.[0]?.role ?? "",
        [fieldMap["CPF/CNPJ"]]: client?.cnpj ?? "",
        [fieldMap["Estado"]]: client?.uf ?? "",
        [fieldMap["Cidade"]]: client?.city ?? "",
        [fieldMap["País"]]: client?.country ?? (client.city ? 'Brasil' : ''),
        [fieldMap["DDI"]]: "55",
        [fieldMap["DDI Contato"]]: "55",
      };

      // Initialize all keys to prevent uncontrolled component warnings
      const fullForm = Object.values(fieldMap).reduce((acc, key) => {
        acc[key] = acc[key] ?? "";
        return acc;
      }, initialFormState);

      setFormData(fullForm);
      setErrors([]);
    }
  }, [isOpen, initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEnrich = async () => {
    const companyName = formData[fieldMap["Nome da Empresa"]];
    if (!companyName) {
      alert('Por favor, preencha o nome da empresa para enriquecer.');
      return;
    }
    setIsEnriching(true);
    setErrors([]);
    try {
      const res = await fetch('/api/empresas/enriquecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: companyName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao enriquecer');

      const s = data.suggestion;
      setFormData(prev => ({
        ...prev,
        [fieldMap["Nome da Empresa"]]: s.Nome_da_Empresa || prev[fieldMap["Nome da Empresa"]],
        [fieldMap["Site"]]: s.Site_Empresa || prev[fieldMap["Site"]],
        [fieldMap["País"]]: s.Pais_Empresa || prev[fieldMap["País"]],
        [fieldMap["Estado"]]: s.Estado_Empresa || prev[fieldMap["Estado"]],
        [fieldMap["Cidade"]]: s.Cidade_Empresa || prev[fieldMap["Cidade"]],
        [fieldMap["Logradouro"]]: s.Logradouro_Empresa || prev[fieldMap["Logradouro"]],
        [fieldMap["Número"]]: s.Numero_Empresa || prev[fieldMap["Número"]],
        [fieldMap["Bairro"]]: s.Bairro_Empresa || prev[fieldMap["Bairro"]],
        [fieldMap["CEP"]]: s.CEP_Empresa || prev[fieldMap["CEP"]],
        [fieldMap["CPF/CNPJ"]]: s.CNPJ_Empresa || prev[fieldMap["CPF/CNPJ"]],
        [fieldMap["Telefones"]]: s.Telefones_Empresa || prev[fieldMap["Telefones"]],
        [fieldMap["Nome Contato"]]: s.Nome_Contato || prev[fieldMap["Nome Contato"]],
        [fieldMap["E-mail Contato"]]: s.Email_Contato || prev[fieldMap["E-mail Contato"]],
        [fieldMap["Cargo Contato"]]: s.Cargo_Contato || prev[fieldMap["Cargo Contato"]],
        [fieldMap["Telefones Contato"]]: s.Telefones_Contato || prev[fieldMap["Telefones Contato"]],
        [fieldMap["Mercado"]]: s.Mercado || prev[fieldMap["Mercado"]],
        [fieldMap["Produto"]]: s.Produto || prev[fieldMap["Produto"]],
        [fieldMap["Área"]]: s.Area || prev[fieldMap["Área"]],
      }));
      alert('Dados enriquecidos com sucesso!');
    } catch (err) {
      alert(`Erro ao enriquecer: ${err.message}`);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSending(true);
    setErrors([]);
    try {
      const payloadForApi = Object.entries(formData).reduce((acc, [formKey, value]) => {
        const layoutKey = reversedFieldMap[formKey];
        if (layoutKey) {
          acc[layoutKey] = value || null;
        }
        return acc;
      }, {});

      const res = await fetch('/api/spoter/oportunidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadForApi)
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400 && data.details) {
          setErrors(data.details);
          const errorMessages = data.details.map(err => `${err.field}: ${err.message}`).join('\\n');
          alert(`Por favor, corrija os seguintes erros:\n${errorMessages}`);
        }
        throw new Error(data.error || `Erro ${res.status}`);
      }

      alert(`Sucesso! Resposta da API do Spotter: ${JSON.stringify(data, null, 2)}`);

      await fetch('/api/kanban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: initialData.id, color: 'purple', status: 'Enviado Spotter' })
      });

      if (onSent) {
        onSent({ color: 'purple', status: 'Enviado Spotter' });
      }
      onClose();
    } catch (err) {
      // Avoid double-alerting validation errors
      if (!errors.length) {
        alert(`Erro no processo de envio: ${err.message}`);
      }
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  const renderInput = (label, key, props = {}) => {
    const error = errors.find(e => e.field === label);
    return (
      <div>
        <label htmlFor={key} className="block text-sm font-medium mb-1">{label} {props.required && '*'}</label>
        <input id={key} name={key} value={formData[key] || ''} onChange={handleChange} {...props} className={`w-full rounded border p-2 ${error ? 'border-red-500' : 'border-gray-300'}`}/>
        {error && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        <header className="flex-shrink-0 px-6 py-4 border-b">
          <h2 className="text-xl font-bold">Enviar para Exact Spotter</h2>
          <p className="text-sm text-gray-500">Confirme ou edite os dados para envio.</p>
        </header>

        <form onSubmit={handleSubmit} className="flex-grow contents">
          <div className="flex-grow p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderInput("Nome do Lead", fieldMap["Nome do Lead"], { required: true })}
            {renderInput("Nome da Empresa", fieldMap["Nome da Empresa"])}
            {renderInput("CPF/CNPJ", fieldMap["CPF/CNPJ"])}
            {renderInput("Site", fieldMap["Site"], { type: 'url' })}
            {renderInput("Origem", fieldMap["Origem"], { required: true })}
            {renderInput("Sub-Origem", fieldMap["Sub-Origem"])}
            {renderInput("Mercado", fieldMap["Mercado"], { required: true })}
            {renderInput("Produto", fieldMap["Produto"])}
            {renderInput("Área", fieldMap["Área"], { required: true, placeholder: "Separar múltiplas por ;" })}
            {renderInput("Etapa", fieldMap["Etapa"], { required: true })}
            {renderInput("Funil", fieldMap["Funil"])}
            {renderInput("Telefones", fieldMap["Telefones"], { required: true, placeholder: "Separar múltiplos por ;" })}
            {renderInput("Observação", fieldMap["Observação"])}

            <h3 className="md:col-span-3 text-lg font-semibold border-t pt-4 mt-2">Endereço</h3>
            {renderInput("País", fieldMap["País"])}
            {renderInput("Estado", fieldMap["Estado"])}
            {renderInput("Cidade", fieldMap["Cidade"])}
            {renderInput("Logradouro", fieldMap["Logradouro"])}
            {renderInput("Número", fieldMap["Número"])}
            {renderInput("Bairro", fieldMap["Bairro"])}
            {renderInput("Complemento", fieldMap["Complemento"])}
            {renderInput("CEP", fieldMap["CEP"])}

            <h3 className="md:col-span-3 text-lg font-semibold border-t pt-4 mt-2">Contato</h3>
            {renderInput("Nome Contato", fieldMap["Nome Contato"])}
            {renderInput("Cargo Contato", fieldMap["Cargo Contato"])}
            {renderInput("E-mail Contato", fieldMap["E-mail Contato"], { type: 'email' })}
            {renderInput("Telefones Contato", fieldMap["Telefones Contato"], { placeholder: "Separar múltiplos por ;" })}

            <h3 className="md:col-span-3 text-lg font-semibold border-t pt-4 mt-2">Outros</h3>
            {renderInput("Tipo do Serv. Comunicação", fieldMap["Tipo do Serv. Comunicação"])}
            {renderInput("ID do Serv. Comunicação", fieldMap["ID do Serv. Comunicação"])}
          </div>

          <footer className="flex-shrink-0 px-6 py-4 border-t bg-white flex justify-between items-center">
            <button type="button" onClick={handleEnrich} disabled={isEnriching || isSending} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
              {isEnriching && <FaSpinner className="animate-spin" />}
              Enriquecer com IA
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-3 py-2 rounded-md bg-gray-200 text-gray-900 hover:bg-gray-300">
                Cancelar
              </button>
              <button type="submit" disabled={isSending || isEnriching} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-60 flex items-center gap-2">
                {isSending && <FaSpinner className="animate-spin" />}
                Enviar ao Spotter
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
