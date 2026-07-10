async function solicitarManutencao() {
    const tipo = document.getElementById("manTipo").value;
    const maquinaId = document.getElementById("manMaquina").value;
    const estadoEquipamento = document.getElementById("manEstado").value;
    const problema = document.getElementById("manProblema").value.trim();
    const gravidade = document.getElementById("manGravidade").value;
    const impacto = document.getElementById("manImpacto").value.trim();
    const msg = document.getElementById("manutencaoMsg");

    msg.innerHTML = "";

    if (
        !tipo ||
        !maquinaId ||
        !estadoEquipamento ||
        !problema ||
        !gravidade
    ) {
        msg.innerHTML =
            '<div class="erro">Preencha todos os campos obrigatórios.</div>';
        return;
    }

    if (!estaOnline() || modoOffline) {
        msg.innerHTML =
            '<div class="erro">O funcionamento offline da manutenção será adicionado na próxima etapa.</div>';
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
            `${SUPABASE_URL}/functions/v1/solicitar-manutencao`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    apikey: SUPABASE_KEY
                },
                body: JSON.stringify({
                    tipo,
                    maquina_id: maquinaId,
                    estado_equipamento: estadoEquipamento,
                    problema,
                    gravidade,
                    impacto: impacto || null,
                    offline_id: gerarUUID()
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
                `<div class="erro">${resultado.error || texto || "Erro ao solicitar manutenção."}</div>`;
            return;
        }

        msg.innerHTML =
            `<div class="ok">${resultado.message || "Solicitação criada com sucesso."}</div>`;

        limparFormularioManutencao();

    } catch (erro) {
        msg.innerHTML =
            `<div class="erro">Erro de conexão: ${erro.message}</div>`;
    }
}

function limparFormularioManutencao() {
    document.getElementById("manTipo").value = "";
    document.getElementById("manMaquina").value = "";
    document.getElementById("manEstado").value = "";
    document.getElementById("manProblema").value = "";
    document.getElementById("manGravidade").value = "";
    document.getElementById("manImpacto").value = "";
}
function mostrarManutencaoAba(id) {

    [
        "abaNovaManutencao",
        "abaSolicitacoesManutencao",
        "abaPainelManutencao"
    ].forEach(aba => {

        document
            .getElementById(aba)
            ?.classList.add("hidden");

    });

    document
        .getElementById(id)
        ?.classList.remove("hidden");

}
async function carregarSolicitacoesManutencao(){

    const lista =
        document.getElementById("listaSolicitacoesManutencao");

    lista.innerHTML =
        "<p>Carregando...</p>";

}
async function carregarPainelManutencao(){

    const lista =
        document.getElementById("listaPainelManutencao");

    lista.innerHTML =
        "<p>Carregando...</p>";

}
async function carregarDadosManutencao() {
    await carregarSetores();
    await carregarMaquinasBase();

    preencherSetoresManutencao();
    preencherMaquinasManutencao([]);
}

function preencherSetoresManutencao() {
    const select = document.getElementById("manSetor");

    if (!select) {
        return;
    }

    select.innerHTML =
        '<option value="">Selecione o setor</option>';

    setoresCache.forEach(setor => {
        select.innerHTML += `
            <option value="${setor.nome}">
                ${setor.nome}
            </option>
        `;
    });

    if (!perfil.admin && !perfil.multi_setor) {
        select.value = perfil.setor || "";
        select.disabled = true;

        filtrarMaquinasManutencao();
    } else {
        select.disabled = false;
    }
}

function preencherMaquinasManutencao(maquinas) {
    const select = document.getElementById("manMaquina");

    if (!select) {
        return;
    }

    select.innerHTML =
        '<option value="">Selecione a máquina</option>';

    maquinas.forEach(maquina => {
        select.innerHTML += `
            <option value="${maquina.id}">
                ${maquina.nome}
            </option>
        `;
    });
}

function filtrarMaquinasManutencao() {
    const setor =
        document.getElementById("manSetor").value;

    if (!setor) {
        preencherMaquinasManutencao([]);
        return;
    }

    const maquinasFiltradas = maquinasCache.filter(
        maquina => maquina.setor === setor
    );

    preencherMaquinasManutencao(maquinasFiltradas);
}
