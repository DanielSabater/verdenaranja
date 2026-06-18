import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://dkqejzredskqexsaskob.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrcWVqenJlZHNrcWV4c2Fza29iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDQ3MjcsImV4cCI6MjA4OTI4MDcyN30.EE1lzyXhYzjCZ1Ynpf4lgUYZhHsuChHblRED_ccsc-s'
);

async function run() {
  const { data: dayData } = await supabase
    .from('perlaverde_data')
    .select('data')
    .eq('id', 'day:2026-06-17')
    .single();

  console.log("Appointment 2||11:30 details:", JSON.stringify(dayData?.data?.["2||11:30"] || {}, null, 2));
}
run();
