import fs from 'fs';

let supabaseUrl = 'https://dkqejzredskqexsaskob.supabase.co';
let supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrcWVqenJlZHNrcWV4c2Fza29iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDQ3MjcsImV4cCI6MjA4OTI4MDcyN30.EE1lzyXhYzjCZ1Ynpf4lgUYZhHsuChHblRED_ccsc-s';

try {
  const envContent = fs.readFileSync('.env', 'utf8');
  const urlLine = envContent.split('\n').find(line => line.startsWith('VITE_SUPABASE_URL='));
  const keyLine = envContent.split('\n').find(line => line.startsWith('VITE_SUPABASE_ANON_KEY='));
  if (urlLine) supabaseUrl = urlLine.split('=')[1].trim();
  if (keyLine) supabaseAnonKey = keyLine.split('=')[1].trim();
} catch (e) {
  // Use fallbacks
}

async function run() {
  console.log('🚀 Iniciando actualización masiva de precios en turnos futuros (>= 2026-08-05)...\n');

  const headers = {
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
  };

  // 1. Obtener la lista de precios actual desde 'config'
  const configRes = await fetch(`${supabaseUrl}/rest/v1/perlaverde_data?id=eq.config&select=data`, { headers });
  const configData = await configRes.json();

  if (!configData || !configData[0]) {
    console.error('Error al obtener la configuración de precios.');
    process.exit(1);
  }

  const servicesList = configData[0].data?.services || [];
  const priceMapByName = {};
  const priceMapById = {};

  servicesList.forEach(s => {
    if (s.name) priceMapByName[s.name] = s.price;
    if (s.id) priceMapById[s.id] = s.price;
  });

  console.log(`📋 Total de servicios vigentes cargados desde el config: ${servicesList.length}`);

  // 2. Obtener los registros de días futuros (>= 2026-08-05)
  const daysRes = await fetch(`${supabaseUrl}/rest/v1/perlaverde_data?id=gte.day:2026-08-05&id=like.day:*&select=id,data`, { headers });
  const dayRows = await daysRes.json();

  console.log(`📅 Total de registros diarios futuros encontrados: ${dayRows.length}\n`);

  let updatedDaysCount = 0;
  let updatedTurnosCount = 0;
  let updatedServicesCount = 0;

  const rowsToUpsert = [];

  for (const dayRow of dayRows) {
    let dayModified = false;
    const dayData = dayRow.data || {};

    for (const slotKey of Object.keys(dayData)) {
      const turno = dayData[slotKey];
      if (turno && Array.isArray(turno.services)) {
        let turnoModified = false;

        turno.services.forEach(srv => {
          const newPrice = priceMapByName[srv.name] !== undefined 
            ? priceMapByName[srv.name] 
            : priceMapById[srv.id];

          if (newPrice !== undefined && srv.price !== newPrice) {
            console.log(`  [${dayRow.id}] Slot ${slotKey} | "${srv.name}": $${srv.price} ➔ $${newPrice}`);
            srv.price = newPrice;
            turnoModified = true;
            updatedServicesCount++;
          }
        });

        if (turnoModified) {
          dayModified = true;
          updatedTurnosCount++;
        }
      }
    }

    if (dayModified) {
      updatedDaysCount++;
      rowsToUpsert.push({
        id: dayRow.id,
        data: dayData
      });
    }
  }

  if (rowsToUpsert.length === 0) {
    console.log('\n✨ Todos los turnos futuros ya tienen los precios al día. No se realizaron cambios.');
    return;
  }

  console.log(`\n💾 Aplicando cambios en Supabase para ${rowsToUpsert.length} días...`);

  const updateRes = await fetch(`${supabaseUrl}/rest/v1/perlaverde_data`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rowsToUpsert)
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    console.error('❌ Error al guardar los cambios en Supabase:', errText);
  } else {
    console.log('\n✅ ¡Actualización masiva completada con éxito!');
    console.log(`- Días modificados: ${updatedDaysCount}`);
    console.log(`- Turnos modificados: ${updatedTurnosCount}`);
    console.log(`- Servicios actualizados: ${updatedServicesCount}`);
  }
}

run();
