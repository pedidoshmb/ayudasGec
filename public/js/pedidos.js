<script>
    // Espera a que el DOM esté completamente cargado
    document.addEventListener("DOMContentLoaded", function() {
        // Obtén el botón y el formulario
        const toggleFormBtn = document.getElementById('toggleFormBtn');
        const pedidoForm = document.getElementById('pedidoForm');

        // Verifica que el botón y el formulario existen
        if (toggleFormBtn && pedidoForm) {
            // Añade un listener al botón para alternar la visibilidad del formulario
            toggleFormBtn.addEventListener('click', function() {
                // Alterna la clase 'd-none' para mostrar u ocultar el formulario
                pedidoForm.classList.toggle('d-none');
            });
        }
    });
</script>
