export async function lookupCep(rawCep) {
  const digits = String(rawCep || '').replace(/\D+/g, '');
  if (digits.length !== 8) {
    throw new Error('CEP inválido');
  }
  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) {
    throw new Error('Falha na consulta ao ViaCEP');
  }
  const data = await res.json();
  if (data.erro) {
    throw new Error('CEP não encontrado');
  }
  return {
    cep: data.cep || `${digits.slice(0, 5)}-${digits.slice(5)}`,
    logradouro: data.logradouro || '',
    bairro: data.bairro || '',
    localidade: data.localidade || '',
    uf: data.uf || '',
  };
}
