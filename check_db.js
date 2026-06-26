async function run() {
  const url = 'https://dkqejzredskqexsaskob.supabase.co/rest/v1/perlaverde_data?select=id,data';
  const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrcWVqenJlZHNrcWV4c2Fza29iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDQ3MjcsImV4cCI6MjA4OTI4MDcyN30.EE1lzyXhYzjCZ1Ynpf4lgUYZhHsuChHblRED_ccsc-s';
  
  const res = await fetch(url, {
    headers: {
      'apikey': apiKey,
      'Authorization': `Bearer ${apiKey}`
    }
  });
  
  const data = await res.json();
  const months = {};
  data.forEach(row => {
    if (row.id.startsWith("day:2026")) {
      const dateKey = row.id.replace("day:", "");
      const month = dateKey.substring(0, 7); // e.g. "2026-05"
      months[month] = (months[month] || 0) + 1;
    }
  });
  console.log("Months with records in 2026:", months);
}

run();
