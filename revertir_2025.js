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

async function revertir() {
  console.log("Iniciando eliminación de datos históricos de 2025...");
  
  const idsABorrar = [
    "day:2025-05-01", "day:2025-06-01", "day:2025-07-01", "day:2025-08-01",
    "day:2025-09-01", "day:2025-10-01", "day:2025-11-01", "day:2025-12-01"
  ];
  
  const { error } = await supabase
    .from('perlaverde_data')
    .delete()
    .in('id', idsABorrar);
    
  if (error) {
    console.error("Error al borrar:", error);
  } else {
    console.log("¡Carga del 2025 revertida con éxito! Datos eliminados.");
  }
}

revertir();
