const SUPABASE_URL = "https://mzawmvqrlrptidcwxkoi.supabase.co";

const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16YXdtdnFybHJwdGlkY3d4a29pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzU4ODQsImV4cCI6MjA4OTE1MTg4NH0.mdl00txGN4GpXdLsgeANS1m05iTeQaO76jo7yggp004";

const { createClient } = supabase;

const client = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let usuario = null;
let perfil = null;
let setoresCache = [];
let maquinasCache = [];
let sincronizando = false;
let modoOffline = false;
