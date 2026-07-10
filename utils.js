function hojeISO() {
    const hoje = new Date();
    return hoje.toISOString().slice(0, 10);
}

function primeiroDiaMes() {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
}

function calcularDuracaoMin(horaInicio, horaFim) {

    const [hi, mi] = horaInicio.split(":").map(Number);
    const [hf, mf] = horaFim.split(":").map(Number);

    let inicio = hi * 60 + mi;
    let fim = hf * 60 + mf;

    let total = fim - inicio;

    if (total < 0) {
        total += 1440;
    }

    return total;

}

function minutosParaHora(min) {

    const total = Number(min || 0);

    const horas = Math.floor(total / 60);
    const minutos = total % 60;

    return (
        String(horas).padStart(2, "0") +
        ":" +
        String(minutos).padStart(2, "0")
    );

}

function gerarUUID() {

    if (crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {

        const r = Math.random() * 16 | 0;
        const v = c === "x"
            ? r
            : (r & 0x3 | 0x8);

        return v.toString(16);

    });

}