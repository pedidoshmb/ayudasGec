document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".menu-title").forEach(title => {
        title.addEventListener("click", function (event) {
            event.preventDefault(); // Evita el salto de página si el enlace tiene "#"
            
            console.log("Clic en:", this.textContent);

            const submenu = this.nextElementSibling;

            // Cierra otros submenús abiertos
            document.querySelectorAll(".submenu").forEach(menu => {
                if (menu !== submenu) {
                    menu.classList.remove("show");
                }
            });

            // Alterna el submenú actual
            if (submenu && submenu.classList.contains("submenu")) {
                submenu.classList.toggle("show");
            }
        });
    });

    // Asegurar que los enlaces funcionan correctamente
    document.querySelectorAll(".submenu a").forEach(link => {
        link.addEventListener("click", function () {
            console.log("Navegando a:", this.href);

            // Cierra el submenú después de hacer clic en un enlace
            setTimeout(() => {
                document.querySelectorAll(".submenu").forEach(menu => menu.classList.remove("show"));
            }, 200);
        });
    });
});
