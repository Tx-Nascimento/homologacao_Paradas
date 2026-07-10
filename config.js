const SUPABASE_URL = "https://mzawmvqrlrptidcwxkoi.supabase.co";

const SUPABASE_KEY = "SUA_CHAVE_ANON_ATUAL";

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