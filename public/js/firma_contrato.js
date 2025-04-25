document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("signature-pad");
    const clearButton = document.getElementById("clear-signature");
    const saveButton = document.getElementById("guardar");
    const signaturePad = new SignaturePad(canvas);

    // Borrar la firma
    clearButton.addEventListener("click", () => {
        signaturePad.clear();
    });

    // Guardar la firma y enviarla al backend
    saveButton.addEventListener("click", () => {
        if (signaturePad.isEmpty()) {
            alert("Por favor firme el contrato antes de guardar.");
            return;
        }

        const firmaBase64 = signaturePad.toDataURL();
        console.log("Firma en base64:", firmaBase64);
    });
});