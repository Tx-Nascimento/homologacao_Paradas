const DB_NOME = "paradas_offline_db";
const DB_VERSAO = 4;

const STORE_CRIACOES = "criacoes_pendentes";
const STORE_FINALIZACOES = "finalizacoes_pendentes";
const STORE_CREDENCIAIS = "credenciais_offline";
const STORE_CONFIG = "config_cache";
const STORE_SESSAO = "sessao_local";

let dbPromise = null;

function estaOnline() {
    return navigator.onLine;
}

function abrirDB() {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        let resolvido = false;

        const requisicao = indexedDB.open(
            DB_NOME,
            DB_VERSAO
        );

        requisicao.onupgradeneeded = evento => {
            const db = evento.target.result;

            if (!db.objectStoreNames.contains(STORE_CRIACOES)) {
                db.createObjectStore(
                    STORE_CRIACOES,
                    { keyPath: "offline_id" }
                );
            }

            if (!db.objectStoreNames.contains(STORE_FINALIZACOES)) {
                db.createObjectStore(
                    STORE_FINALIZACOES,
                    { keyPath: "offline_id" }
                );
            }

            if (!db.objectStoreNames.contains(STORE_CREDENCIAIS)) {
                db.createObjectStore(
                    STORE_CREDENCIAIS,
                    { keyPath: "email" }
                );
            }

            if (!db.objectStoreNames.contains(STORE_CONFIG)) {
                db.createObjectStore(
                    STORE_CONFIG,
                    { keyPath: "chave" }
                );
            }

            if (!db.objectStoreNames.contains(STORE_SESSAO)) {
                db.createObjectStore(
                    STORE_SESSAO,
                    { keyPath: "chave" }
                );
            }
        };

        requisicao.onblocked = () => {
            if (resolvido) {
                return;
            }

            resolvido = true;
            dbPromise = null;

            reject(
                new Error(
                    "Banco local bloqueado por outra aba do aplicativo."
                )
            );
        };

        requisicao.onsuccess = evento => {
            if (resolvido) {
                return;
            }

            resolvido = true;

            const db = evento.target.result;

            db.onversionchange = () => {
                db.close();
                dbPromise = null;
            };

            resolve(db);
        };

        requisicao.onerror = evento => {
            if (resolvido) {
                return;
            }

            resolvido = true;
            dbPromise = null;

            reject(evento.target.error);
        };

        setTimeout(() => {
            if (resolvido) {
                return;
            }

            resolvido = true;
            dbPromise = null;

            reject(
                new Error(
                    "Tempo esgotado ao abrir o banco local."
                )
            );
        }, 8000);
    });

    return dbPromise;
}

async function dbTransacao(storeName, modo) {
    const db = await abrirDB();

    return db
        .transaction(storeName, modo)
        .objectStore(storeName);
}

async function dbAdicionar(storeName, registro) {
    const store = await dbTransacao(
        storeName,
        "readwrite"
    );

    return new Promise((resolve, reject) => {
        const requisicao = store.put(registro);

        requisicao.onsuccess = () => resolve(true);
        requisicao.onerror = () => reject(requisicao.error);
    });
}

async function dbListarTodos(storeName) {
    const store = await dbTransacao(
        storeName,
        "readonly"
    );

    return new Promise((resolve, reject) => {
        const requisicao = store.getAll();

        requisicao.onsuccess = () =>
            resolve(requisicao.result || []);

        requisicao.onerror = () =>
            reject(requisicao.error);
    });
}

async function dbBuscar(storeName, chave) {
    const store = await dbTransacao(
        storeName,
        "readonly"
    );

    return new Promise((resolve, reject) => {
        const requisicao = store.get(chave);

        requisicao.onsuccess = () =>
            resolve(requisicao.result || null);

        requisicao.onerror = () =>
            reject(requisicao.error);
    });
}

async function dbRemover(storeName, chave) {
    const store = await dbTransacao(
        storeName,
        "readwrite"
    );

    return new Promise((resolve, reject) => {
        const requisicao = store.delete(chave);

        requisicao.onsuccess = () => resolve(true);
        requisicao.onerror = () => reject(requisicao.error);
    });
}

async function dbAtualizar(storeName, registro) {
    return dbAdicionar(storeName, registro);
}

function bufferParaBase64(buffer) {
    return btoa(
        String.fromCharCode(
            ...new Uint8Array(buffer)
        )
    );
}

function base64ParaBuffer(base64) {
    const binario = atob(base64);
    const bytes = new Uint8Array(binario.length);

    for (let i = 0; i < binario.length; i++) {
        bytes[i] = binario.charCodeAt(i);
    }

    return bytes;
}

async function gerarSaltAleatorio() {
    const salt = crypto.getRandomValues(
        new Uint8Array(16)
    );

    return bufferParaBase64(salt);
}

async function derivarHashSenha(
    senha,
    saltBase64
) {
    const salt = base64ParaBuffer(saltBase64);
    const encoder = new TextEncoder();

    const chaveBase = await crypto.subtle.importKey(
        "raw",
        encoder.encode(senha),
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
    );

    const bits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        chaveBase,
        256
    );

    return bufferParaBase64(bits);
}

async function validarSenhaOffline(
    senha,
    salt,
    hashEsperado
) {
    const hashCalculado =
        await derivarHashSenha(senha, salt);

    return hashCalculado === hashEsperado;
}

async function salvarCredencialOffline(
    email,
    senha,
    perfilAtual
) {
    if (!email) {
        return;
    }

    const emailChave =
        email.trim().toLowerCase();

    const salt = await gerarSaltAleatorio();
    const hash = await derivarHashSenha(
        senha,
        salt
    );

    await dbAdicionar(STORE_CREDENCIAIS, {
        email: emailChave,
        salt,
        hash,
        perfil: perfilAtual,
        revogado_offline_em:
            perfilAtual.revogado_offline_em || null,
        atualizado_em: new Date().toISOString()
    });
}

async function buscarCredencialOffline(email) {
    if (!email) {
        return null;
    }

    return dbBuscar(
        STORE_CREDENCIAIS,
        email.trim().toLowerCase()
    );
}

async function salvarCacheConfig(chave, valor) {
    try {
        await dbAdicionar(STORE_CONFIG, {
            chave,
            valor,
            atualizado_em: new Date().toISOString()
        });
    } catch {
        // Cache não é crítico.
    }
}

async function buscarCacheConfig(chave) {
    try {
        const registro = await dbBuscar(
            STORE_CONFIG,
            chave
        );

        return registro?.valor || null;
    } catch {
        return null;
    }
}
async function salvarSessaoLocal() {
    try {
        await dbAdicionar(STORE_SESSAO, {
            chave: "atual",
            usuario_id: usuario?.id || null,
            usuario_email:
                usuario?.email ||
                perfil?.email ||
                null,
            perfil,
            modoOffline,
            salvo_em: new Date().toISOString()
        });
    } catch {
        // Se falhar, o usuário precisará entrar novamente.
    }
}

async function buscarSessaoLocal() {
    try {
        return await dbBuscar(
            STORE_SESSAO,
            "atual"
        );
    } catch {
        return null;
    }
}

async function limparSessaoLocal() {
    try {
        await dbRemover(
            STORE_SESSAO,
            "atual"
        );
    } catch {
        // Falha não crítica.
    }
}

async function restaurarSessaoLocal() {
    try {
        const sessao =
            await buscarSessaoLocal();

        if (!sessao?.perfil) {
            return false;
        }

        if (sessao.modoOffline) {
            const cache =
                await buscarCredencialOffline(
                    sessao.usuario_email
                );

            if (
                !cache ||
                cache.revogado_offline_em ||
                !cache.perfil?.ativo
            ) {
                await limparSessaoLocal();
                return false;
            }

            usuario = {
                id: cache.perfil.id,
                email: cache.perfil.email
            };

            perfil = cache.perfil;
            modoOffline = true;

            abrirAppComPerfil();
            return true;
        }

        if (estaOnline()) {
            try {
                const { data } =
                    await client.auth.getSession();

                if (data?.session?.user) {
                    usuario =
                        data.session.user;

                    modoOffline = false;

                    await carregarPerfil();
                    return true;
                }
            } catch {
                // Continua para restauração local.
            }
        }

        usuario = {
            id: sessao.perfil.id,
            email: sessao.perfil.email
        };

        perfil = sessao.perfil;
        modoOffline = true;

        abrirAppComPerfil();
        return true;

    } catch (erro) {
        console.warn(
            "Não foi possível restaurar a sessão local:",
            erro.message
        );

        const msg =
            document.getElementById("loginMsg");

        if (msg) {
            msg.innerHTML =
                `<div class="erro">
                    Não foi possível restaurar a sessão:
                    ${erro.message}
                </div>`;
        }

        return false;
    }
}

async function adicionarFilaCriacao(payload) {
    await dbAdicionar(STORE_CRIACOES, {
        ...payload,
        tentativas: 0,
        ultimo_erro: null,
        criado_em_local:
            new Date().toISOString()
    });
}

async function adicionarFilaFinalizacao(payload) {
    await dbAdicionar(
        STORE_FINALIZACOES,
        {
            ...payload,
            tentativas: 0,
            ultimo_erro: null,
            criado_em_local:
                new Date().toISOString()
        }
    );
}

async function contarPendencias() {
    const [
        criacoes,
        finalizacoes
    ] = await Promise.all([
        dbListarTodos(STORE_CRIACOES),
        dbListarTodos(STORE_FINALIZACOES)
    ]);

    return {
        criacoes: criacoes.length,
        finalizacoes:
            finalizacoes.length
    };
}

async function atualizarInfoFilaOffline() {
    const elemento =
        document.getElementById(
            "filaOfflineInfo"
        );

    if (!elemento) {
        return;
    }

    const {
        criacoes,
        finalizacoes
    } = await contarPendencias();

    const total =
        criacoes + finalizacoes;

    if (!total) {
        elemento.innerHTML =
            "Sem pendências offline.";
        return;
    }

    const partes = [];

    if (criacoes) {
        partes.push(
            `${criacoes} abertura(s)`
        );
    }

    if (finalizacoes) {
        partes.push(
            `${finalizacoes} finalização(ões)`
        );
    }

    elemento.innerHTML =
        `<span class="erro">
            ${total} pendência(s):
            ${partes.join(" e ")}.
        </span>`;
}

async function atualizarPainelPendenciasAbertas() {
    const painel =
        document.getElementById(
            "painelPendenciasAbertas"
        );

    if (!painel) {
        return;
    }

    const criacoes =
        await dbListarTodos(
            STORE_CRIACOES
        );

    const finalizacoes =
        await dbListarTodos(
            STORE_FINALIZACOES
        );

    const total =
        criacoes.length +
        finalizacoes.length;

    if (!total) {
        painel.innerHTML = `
            <div class="painel-offline sem-pendencia">
                <b>Sem pendências offline.</b>
                <div class="small">
                    Todos os registros estão sincronizados.
                </div>
            </div>
        `;
        return;
    }

    const linhasCriacoes =
        criacoes.map(item => `
            <div class="linha-pendencia">
                <span>
                    <span class="tag-tipo">
                        Abertura
                    </span>

                    ${item.maquina_nome || "Máquina"}
                    —
                    ${item.setor || ""}
                </span>
            </div>
        `).join("");

    const linhasFinalizacoes =
        finalizacoes.map(item => `
            <div class="linha-pendencia">
                <span>
                    <span class="tag-tipo">
                        Finalização
                    </span>

                    Parada
                    ${String(
                        item.parada_id ||
                        item.offline_id ||
                        ""
                    ).slice(0, 8)}
                </span>
            </div>
        `).join("");

    painel.innerHTML = `
        <div class="painel-offline">

            <b>
                ${total} pendência(s)
                aguardando sincronização
            </b>

            <div
                class="small"
                style="margin:6px 0 10px;">
                Os registros serão enviados
                automaticamente quando a conexão voltar.
            </div>

            ${linhasCriacoes}
            ${linhasFinalizacoes}

            <button
                class="btn-warning"
                onclick="tentarSincronizarAgora()"
                ${sincronizando ? "disabled" : ""}>

                ${
                    sincronizando
                        ? "Sincronizando..."
                        : "Tentar sincronizar agora"
                }

            </button>

        </div>
    `;
}

async function tentarSincronizarAgora() {
    if (!estaOnline()) {
        alert(
            "Ainda não há conexão com a internet."
        );
        return;
    }

    await sincronizarFilaOffline();
}
async function sincronizarFilaOffline() {
    if (sincronizando || !estaOnline()) {
        return;
    }

    sincronizando = true;

    await atualizarPainelPendenciasAbertas();

    try {
        await sincronizarCriacoesPendentes();
        await sincronizarFinalizacoesPendentes();
    } finally {
        sincronizando = false;
    }

    await atualizarInfoFilaOffline();
    await atualizarPainelPendenciasAbertas();

    const abertasTela =
        document.getElementById("abertasTela");

    if (
        abertasTela &&
        !abertasTela.classList.contains("hidden")
    ) {
        await carregarAbertas();
    }

    await carregarHistorico();
    await carregarDashboard();
}

async function sincronizarCriacoesPendentes() {
    const fila = await dbListarTodos(
        STORE_CRIACOES
    );

    if (!fila.length) {
        return;
    }

    for (const item of fila) {
        try {
            const {
                tentativas,
                ultimo_erro,
                criado_em_local,
                ...payload
            } = item;

            const { error } = await client
                .from("paradas")
                .insert([payload]);

            if (error) {
                await dbAtualizar(
                    STORE_CRIACOES,
                    {
                        ...item,
                        tentativas:
                            (item.tentativas || 0) + 1,
                        ultimo_erro:
                            error.message
                    }
                );

                continue;
            }

            await dbRemover(
                STORE_CRIACOES,
                item.offline_id
            );

        } catch (erro) {
            await dbAtualizar(
                STORE_CRIACOES,
                {
                    ...item,
                    tentativas:
                        (item.tentativas || 0) + 1,
                    ultimo_erro:
                        erro.message
                }
            );
        }
    }
}

async function sincronizarFinalizacoesPendentes() {
    const fila = await dbListarTodos(
        STORE_FINALIZACOES
    );

    if (!fila.length) {
        return;
    }

    for (const item of fila) {
        try {
            const {
                offline_id,
                parada_id,
                tentativas,
                ultimo_erro,
                criado_em_local,
                ...dadosFinalizacao
            } = item;

            if (!parada_id) {
                await dbAtualizar(
                    STORE_FINALIZACOES,
                    {
                        ...item,
                        tentativas:
                            (item.tentativas || 0) + 1,
                        ultimo_erro:
                            "ID da parada não informado."
                    }
                );

                continue;
            }

            const { error } = await client
                .from("paradas")
                .update(dadosFinalizacao)
                .eq("id", parada_id);

            if (error) {
                await dbAtualizar(
                    STORE_FINALIZACOES,
                    {
                        ...item,
                        tentativas:
                            (item.tentativas || 0) + 1,
                        ultimo_erro:
                            error.message
                    }
                );

                continue;
            }

            await dbRemover(
                STORE_FINALIZACOES,
                offline_id
            );

        } catch (erro) {
            await dbAtualizar(
                STORE_FINALIZACOES,
                {
                    ...item,
                    tentativas:
                        (item.tentativas || 0) + 1,
                    ultimo_erro:
                        erro.message
                }
            );
        }
    }
}

async function atualizarStatusConexao() {
    const statusParada =
        document.getElementById(
            "statusConexao"
        );

    const statusTopo =
        document.getElementById(
            "statusConexaoTopo"
        );

    const online = estaOnline();

    const html = online
        ? '<span class="ok">Online</span>'
        : '<span class="erro">Offline — os lançamentos serão salvos no aparelho.</span>';

    if (statusParada) {
        statusParada.innerHTML = html;
    }

    if (statusTopo) {
        statusTopo.innerHTML = html;
    }

    atualizarAvisoLoginConexao();
    await atualizarInfoFilaOffline();
}

function atualizarAvisoLoginConexao() {
    const elemento =
        document.getElementById(
            "statusConexaoLogin"
        );

    if (!elemento) {
        return;
    }

    elemento.innerHTML = estaOnline()
        ? '<span class="ok">Online</span>'
        : '<span class="erro">Offline — use um login já salvo neste aparelho.</span>';
}

window.addEventListener(
    "online",
    async () => {
        await atualizarStatusConexao();

        if (
            usuario &&
            perfil &&
            !modoOffline
        ) {
            await sincronizarFilaOffline();
        }
    }
);

window.addEventListener(
    "offline",
    atualizarStatusConexao
);