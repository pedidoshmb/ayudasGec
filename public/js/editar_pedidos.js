document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".editar-pedido").forEach(button => {
        button.addEventListener("click", function () {
            let numero_pedido = this.getAttribute("data-id"); // Obtener el número de pedido

            // Hacer la petición al servidor para obtener los datos del pedido
            fetch(`/editar-pedido/${numero_pedido}`)
                .then(response => response.json()) // Convertir la respuesta a JSON
                .then(data => {
                    if (!data || Object.keys(data).length === 0) {
                        console.error("No se encontraron datos para este pedido.");
                        return;
                    }

                    // Asignar solo los datos a los campos editables
                    document.querySelector("#editar_pedido_id").value = data.numero_pedido; // Solo mostrar, no editable
                    document.querySelector("#editar_fecha_registro").value = data.fecha_registro; // Solo mostrar, no editable

                    // Aquí asignamos solo los campos editables
                    document.querySelector("#editar_razon_social").value = data.razon_social || "";
                    document.querySelector("#editar_fecha_despacho").value = data.fecha_despacho || "";
                    document.querySelector("#editar_estado").value = data.estado || "";
                    document.querySelector("#editar_prioridad").value = data.prioridad || "";
                    document.querySelector("#editar_observacion").value = data.observacion || "";

                    // Asegurarse de que el formulario de edición se muestre
                    document.querySelector("#formularioEditarPedido").style.display = "block";
                })
                .catch(error => console.error("Error al obtener los datos del pedido:", error));
        });
    });
});
