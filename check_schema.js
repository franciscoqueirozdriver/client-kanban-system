const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

if (fs.existsSync('env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('env.local'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const tables = [
    'clientes', 'leads', 'negocios', 'perdecomp', 'layout_importacao_empresas', 'leads_exact_spotter',
    'perdecomp_itens', 'perdecomp_facts', 'perdecomp_snapshot', 'historico_interacoes'
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(0);
    if (error) {
      console.log(`Table ${table}: ERROR - ${error.message}`);
    } else {
      console.log(`Table ${table}: EXISTS`);
      const { data: rowData } = await supabase.from(table).select('*').limit(1);
      if (rowData && rowData.length > 0) {
        console.log(`Columns for ${table}: `, Object.keys(rowData[0]).join(', '));
      }
    }
  }
}
run();
