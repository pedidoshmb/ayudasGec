document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".editar-tercero").forEach(button => {
        button.addEventListener("click", function () {
            let doc_id = this.getAttribute("data-id");
            console.log("Botón Editar presionado, ID:", doc_id);

            // Hacer la petición al servidor
            fetch(`/terceros/${doc_id}`)
                .then(response => response.json()) // Convertir la respuesta a JSON directamente
                .then(data => {
                    console.log("Datos recibidos del servidor:", data);

                    if (!data || Object.keys(data).length === 0) {
                        console.error("No se encontraron datos para este tercero.");
                        return;
                    }

                    // Verificar si los elementos existen antes de asignarles valores
                    const campos = [
                        "editar_tipo_id_tercero",
                        "editar_razon_social",
                        "editar_doc_id",
                        "editar_direccion",
                        "editar_telefono",
                        "editar_celular",
                        "editar_email",
                        "editar_ciudad",
                        "editar_contacto",
                    ];

                    campos.forEach(id => {
                        let elemento = document.querySelector(`#${id}`);
                        if (elemento) {
                            elemento.value = data[id.replace("editar_", "")] || "";
                        } else {
                            console.warn(`Elemento con ID '${id}' no encontrado en el formulario.`);
                        }
                    });

                    // Asegurar que el formulario de edición se muestre
                    document.querySelector("#formularioEditar").style.display = "block";
                })
                .catch(error => console.error("Error al obtener los datos:", error));
        });
    });
});
