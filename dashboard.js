async function carregarDashboard() {
    const inicio = document.getElementById("filtroInicioDash").value;
    const fim = document.getElementById("filtroFimDash").value;
    const resumo = document.getElementById("resumoBoxes");
    const tabela = document.getElementById("tabelaMaquinas");

    let query = client
        .from("paradas")
        .select("*")
        .gte("data_parada", inicio)
        .lte("data_parada", fim);

    if (!perfil.admin && !perfil.multi_setor) {
        query = query.eq("setor", perfil.setor);
    }

    const { data, error } = await query;

    if (error) {
        resumo.innerHTML = `<div class="erro">${error.message}</div>`;
        tabela.innerHTML = "";
        return;
    }

    const registros = data || [];

    const totalParadas = registros.length;
    const abertas = registros.filter(
        item => item.status === "ABERTA"
    ).length;

    const finalizadas = registros.filter(
        item => item.status === "FINALIZADA"
    ).length;

    const totalMinutos = registros.reduce(
        (soma, item) => soma + Number(item.duracao_min || 0),
        0
    );

    resumo.innerHTML = `
        <div class="item">
            <b>Total de paradas</b>
            <h2>${totalParadas}</h2>
        </div>

        <div class="item">
            <b>Em aberto</b>
            <h2>${abertas}</h2>
        </div>

        <div class="item">
            <b>Finalizadas</b>
            <h2>${finalizadas}</h2>
        </div>

        <div class="item">
            <b>Horas acumuladas</b>
            <h2>${minutosParaHora(totalMinutos)}</h2>
        </div>
    `;

    const resumoMaquinas = {};

    registros.forEach(item => {
        const nome = item.maquina_nome || "Máquina não informada";

        if (!resumoMaquinas[nome]) {
            resumoMaquinas[nome] = {
                quantidade: 0,
                minutos: 0
            };
        }

        resumoMaquinas[nome].quantidade += 1;
        resumoMaquinas[nome].minutos += Number(
            item.duracao_min || 0
        );
    });

    const linhas = Object.entries(resumoMaquinas)
        .sort((a, b) => b[1].minutos - a[1].minutos)
        .map(([maquina, valores]) => `
            <tr>
                <td>${maquina}</td>
                <td>${valores.quantidade}</td>
                <td>${minutosParaHora(valores.minutos)}</td>
            </tr>
        `)
        .join("");

    tabela.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Máquina</th>
                    <th>Quantidade de paradas</th>
                    <th>Tempo acumulado</th>
                </tr>
            </thead>

            <tbody>
                ${linhas || `
                    <tr>
                        <td colspan="3">Sem dados no período.</td>
                    </tr>
                `}
            </tbody>
        </table>
    `;
}