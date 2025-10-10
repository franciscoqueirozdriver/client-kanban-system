const toArray = (v) => {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  return String(v)
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
};

const hasAny = (s) => !!(s && String(s).trim());

function validateSpotterLead(p = {}, opts = {}) {
  const errors = {};
  const messages = [];
  const add = (k, msg) => ((errors[k] ||= []).push(msg));

  if (!hasAny(p.nomeLead)) add("nomeLead", "Campo obrigatório.");
  if (!hasAny(p.origem)) add("origem", "Campo obrigatório.");
  if (!hasAny(p.mercado)) add("mercado", "Campo obrigatório.");

  const temPais = hasAny(p.pais);
  const temEstado = hasAny(p.estado);
  const temCidade = hasAny(p.cidade);

  if (temPais) {
    if (!temEstado) add("estado", "Se informar País, Estado torna-se obrigatório.");
    if (!temCidade) add("cidade", "Se informar País, Cidade torna-se obrigatória.");
  }
  if (temEstado) {
    if (!temCidade) add("cidade", "Se informar Estado, Cidade torna-se obrigatória.");
    if (!temPais) add("pais", "Se informar Estado, País torna-se obrigatório.");
  }
  if (temCidade) {
    if (!temEstado) add("estado", "Se informar Cidade, Estado torna-se obrigatório.");
    if (!temPais) add("pais", "Se informar Cidade, País torna-se obrigatório.");
  }

  const addressish =
    hasAny(p.address) ||
    hasAny(p.addressNumber) ||
    hasAny(p.addressComplement) ||
    hasAny(p.neighborhood) ||
    hasAny(p.zipcode) ||
    temCidade;
  if (addressish) {
    if (!temEstado) add("estado", "Ao informar endereço/CEP/Cidade, Estado torna-se obrigatório (regra Spotter).");
    if (!temPais) add("pais", "Ao informar endereço/CEP/Cidade, País torna-se obrigatório (regra Spotter).");
  }

  const tels = toArray(p.telefones);
  if (hasAny(p.telefones) && tels.length === 0) {
    add("telefones", "Informe um ou mais telefones separados por ';'.");
  }

  const telsContato = toArray(p.telefonesContato);
  const temContatoInfo = telsContato.length > 0 || hasAny(p.emailContato);
  if (temContatoInfo && !hasAny(p.nomeContato)) {
    add("nomeContato", "Informe o Nome do Contato quando houver dados de contato.");
  }
  if (hasAny(p.telefonesContato) && telsContato.length === 0) {
    add("telefonesContato", "Informe um ou mais telefones separados por ';'.");
  }

  const temTipo = hasAny(String(p.tipoServCom ?? ""));
  const temId = hasAny(String(p.idServCom ?? ""));
  if (temTipo && !temId) add("idServCom", "Informe o ID do Serviço de Comunicação quando o Tipo for informado.");
  if (temId && !temTipo) add("tipoServCom", "Informe o Tipo do Serviço de Comunicação quando o ID for informado.");

  const areas = toArray(p.area);
  if (areas.length === 0) {
    add("area", "Selecione pelo menos uma Área válida.");
  } else if (Array.isArray(opts.areasValidas) && opts.areasValidas.length > 0) {
    const invalidas = areas.filter((a) => !opts.areasValidas.includes(a));
    if (invalidas.length) add("area", "Selecione apenas Áreas válidas.");
  }

  if (hasAny(p.modalidade) && Array.isArray(opts.modalidadesValidas) && opts.modalidadesValidas.length > 0) {
    if (!opts.modalidadesValidas.includes(String(p.modalidade))) {
      add("modalidade", "Selecione uma Modalidade válida.");
    }
  }

  const funilDef = p.funilId != null && String(p.funilId).trim() !== "";
  const etapaDef = hasAny(p.etapaNome);
  if (funilDef && etapaDef) {
    const lista =
      opts.etapasPorFunil?.[String(p.funilId)] ?? opts.etapasPorFunil?.[Number(p.funilId)];
    if (Array.isArray(lista) && lista.length > 0) {
      const okPorNome = lista.some(
        (e) => String(e.nome).trim().toLowerCase() === String(p.etapaNome).trim().toLowerCase(),
      );
      if (!okPorNome) add("etapaNome", "A Etapa informada não pertence ao Funil selecionado.");
    } else {
      messages.push(
        "Não foi possível validar compatibilidade de Etapa com o Funil no cliente — o servidor fará essa checagem.",
      );
    }
  }

  return { ok: Object.keys(errors).length === 0, fieldErrors: errors, messages };
}

module.exports = { validateSpotterLead };
