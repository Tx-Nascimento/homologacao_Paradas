async function criarUsuario() {
    const nome = document.getElementById("novoNome").value.trim();
    const email = document.getElementById("novoEmail").value.trim();
    const password = document.getElementById("novoPassword").value.trim();
    const setor = document.getElementById("novoSetor").value.trim();
    const cargo = document.getElementById("novoCargo").value.trim();
    const admin = document.getElementById("novoAdmin").checked;
    const multiSetor = document.getElementById("novoMultiSetor").checked;
    const msg = document.getElementById("adminMsg");

    msg.innerHTML = "";

    if (!nome || !email || !password || !setor || !cargo) {
        msg.innerHTML =
            '<div class="erro">Preencha todos os campos.</div>';
        return;
    }

    try {
        const { data: sessao, error: erroSessao } =
            await client.auth.getSession();

        const token = sessao?.session?.access_token;

        if (erroSessao || !token) {
            msg.innerHTML =
                '<div class="erro">Sessão inválida. Saia e entre novamente.</div>';
            return;
        }

        const resposta = await fetch(
            `${SUPABASE_URL}/functions/v1/criar-usuarios`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    apikey: SUPABASE_KEY
                },
                body: JSON.stringify({
                    nome,
                    email,
                    password,
                    setor,
                    cargo,
                    admin,
                    multi_setor: multiSetor
                })
            }
        );

        const texto = await resposta.text();
        let resultado = {};

        try {
            resultado = JSON.parse(texto);
        } catch {
            resultado = {};
        }

        if (!resposta.ok) {
            msg.innerHTML =
                `<div class="erro">${resultado.error || texto || "Erro ao criar usuário."}</div>`;
            return;
        }

        msg.innerHTML =
            `<div class="ok">${resultado.message || "Usuário criado com sucesso."}</div>`;

        document.getElementById("novoNome").value = "";
        document.getElementById("novoEmail").value = "";
        document.getElementById("novoPassword").value = "";
        document.getElementById("novoSetor").value = "";
        document.getElementById("novoCargo").value = "Lider";
        document.getElementById("novoAdmin").checked = false;
        document.getElementById("novoMultiSetor").checked = false;

        await carregarUsuariosAdmin();

    } catch (erro) {
        msg.innerHTML =
            `<div class="erro">Erro de conexão: ${erro.message}</div>`;
    }
}

async function carregarUsuariosAdmin() {
    const lista = document.getElementById("usuariosAdminLista");

    if (!estaOnline() || modoOffline) {
        lista.innerHTML =
            '<div class="erro">Conecte-se à internet para gerenciar usuários.</div>';
        return;
    }

    const { data, error } = await client
        .from("perfis")
        .select("*")
        .order("nome", { ascending: true });

    if (error) {
        lista.innerHTML =
            `<div class="erro">${error.message}</div>`;
        return;
    }

    if (!data?.length) {
        lista.innerHTML =
            "<p>Nenhum usuário encontrado.</p>";
        return;
    }

    lista.innerHTML = data.map(usuarioAtual => `
        <div class="item">

            <div class="grid-3">
                <input
                    id="nome_${usuarioAtual.id}"
                    value="${usuarioAtual.nome || ""}"
                    placeholder="Nome">

                <input
                    id="email_${usuarioAtual.id}"
                    value="${usuarioAtual.email || ""}"
                    placeholder="E-mail">

                <input
                    id="cargo_${usuarioAtual.id}"
                    value="${usuarioAtual.cargo || ""}"
                    placeholder="Cargo">
            </div>

            <div class="grid-3">
                <input
                    id="setor_${usuarioAtual.id}"
                    value="${usuarioAtual.setor || ""}"
                    placeholder="Setor">

                <input
                    id="senha_${usuarioAtual.id}"
                    type="password"
                    placeholder="Nova senha">

                <input
                    value="${usuarioAtual.id}"
                    readonly>
            </div>

            <label class="inline-check">
                <input
                    type="checkbox"
                    id="ativo_${usuarioAtual.id}"
                    ${usuarioAtual.ativo ? "checked" : ""}>
                Ativo
            </label>

            <label class="inline-check">
                <input
                    type="checkbox"
                    id="admin_${usuarioAtual.id}"
                    ${usuarioAtual.admin ? "checked" : ""}>
                Administrador
            </label>

            <label class="inline-check">
                <input
                    type="checkbox"
                    id="multi_${usuarioAtual.id}"
                    ${usuarioAtual.multi_setor ? "checked" : ""}>
                Multi setor
            </label>

            <div class="small" style="margin-bottom:8px;">
                ${
                    usuarioAtual.revogado_offline_em
                        ? `<span class="erro">
                            Acesso offline revogado em
                            ${new Date(usuarioAtual.revogado_offline_em).toLocaleString("pt-BR")}
                           </span>`
                        : '<span class="ok">Acesso offline liberado</span>'
                }
            </div>

            <div class="grid-3">
                <button
                    class="btn-success"
                    onclick="salvarUsuarioAdmin('${usuarioAtual.id}')">
                    Salvar alterações
                </button>

                <button
                    class="btn-secondary"
                    onclick="resetarSenhaAdmin('${usuarioAtual.id}')">
                    Resetar senha
                </button>

                <button
                    class="btn-warning"
                    onclick="revogarAcessoOfflineAdmin('${usuarioAtual.id}')">
                    Revogar acesso offline
                </button>
            </div>

            <div id="msg_${usuarioAtual.id}"></div>

        </div>
    `).join("");
}

async function salvarUsuarioAdmin(userId) {
    const msg = document.getElementById(`msg_${userId}`);

    msg.innerHTML = "";

    try {
        const { data: sessao } = await client.auth.getSession();
        const token = sessao?.session?.access_token;

        if (!token) {
            msg.innerHTML =
                '<div class="erro">Sessão inválida.</div>';
            return;
        }

        const resposta = await fetch(
            `${SUPABASE_URL}/functions/v1/gerenciar-usuarios`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    apikey: SUPABASE_KEY
                },
                body: JSON.stringify({
                    acao: "editar",
                    user_id: userId,
                    nome: document.getElementById(`nome_${userId}`).value.trim(),
                    email: document.getElementById(`email_${userId}`).value.trim(),
                    setor: document.getElementById(`setor_${userId}`).value.trim(),
                    cargo: document.getElementById(`cargo_${userId}`).value.trim(),
                    ativo: document.getElementById(`ativo_${userId}`).checked,
                    admin: document.getElementById(`admin_${userId}`).checked,
                    multi_setor: document.getElementById(`multi_${userId}`).checked
                })
            }
        );

        const texto = await resposta.text();
        let resultado = {};

        try {
            resultado = JSON.parse(texto);
        } catch {
            resultado = {};
        }

        if (!resposta.ok) {
            msg.innerHTML =
                `<div class="erro">${resultado.error || texto}</div>`;
            return;
        }

        msg.innerHTML =
            `<div class="ok">${resultado.message || "Usuário atualizado."}</div>`;

    } catch (erro) {
        msg.innerHTML =
            `<div class="erro">${erro.message}</div>`;
    }
}

async function resetarSenhaAdmin(userId) {
    const msg = document.getElementById(`msg_${userId}`);
    const novaSenha =
        document.getElementById(`senha_${userId}`).value.trim();

    msg.innerHTML = "";

    if (!novaSenha) {
        msg.innerHTML =
            '<div class="erro">Informe a nova senha.</div>';
        return;
    }

    try {
        const { data: sessao } = await client.auth.getSession();
        const token = sessao?.session?.access_token;

        if (!token) {
            msg.innerHTML =
                '<div class="erro">Sessão inválida.</div>';
            return;
        }

        const resposta = await fetch(
            `${SUPABASE_URL}/functions/v1/gerenciar-usuarios`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    apikey: SUPABASE_KEY
                },
                body: JSON.stringify({
                    acao: "resetar_senha",
                    user_id: userId,
                    nova_senha: novaSenha
                })
            }
        );

        const texto = await resposta.text();
        let resultado = {};

        try {
            resultado = JSON.parse(texto);
        } catch {
            resultado = {};
        }

        if (!resposta.ok) {
            msg.innerHTML =
                `<div class="erro">${resultado.error || texto}</div>`;
            return;
        }

        msg.innerHTML =
            `<div class="ok">${resultado.message || "Senha redefinida."}</div>`;

        document.getElementById(`senha_${userId}`).value = "";

    } catch (erro) {
        msg.innerHTML =
            `<div class="erro">${erro.message}</div>`;
    }
}

async function revogarAcessoOfflineAdmin(userId) {
    const msg = document.getElementById(`msg_${userId}`);

    const confirmar = confirm(
        "Deseja revogar o acesso offline deste usuário?"
    );

    if (!confirmar) {
        return;
    }

    const { error } = await client
        .from("perfis")
        .update({
            revogado_offline_em: new Date().toISOString()
        })
        .eq("id", userId);

    if (error) {
        msg.innerHTML =
            `<div class="erro">${error.message}</div>`;
        return;
    }

    msg.innerHTML =
        '<div class="ok">Acesso offline revogado.</div>';

    await carregarUsuariosAdmin();
}

async function carregarSetoresAdmin() {
    const selectMaquina =
        document.getElementById("novaMaquinaSetor");

    const selectUsuario =
        document.getElementById("novoSetor");

    const { data, error } = await client
        .from("setores")
        .select("*")
        .eq("ativo", true)
        .order("nome", { ascending: true });

    if (error) {
        return;
    }

    const setores = data || [];

    if (selectMaquina) {
        selectMaquina.innerHTML =
            '<option value="">Selecione o setor</option>';

        setores.forEach(setorAtual => {
            selectMaquina.innerHTML += `
                <option value="${setorAtual.nome}">
                    ${setorAtual.nome}
                </option>
            `;
        });
    }

    if (selectUsuario) {
        selectUsuario.innerHTML =
            '<option value="">Selecione o setor</option>';

        setores.forEach(setorAtual => {
            selectUsuario.innerHTML += `
                <option value="${setorAtual.nome}">
                    ${setorAtual.nome}
                </option>
            `;
        });
    }
}

async function criarSetor() {
    const nome =
        document.getElementById("novoNomeSetor").value.trim();

    const msg =
        document.getElementById("setorMsg");

    msg.innerHTML = "";

    if (!nome) {
        msg.innerHTML =
            '<div class="erro">Informe o nome do setor.</div>';
        return;
    }

    const { error } = await client
        .from("setores")
        .insert([{
            nome,
            ativo: true
        }]);

    if (error) {
        msg.innerHTML =
            `<div class="erro">${error.message}</div>`;
        return;
    }

    msg.innerHTML =
        '<div class="ok">Setor criado com sucesso.</div>';

    document.getElementById("novoNomeSetor").value = "";

    await carregarSetoresAdmin();
}

async function criarMaquina() {
    const codigo =
        document.getElementById("novaMaquinaCodigo").value.trim();

    const nome =
        document.getElementById("novaMaquinaNome").value.trim();

    const setor =
        document.getElementById("novaMaquinaSetor").value;

    const msg =
        document.getElementById("maquinaMsg");

    msg.innerHTML = "";

    if (!nome || !setor) {
        msg.innerHTML =
            '<div class="erro">Preencha nome e setor.</div>';
        return;
    }

    const { error } = await client
        .from("maquinas")
        .insert([{
            codigo: codigo || null,
            nome,
            setor,
            ativa: true
        }]);

    if (error) {
        msg.innerHTML =
            `<div class="erro">${error.message}</div>`;
        return;
    }

    msg.innerHTML =
        '<div class="ok">Máquina criada com sucesso.</div>';

    document.getElementById("novaMaquinaCodigo").value = "";
    document.getElementById("novaMaquinaNome").value = "";
    document.getElementById("novaMaquinaSetor").value = "";

    await carregarMaquinas();
}