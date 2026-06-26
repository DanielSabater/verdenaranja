import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Simple parser for .env
let supabaseUrl = 'https://dkqejzredskqexsaskob.supabase.co';
let supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrcWVqenJlZHNrcWV4c2Fza29iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDQ3MjcsImV4cCI6MjA4OTI4MDcyN30.EE1lzyXhYzjCZ1Ynpf4lgUYZhHsuChHblRED_ccsc-s';

try {
  const envContent = fs.readFileSync('.env', 'utf8');
  const urlLine = envContent.split('\n').find(line => line.startsWith('VITE_SUPABASE_URL='));
  const keyLine = envContent.split('\n').find(line => line.startsWith('VITE_SUPABASE_ANON_KEY='));
  if (urlLine) supabaseUrl = urlLine.split('=')[1].trim();
  if (keyLine) supabaseAnonKey = keyLine.split('=')[1].trim();
} catch (e) {
  // Use fallback values
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const datos2025 = [
  { fecha: "2025-05-01", total: 12614000 },
  { fecha: "2025-06-01", total: 11692200 },
  { fecha: "2025-07-01", total: 14473200 },
  { fecha: "2025-08-01", total: 16425000 },
  { fecha: "2025-09-01", total: 14748600 },
  { fecha: "2025-10-01", total: 19808700 },
  { fecha: "2025-11-01", total: 19944000 },
  { fecha: "2025-12-01", total: 25672000 }
];

async function run() {
  console.log("Iniciando importación de facturación neta de 2025...");
  
  const rows = datos2025.map(item => ({
    id: `day:${item.fecha}`,
    data: {
      "historico_2025": {
        paid: true,
        payMethod: "efectivo",
        services: [
          {
            name: "Total Facturación Mensual",
            price: item.total,
            excluidoComision: true
          }
        ]
      }
    }
  }));

  const { data, error } = await supabase
    .from('perlaverde_data')
    .upsert(rows);

  if (error) {
    console.error("Error al importar datos:", error);
  } else {
    console.log("¡Carga exitosa! Se importaron los 8 meses del 2025.");
  }
}

run();
