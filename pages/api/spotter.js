import { appendCompanyImportRow, updateRow } from '../../lib/googleSheets';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { client } = req.body || {};
  if (!client) {
    return res.status(400).json({ error: 'Client data missing' });
  }

  const mappedFields = {
    name: client?.company || '',
    website: client?.website || '',
    country: client?.country || '',
    state: client?.state || '',
    city: client?.city || '',
    address: client?.address || '',
    addressComplement: client?.number || client?.complement || '',
    zipcode: client?.zipcode || '',
    cpfCnpj: client?.cnpj || '',
    ddiPhone: client?.ddi || '55',
    phone: client?.phone || '',
    ddiPhone2: client?.ddi2 || '',
    phone2: client?.phone2 || '',
    description: client?.observation || '',
    userEmail: process.env.SPOTTER_USER_EMAIL || '',
  };

  // registra na planilha de importação
  try {
    await appendCompanyImportRow(mappedFields);
  } catch (err) {
    console.error('Erro ao registrar planilha:', err);
  }

  const token = process.env.SPOTTER_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Token do Spotter não configurado' });
  }

  // Verifica duplicidade simples via API Spotter por CNPJ
  if (mappedFields.cpfCnpj) {
    try {
      const dupRes = await fetch(
        `https://api.exactspotter.com/v3/organization?cpfCnpj=${encodeURIComponent(
          mappedFields.cpfCnpj
        )}`,
        {
          headers: { token_exact: token },
        }
      );
      if (dupRes.ok) {
        const dupData = await dupRes.json();
        if (dupData?.value?.id) {
          // Já cadastrado, retorna ID existente
          return res.status(200).json({ id: dupData.value.id, duplicate: true });
        }
      }
    } catch (err) {
      // ignora erro de consulta duplicidade
    }
  }

  const payload = {
    duplicityValidation: true,
    organization: {
      name: mappedFields.name,
      userEmail: mappedFields.userEmail,
      cpfCnpj: mappedFields.cpfCnpj,
      website: mappedFields.website,
      ddiPhone: mappedFields.ddiPhone,
      phone: mappedFields.phone,
      ddiPhone2: mappedFields.ddiPhone2,
      phone2: mappedFields.phone2,
      address: mappedFields.address,
      addressComplement: mappedFields.addressComplement,
      zipcode: mappedFields.zipcode,
      city: mappedFields.city,
      state: mappedFields.state,
      country: mappedFields.country,
      description: mappedFields.description,
    },
  };

  try {
    const response = await fetch(
      'https://api.exactspotter.com/v3/organizationAdd',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          token_exact: token,
        },
        body: JSON.stringify(payload),
      }
    );
    const data = await response.json();
    if (response.status === 201) {
      const spotterId = data.value;
      if (client?.rows && client.rows.length > 0) {
        try {
          await updateRow(client.rows[0], { spotter_id: spotterId });
        } catch (err) {
          console.error('Erro ao atualizar ID Spotter na planilha:', err);
        }
      }
      return res.status(200).json({ id: spotterId });
    }
    return res
      .status(response.status)
      .json({ error: data?.message || 'Erro ao cadastrar no Spotter' });
  } catch (err) {
    return res.status(500).json({ error: 'Falha na comunicação com o Spotter' });
  }
}
