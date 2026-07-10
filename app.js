function mostrarTela(id) {

    const telas = [
        "homeTela",
        "menuParadasTela",
        "novaParadaTela",
        "abertasTela",
        "historicoTela",
        "dashboardTela",
        "manutencaoTela",
        "adminTela"
    ];

    telas.forEach(t => {
        document.getElementById(t)?.classList.add("hidden");
    });

    document.getElementById(id)?.classList.remove("hidden");

}

function abrirModuloParadas() {

    mostrarTela("menuParadasTela");

}

async function abrirModuloManutencao() {
    mostrarTela("manutencaoTela");
    mostrarManutencaoAba("abaNovaManutencao");

    await carregarDadosManutencao();
}

function abrirModuloAdmin() {

    mostrarTela("adminTela");

    if (!modoOffline) {
        carregarUsuariosAdmin();
        carregarSetoresAdmin();
    }

}

function voltarHome() {

    mostrarTela("homeTela");

}

function voltarMenuParadas() {

    mostrarTela("menuParadasTela");

}

function mostrarAdminAba(id) {

    [
        "abaCriarUsuario",
        "abaUsuarios",
        "abaCadastros"
    ].forEach(aba => {

        document
            .getElementById(aba)
            ?.classList.add("hidden");

    });

    document
        .getElementById(id)
        ?.classList.remove("hidden");

}
