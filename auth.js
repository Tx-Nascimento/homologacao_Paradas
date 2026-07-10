async function login() {
    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("senha").value.trim();
    const msg = document.getElementById("loginMsg");

    msg.innerHTML = "";

    if (!email || !senha) {
        msg.innerHTML = '<div class="erro">Informe e-mail e senha.</div>';
        return;
    }

    if (!estaOnline()) {
        await loginOffline(email, senha);
        return;
    }

    try {
        const { data, error } = await client.auth.signInWithPassword({
            email,
            password: senha
        });

        if (error) {
            const erroRede = /fetch|network|failed to fetch|NetworkError/i.test(
                error.message || ""
            );

            if (erroRede) {
                msg.innerHTML =
                    '<div class="erro">Sem conexão com o servidor. Tentando login offline...</div>';

                await loginOffline(email, senha);
                return;
            }

            msg.innerHTML = `<div class="erro">${error.message}</div>`;
            return;
        }

        if (!data?.user) {
            msg.innerHTML =
                '<div class="erro">Usuário não retornado no login.</div>';
            return;
        }

        usuario = data.user;
        modoOffline = false;

        await carregarPerfil();

    } catch (erro) {
        msg.innerHTML =
            '<div class="erro">Sem conexão com o servidor. Tentando login offline...</div>';

        await loginOffline(email, senha);
    }
}

async function carregarPerfil() {
    const msg = document.getElementById("loginMsg");

    try {
        const { data, error } = await client
            .from("perfis")
            .select("*")
            .eq("id", usuario.id)
            .single();

        if (error) {
            msg.innerHTML =
                `<div class="erro">Erro ao carregar perfil: ${error.message}</div>`;
            return;
        }

        if (!data) {
            msg.innerHTML =
                '<div class="erro">Perfil não encontrado para este usuário.</div>';
            return;
        }

        perfil = data;

        const senhaDigitada =
            document.getElementById("senha").value.trim();

        if (senhaDigitada) {
            await salvarCredencialOffline(
                perfil.email,
                senhaDigitada,
                perfil
            );
        }

        abrirAppComPerfil();

    } catch (erro) {
        msg.innerHTML =
            `<div class="erro">Falha ao abrir o app: ${erro.message}</div>`;
    }
}

async function loginOffline(email, senha) {
    const msg = document.getElementById("loginMsg");

    let cache;

    try {
        cache = await buscarCredencialOffline(email);
    } catch (erro) {
        msg.innerHTML =
            `<div class="erro">Não foi possível acessar os dados salvos neste aparelho: ${erro.message}</div>`;
        return;
    }

    if (!cache) {
        msg.innerHTML =
            '<div class="erro">Nenhum login anterior foi encontrado neste aparelho. Faça login online pelo menos uma vez.</div>';
        return;
    }

    let senhaCorreta;

    try {
        senhaCorreta = await validarSenhaOffline(
            senha,
            cache.salt,
            cache.hash
        );
    } catch (erro) {
        msg.innerHTML =
            `<div class="erro">Falha ao verificar a senha offline: ${erro.message}</div>`;
        return;
    }

    if (!senhaCorreta) {
        msg.innerHTML =
            '<div class="erro">Senha incorreta.</div>';
        return;
    }

    if (!cache.perfil?.ativo) {
        msg.innerHTML =
            '<div class="erro">Usuário inativo.</div>';
        return;
    }

    if (cache.revogado_offline_em) {
        msg.innerHTML =
            '<div class="erro">O acesso offline foi revogado. Conecte-se à internet para renovar o acesso.</div>';
        return;
    }

    usuario = {
        id: cache.perfil.id,
        email: cache.perfil.email
    };

    perfil = cache.perfil;
    modoOffline = true;

    abrirAppComPerfil();
}

function abrirAppComPerfil() {
    document.getElementById("loginTela").classList.add("hidden");
    document.getElementById("appTela").classList.remove("hidden");

    mostrarTela("homeTela");
    salvarSessaoLocal();

    document.getElementById("saudacao").innerText =
        `Olá, ${perfil.nome}`;

    document.getElementById("dadosUsuario").innerText =
        `Setor: ${perfil.setor || "-"} | ` +
        `Cargo: ${perfil.cargo || "-"} | ` +
        `Administrador: ${perfil.admin ? "Sim" : "Não"} | ` +
        `Multi Setor: ${perfil.multi_setor ? "Sim" : "Não"}` +
        (modoOffline ? " | Sessão offline" : "");

    const avisoOffline =
        document.getElementById("avisoModoOffline");

    if (modoOffline) {
        avisoOffline.classList.remove("hidden");
        avisoOffline.innerHTML =
            '<span class="erro">Sessão offline: algumas informações podem estar desatualizadas.</span>';
    } else {
        avisoOffline.classList.add("hidden");
        avisoOffline.innerHTML = "";
    }

    document.getElementById("setor").value =
        perfil.setor || "";

    document
        .getElementById("btnModuloManutencao")
        ?.classList.remove("hidden");

    if (perfil.admin) {
        document
            .getElementById("btnModuloAdmin")
            ?.classList.remove("hidden");

        if (!modoOffline) {
            carregarSetoresAdmin();
        }
    } else {
        document
            .getElementById("btnModuloAdmin")
            ?.classList.add("hidden");
    }

    configurarNovaParadaPorPerfil();

    if (!modoOffline) {
        carregarAbertas();
        carregarHistorico();
        carregarDashboard();
    } else {
        atualizarPainelPendenciasAbertas();
    }

    atualizarStatusConexao();
    pedirPermissaoNotificacaoWeb();

    if (!modoOffline) {
        sincronizarFilaOffline();
    }
}

async function logout() {
    if (estaOnline() && !modoOffline) {
        try {
            await client.auth.signOut();
        } catch {
            // Continua o logout local mesmo se o servidor não responder.
        }
    }

    await limparSessaoLocal();

    usuario = null;
    perfil = null;
    modoOffline = false;

    document.getElementById("appTela").classList.add("hidden");
    document.getElementById("loginTela").classList.remove("hidden");
    document.getElementById("loginMsg").innerHTML = "";

    document
        .getElementById("btnModuloAdmin")
        ?.classList.add("hidden");

    const avisoOffline =
        document.getElementById("avisoModoOffline");

    avisoOffline?.classList.add("hidden");

    if (avisoOffline) {
        avisoOffline.innerHTML = "";
    }

    atualizarAvisoLoginConexao();
}