async function carregarMaquinas() {
    await carregarMaquinasBase();

    if (!perfil.admin && !perfil.multi_setor) {
        const filtradas = maquinasCache.filter(
            maquina => maquina.setor === perfil.setor
        );

        preencherMaquinas(filtradas);
        return;
    }

    preencherMaquinas([]);
}

async function abrirParada() {
    const select = document.getElementById("maquinaSelect");
    const opcao = select.options[select.selectedIndex];

    const maquinaId = select.value;
    const maquinaNome = opcao?.dataset?.nome || "";
    const setorSelecionado =
        document.getElementById("setorSelect").value ||
        opcao?.dataset?.setor ||
        perfil.setor;

    const dataParada =
        document.getElementById("dataParada").value;

    const motivo =
        document.getElementById("motivo").value.trim();

    const horaInicio =
        document.getElementById("horaInicio").value;

    const msg =
        document.getElementById("novaParadaMsg");

    msg.innerHTML = "";

    if (
        !maquinaId ||
        !dataParada ||
        !motivo ||
        !horaInicio ||
        !setorSelecionado
    ) {
        msg.innerHTML =
            '<div class="erro">Preencha todos os campos.</div>';
        return;
    }

    const payload = {
        maquina_id: maquinaId,
        maquina_nome: maquinaNome,
        setor: setorSelecionado,
        data_parada: dataParada,
        motivo,
        hora_inicio: horaInicio,
        usuario_id: usuario.id,
        usuario_nome: perfil.nome,
        status: "ABERTA",
        offline_id: gerarUUID()
    };

    if (!estaOnline() || modoOffline) {
        await adicionarFilaCriacao(payload);

        msg.innerHTML =
            '<div class="ok">Parada salva no aparelho e será sincronizada quando a conexão voltar.</div>';

        notificarNovaParada(
            "Nova parada registrada",
            `${maquinaNome} - ${setorSelecionado} (offline)`
        );

        limparFormularioNovaParada();
        atualizarInfoFilaOffline();
        return;
    }

    try {
        const { error } = await client
            .from("paradas")
            .insert([payload]);

        if (error) {
            await adicionarFilaCriacao(payload);

            msg.innerHTML =
                '<div class="erro">Falha ao gravar online. A parada foi salva para sincronização.</div>';

            atualizarInfoFilaOffline();
            return;
        }

        msg.innerHTML =
            '<div class="ok">Parada aberta com sucesso.</div>';

        notificarNovaParada(
            "Nova parada registrada",
            `${maquinaNome} - ${setorSelecionado}`
        );

        limparFormularioNovaParada();

        await carregarAbertas();
        await carregarHistorico();
        await carregarDashboard();

    } catch (erro) {
        await adicionarFilaCriacao(payload);

        msg.innerHTML =
            '<div class="erro">Falha de conexão. A parada foi salva para sincronização.</div>';

        atualizarInfoFilaOffline();
    }
}

async function carregarAbertas() {
    const lista =
        document.getElementById("listaAbertas");

    let query = client
        .from("paradas")
        .select("*")
        .eq("status", "ABERTA")
        .order("data_lancamento", {
            ascending: false
        });

    if (!perfil.admin && !perfil.multi_setor) {
        query = query.eq("setor", perfil.setor);
    }

    const { data, error } = await query;

    await atualizarPainelPendenciasAbertas();

    if (error) {
        lista.innerHTML =
            `<div class="erro">${error.message}</div>`;
        return;
    }

    if (!data?.length) {
        lista.innerHTML =
            "<p>Nenhuma parada em aberto.</p>";
        return;
    }

    lista.innerHTML = data.map(item => `
        <div class="item">
            <b>Máquina:</b> ${item.maquina_nome || "-"}<br>
            <b>Setor:</b> ${item.setor || "-"}<br>
            <b>Data:</b> ${item.data_parada || "-"}<br>
            <b>Hora inicial:</b> ${item.hora_inicio || "-"}<br>
            <b>Motivo:</b> ${item.motivo || "-"}<br>
            <b>Usuário:</b> ${item.usuario_nome || "-"}<br><br>

            <input
                type="time"
                id="fim_${item.id}">

            <textarea
                id="obs_${item.id}"
                rows="3"
                placeholder="Observação da resolução"></textarea>

            <button onclick="finalizarParada('${item.id}', '${item.hora_inicio}')">
                Finalizar parada
            </button>

            ${
                perfil.admin
                    ? `
                        <button
                            class="btn-danger"
                            onclick="excluirParadaAdmin('${item.id}')">
                            Excluir parada
                        </button>
                      `
                    : ""
            }
        </div>
    `).join("");
}

async function carregarHistorico() {
    const lista =
        document.getElementById("listaHistorico");

    const inicio =
        document.getElementById("filtroInicioHistorico").value;

    const fim =
        document.getElementById("filtroFimHistorico").value;

    let query = client
        .from("paradas")
        .select("*")
        .gte("data_parada", inicio)
        .lte("data_parada", fim)
        .order("data_lancamento", {
            ascending: false
        });

    if (!perfil.admin && !perfil.multi_setor) {
        query = query.eq("setor", perfil.setor);
    }

    const { data, error } = await query;

    if (error) {
        lista.innerHTML =
            `<div class="erro">${error.message}</div>`;
        return;
    }

    if (!data?.length) {
        lista.innerHTML =
            "<p>Sem histórico no período.</p>";
        return;
    }

    lista.innerHTML = data.map(item => {
        const classe =
            item.status === "ABERTA"
                ? "aberta"
                : "finalizada";

        return `
            <div class="item">
                <span class="badge ${classe}">
                    ${item.status}
                </span>
                <br><br>

                <b>Máquina:</b> ${item.maquina_nome || "-"}<br>
                <b>Setor:</b> ${item.setor || "-"}<br>
                <b>Data:</b> ${item.data_parada || "-"}<br>
                <b>Motivo:</b> ${item.motivo || "-"}<br>
                <b>Início:</b> ${item.hora_inicio || "-"}<br>
                <b>Fim:</b> ${item.hora_fim || "-"}<br>
                <b>Duração:</b> ${minutosParaHora(item.duracao_min || 0)}<br>
                <b>Observação:</b> ${item.observacao || "-"}<br>
                <b>Usuário:</b> ${item.usuario_nome || "-"}

                ${
                    perfil.admin
                        ? `
                            <br><br>
                            <button
                                class="btn-danger"
                                onclick="excluirParadaAdmin('${item.id}')">
                                Excluir parada
                            </button>
                          `
                        : ""
                }
            </div>
        `;
    }).join("");
}

async function finalizarParada(id, horaInicio) {
    const horaFim =
        document.getElementById(`fim_${id}`).value;

    const observacao =
        document.getElementById(`obs_${id}`).value.trim();

    if (!horaFim) {
        alert("Informe a hora final.");
        return;
    }

    const dadosFinalizacao = {
        hora_fim: horaFim,
        observacao,
        status: "FINALIZADA",
        duracao_min: calcularDuracaoMin(
            horaInicio,
            horaFim
        )
    };

    if (!estaOnline() || modoOffline) {
        await adicionarFilaFinalizacao({
            parada_id: id,
            offline_id: gerarUUID(),
            ...dadosFinalizacao
        });

        alert(
            "Finalização salva no aparelho e será sincronizada quando a conexão voltar."
        );

        atualizarInfoFilaOffline();
        await atualizarPainelPendenciasAbertas();
        return;
    }

    try {
        const { error } = await client
            .from("paradas")
            .update(dadosFinalizacao)
            .eq("id", id);

        if (error) {
            await adicionarFilaFinalizacao({
                parada_id: id,
                offline_id: gerarUUID(),
                ...dadosFinalizacao
            });

            alert(
                "Falha ao gravar online. A finalização foi salva para sincronização."
            );

            atualizarInfoFilaOffline();
            await atualizarPainelPendenciasAbertas();
            return;
        }

        alert("Parada finalizada com sucesso.");

        await carregarAbertas();
        await carregarHistorico();
        await carregarDashboard();

    } catch (erro) {
        await adicionarFilaFinalizacao({
            parada_id: id,
            offline_id: gerarUUID(),
            ...dadosFinalizacao
        });

        alert(
            "Falha de conexão. A finalização foi salva para sincronização."
        );

        atualizarInfoFilaOffline();
        await atualizarPainelPendenciasAbertas();
    }
}

async function excluirParadaAdmin(paradaId) {
    const confirmar = confirm(
        "Deseja realmente excluir esta parada?"
    );

    if (!confirmar) {
        return;
    }

    try {
        const { data: sessao, error: erroSessao } =
            await client.auth.getSession();

        const token =
            sessao?.session?.access_token;

        if (erroSessao || !token) {
            alert("Sessão inválida. Faça login novamente.");
            return;
        }

        const resposta = await fetch(
            `${SUPABASE_URL}/functions/v1/excluir-parada`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    apikey: SUPABASE_KEY
                },
                body: JSON.stringify({
                    parada_id: paradaId
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
            alert(
                resultado.error ||
                texto ||
                "Erro ao excluir parada."
            );
            return;
        }

        alert(
            resultado.message ||
            "Parada excluída com sucesso."
        );

        await carregarAbertas();
        await carregarHistorico();
        await carregarDashboard();

    } catch (erro) {
        alert(`Erro de conexão: ${erro.message}`);
    }
}

function limparFormularioNovaParada() {
    document.getElementById("maquinaSelect").value = "";
    document.getElementById("motivo").value = "";
    document.getElementById("horaInicio").value = "";
}

function preencherSetores(setores) {
    const select =
        document.getElementById("setorSelect");

    const input =
        document.getElementById("setor");

    select.innerHTML =
        '<option value="">Selecione o setor</option>';

    setores.forEach(setorAtual => {
        select.innerHTML += `
            <option value="${setorAtual.nome}">
                ${setorAtual.nome}
            </option>
        `;
    });

    input.value = "";
}

function preencherMaquinas(maquinas) {
    const select =
        document.getElementById("maquinaSelect");

    select.innerHTML =
        '<option value="">Selecione a máquina</option>';

    maquinas.forEach(maquina => {
        select.innerHTML += `
            <option
                value="${maquina.id}"
                data-nome="${maquina.nome}"
                data-setor="${maquina.setor}">
                ${maquina.nome}
            </option>
        `;
    });

    const selectManutencao =
        document.getElementById("manMaquina");

    if (selectManutencao) {
        selectManutencao.innerHTML =
            '<option value="">Selecione a máquina</option>';

        maquinas.forEach(maquina => {
            selectManutencao.innerHTML += `
                <option value="${maquina.id}">
                    ${maquina.nome}
                </option>
            `;
        });
    }
}

async function carregarSetores() {
    if (!estaOnline() || modoOffline) {
        setoresCache =
            await buscarCacheConfig("setores") || [];

        return setoresCache;
    }

    const { data, error } = await client
        .from("setores")
        .select("*")
        .eq("ativo", true)
        .order("nome", {
            ascending: true
        });

    if (error) {
        setoresCache =
            await buscarCacheConfig("setores") || [];

        return setoresCache;
    }

    setoresCache = data || [];

    await salvarCacheConfig(
        "setores",
        setoresCache
    );

    return setoresCache;
}

async function carregarMaquinasBase() {
    if (!estaOnline() || modoOffline) {
        maquinasCache =
            await buscarCacheConfig("maquinas") || [];

        return maquinasCache;
    }

    const { data, error } = await client
        .from("maquinas")
        .select("id, nome, setor, ativa, codigo, sala")
        .eq("ativa", true)
        .order("nome", {
            ascending: true
        });

    if (error) {
        maquinasCache =
            await buscarCacheConfig("maquinas") || [];

        return maquinasCache;
    }

    maquinasCache = data || [];

    await salvarCacheConfig(
        "maquinas",
        maquinasCache
    );

    return maquinasCache;
}

async function aoSelecionarSetor() {
    const setor =
        document.getElementById("setorSelect").value;

    document.getElementById("setor").value =
        setor || perfil.setor || "";

    const maquinas = maquinasCache.filter(
        maquina => maquina.setor === setor
    );

    preencherMaquinas(maquinas);
}

async function configurarNovaParadaPorPerfil() {
    const setores = await carregarSetores();
    await carregarMaquinasBase();

    const seletorSetor =
        document.getElementById("setorSelect");

    const inputSetor =
        document.getElementById("setor");

    if (perfil.admin || perfil.multi_setor) {
        preencherSetores(setores);
        seletorSetor.classList.remove("hidden");
        inputSetor.classList.add("hidden");

        preencherMaquinas([]);
        return;
    }

    seletorSetor.classList.add("hidden");
    inputSetor.classList.remove("hidden");
    inputSetor.value = perfil.setor || "";

    const maquinas = maquinasCache.filter(
        maquina => maquina.setor === perfil.setor
    );

    preencherMaquinas(maquinas);
}