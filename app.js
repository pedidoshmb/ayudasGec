const express = require('express');
//const mysql = require('mysql2');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const puppeteer = require('puppeteer');
const pdf = require('pdf-creator-node');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const ensureLoggedIn = (req, res, next) => {
  if (req.session.loggedin) {
    return next();
  } else {
    res.redirect('/');
  }
};

const app = express();
const port = 3000;
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'pdf_app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
module.exports = pool; 

// Configuración de la sesión
app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }  // Expira después de 1 día
}));

// Middleware para el body parser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); 
//app.use("/", firmaContratoRoutes);
app.use(express.urlencoded({ extended: true })); // Para leer formularios HTML
app.use(express.json()); // Para leer JSON (si usas AJAX)
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de Multer para la subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => { 
    cb(null, path.join(__dirname, 'public', 'pdfs'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname); // Generar un nombre único
  }
});

const upload = multer({ storage: storage });

//PDF

app.post('/subir_pdf', ensureLoggedIn, upload.single('pdfFile'), async (req, res) => {
  if (!req.file) {
      return res.status(400).send('No se subió ningún archivo');
  }

  if (req.session.loggedin && req.session.rol === 'admin') {
      const { nombre_pdf, seccion, usuario_id } = req.body;
      console.log(usuario_id, nombre_pdf, seccion); 
      const ruta_pdf = `/pdfs/${req.file.filename}`;

      const query = 'INSERT INTO pdfs (usuario_id, nombre_pdf, ruta_pdf, seccion) VALUES (?, ?, ?, ?)';
      try {
        console.log('Guardando en la base de datos:', usuario_id, nombre_pdf, ruta_pdf, seccion);
          await pool.query(query, [usuario_id, nombre_pdf, ruta_pdf, seccion]);
          res.redirect('/dashboard');
      } catch (err) {
          console.error('Error al guardar el PDF:', err);
          res.status(500).send('Hubo un problema al guardar el archivo PDF');
      }
  } else {
      res.redirect('/');
  }
});



// Configuración de EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//Rutas
app.get('/', (req, res) => {
  if (!req.session.loggedin) { // ✅ Verifica si el usuario ha iniciado sesión
    return res.redirect('/login'); 
  }
  res.redirect('/index');
});
app.get('/index', (req, res) => {
  if (!req.session.loggedin) {
    return res.redirect('/login'); // Redirige al login si no está autenticado
  }

  res.render('index', {
    username: req.session.username,
    rol: req.session.rol
  });
});

  //res.render("login", { rol: req.session.usuario.rol });

app.post('/login', async (req, res) => { // <- Agrega async aquí
  const { username, password } = req.body;
  const query = 'SELECT * FROM usuarios WHERE username = ?'; 

  try {
    const [results] = await pool.query(query, [username]); // <- Ahora sí puedes usar await

    if (results.length > 0) {
      const user = results[0];
      if (bcrypt.compareSync(password, user.password)) {
        req.session.loggedin = true;
        req.session.username = username;
        req.session.userId = user.id;
        req.session.rol = user.rol;
        res.redirect('/index');
      } else {
        res.send('Contraseña incorrecta');
      }
    } else {
      res.send('Usuario no encontrado');
    }
  } catch (err) {
    console.error('Error en la consulta de login:', err);
    res.status(500).send('Error interno del servidor');
  }
});

app.get('/dashboard', async (req, res) => {
  console.log(req.session);
  if (req.session.loggedin && req.session.username) {
    const userId = req.session.userId;

    try {
      // 📌 Obtener datos del usuario
      const [userResults] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [userId]);
      if (userResults.length === 0) {
        return res.status(400).send('Usuario no encontrado');
      }
      const user = userResults[0];

      // 📌 Obtener PDFs del usuario
      const [pdfResults] = await pool.query('SELECT * FROM pdfs WHERE usuario_id = ?', [userId]);

      // 📌 Obtener empleados
      const [empleados] = await pool.query('SELECT * FROM empleados');

       // 📌 Obtener empleados Activos
      const [empleadosActivosResult] = await pool.query('SELECT COUNT(*) AS total_activos FROM empleados WHERE estado =1');
      const empleadosActivos = empleadosActivosResult[0].total_activos || 0;

      // 📌 Obtener Valor de la Nomina
      const [nominaResult] = await pool.query('SELECT SUM(salario) AS total_nomina FROM empleados WHERE estado =1');
      const totalNomina = nominaResult.length > 0 ? nominaResult[0].total_nomina || 0 : 0;

      // 📌 Organizar PDFs por secciones
      const pdfsPorSeccion = {
        nomina: pdfResults.filter(pdf => pdf.seccion === 'nomina'),
        hoja_de_vida: pdfResults.filter(pdf => pdf.seccion === 'hoja_de_vida'),
        cartas: pdfResults.filter(pdf => pdf.seccion === 'cartas')
      };
      
    // 📌 Enviar todos los datos a la vista
    res.render('layout', {
      view: 'dashboard',
      username: user.username, // ✅ Ahora sí se envía correctamente
      rol: user.rol,
      empleados: empleados || [], 
      pdfsPorSeccion,
      empleadosActivos,
      totalNomina,
      activePage: 'dashboard' // ✅ Para que el menú lo resalte correctamente
    });

    } catch (err) {
      console.error('Error en la consulta de dashboard:', err);
      res.status(500).send('Error interno del servidor');
    }
  } else {
    res.redirect('/');
  }
});

app.post('/upload', ensureLoggedIn, upload.single('pdfFile'), async (req, res) => { // <-- Asegúrate de que la función sea async
  if (!req.file) {
    return res.status(400).send('No se subió ningún archivo');
  }

  if (req.session.loggedin && req.session.rol === 'admin') {
    const { nombre_pdf, seccion } = req.body; // <-- "seccion" en lugar de "section"
    const usuario_id = req.session.userId;
    const ruta_pdf = `/pdfs/${req.file.filename}`;
    console.log(req.file);

    const query = 'INSERT INTO pdfs (usuario_id, nombre_pdf, ruta_pdf, seccion) VALUES (?, ?, ?, ?)';
    
    try {
      const [results] = await pool.query(query, [usuario_id, nombre_pdf, ruta_pdf, seccion]); 
      console.log('PDF guardado correctamente:', results);
      res.redirect('/dashboard'); // <-- La redirección debe estar dentro del try
    } catch (err) {
      console.error('Error al guardar el PDF:', err);
      res.status(500).send('Hubo un problema al guardar el archivo PDF');
    }
  } else {
    res.redirect('/');
  }
});

app.get('/logout', (req, res) => {
req.session.destroy((err) => {
  if (err) {
    console.error('Error al cerrar sesión:', err);
    return res.status(500).send('Error al cerrar sesión');
  } else {
    res.redirect('/?message=Sesión cerrada con éxito');
  }
});
});
app.get('/login', (req, res) => {
  res.render('login'); // Sin "auth/" porque está en views/
});

app.get('/users', (req, res) => {
if (req.session.loggedin && req.session.rol === 'admin') {
  const query = 'SELECT id, username FROM usuarios';
  db.query(query, (err, results) => {
    if (err) throw err;
    res.json(results); // Enviar la lista de usuarios como JSON
  });
} else {
  res.status(403).send('Acceso denegado');
}
});

// Ruta para crear usuario (solo admin)
app.get('/crear_usuario', ensureLoggedIn, (req, res) => {
if (req.session.rol === 'admin') {
  res.render('crear_usuario', {
    rol: req.session.rol,
    activePage: 'crear_usuario',
    username: req.session.username
  }); 
} else {
  res.status(403).send('Acceso denegado');
}
});
// Ruta para crear usuario / POS(solo admin)
app.post('/crear_usuario', async (req, res) => {
  try {
      const { username, password, rol, estado, nombre_completo } = req.body; // Asegúrate de que los datos coinciden con el formulario

      // Encriptar la contraseña antes de guardarla
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insertar en la base de datos
      const query = 'INSERT INTO usuarios (username, password, rol, estado, nombre_completo) VALUES (?, ?, ?, ?, ?)';
      await pool.query(query, [username, hashedPassword, rol, estado, nombre_completo]);

      res.redirect('/dashboard'); // Redirige a la lista de usuarios después de crear uno
  } catch (err) {
      console.error('Error al crear usuario:', err);
      res.status(500).send('Error al crear el usuario');
  }
});

// Ruta para subir PDF (solo admin)   
app.get('/subir_pdf', ensureLoggedIn, async (req, res) => {
  if (req.session.rol === 'admin') {
    try {
      const [usuarios] = await pool.query('SELECT id, username FROM usuarios'); 
      console.log('Usuarios obtenidos:', usuarios);
      res.render('subir_pdf', { 
        usuarios, 
        rol: req.session.rol, 
        activePage: 'subir_pdf',
        username: req.session.username // Si quieres mostrar el nombre de usuario en la vista
      });

    } catch (err) {
      console.error('Error al obtener usuarios:', err);
      res.status(500).send('Error al cargar la página');
    }
  } else {
    res.status(403).send('Acceso denegado');
  }
});

app.get('/generar_carta', async (req, res) => {
  if (!req.session.userId) {
      return res.status(401).send("No autorizado. Inicie sesión.");
  }

  try {
      // Obtener datos del empleado
      const [rows] = await pool.query(
          `SELECT nombre_apellidos, id_empleado, fecha_inicio, cargo, salario 
           FROM empleados 
           WHERE usuario_id = ?`, 
          [req.session.userId]
      );

      if (rows.length === 0) {
          return res.status(404).json({ error: "Empleado no encontrado" });
      }

      const empleado = rows[0];

      // Formatear fecha actual
      const hoy = new Date();
      const dia_actual = hoy.getDate();
      const mes_actual = hoy.toLocaleString('es-ES', { month: 'long' });
      const año_actual = hoy.getFullYear();
      const fecha_actual = `${dia_actual} de ${mes_actual} de ${año_actual}`;

      // Mostrar la carta en pantalla (carta.ejs)
      res.render('carta', { empleado, fecha_actual });

  } catch (error) {
      console.error("Error generando la carta:", error);
      res.status(500).json({ error: "Error en el servidor" });
  }
});

// 📌 Nueva ruta para descargar el PDF
app.get('/descargar_carta', async (req, res) => {
  if (!req.session.userId) {
      return res.status(401).send("No autorizado. Inicie sesión.");
  }

  try {
      // Obtener datos del empleado
      const [rows] = await pool.query(
          `SELECT nombre_apellidos, id_empleado, fecha_inicio, cargo, salario 
           FROM empleados 
           WHERE usuario_id = ?`, 
          [req.session.userId]
      );

      if (rows.length === 0) {
          return res.status(404).json({ error: "Empleado no encontrado" });
      }

      const convertImageToBase64 = async (filePath) => {
        return Buffer.from(fs.readFileSync(filePath)).toString('base64');
      };

      const logoBase64 = await convertImageToBase64(path.join(__dirname, '../pdf-app-backend/public/img/logo_gec.png'));
      const firmaBase64 = await convertImageToBase64(path.join(__dirname, '../pdf-app-backend/public/img/firmagh.png'));

      const empleado = rows[0];

      // Formatear fecha actual
      const hoy = new Date();
      const dia_actual = hoy.getDate();
      const mes_actual = hoy.toLocaleString('es-ES', { month: 'long' });
      const año_actual = hoy.getFullYear();
      const fecha_actual = `${dia_actual} de ${mes_actual} de ${año_actual}`;
      
     
      

      // Leer y renderizar la plantilla EJS
      const templatePath = path.join(__dirname, 'views', 'carta.ejs');
      const template = fs.readFileSync(templatePath, 'utf-8');
      const html = ejs.render(template, { empleado, fecha_actual,  
        logoSrc: `data:image/png;base64,${logoBase64}`, 
        firmaSrc: `data:image/png;base64,${firmaBase64}`, 
      });

      // Generar PDF con Puppeteer
      const browser = await puppeteer.launch();
      const page = await browser.newPage();

      // Establecer el contenido HTML
      await page.setContent(html, { waitUntil: 'load' });

      // Generar el PDF
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });

      await browser.close();

      // Enviar el PDF como respuesta
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=carta_laboral.pdf');
      res.end(pdfBuffer);

  } catch (error) {
      console.error("Error generando el PDF:", error);
      res.status(500).json({ error: "Error en el servidor al generar el PDF" });
  }
});





// Ruta para descargar el PDF
app.get('/descargar_carta', async (req, res) => {
  if (!req.session.userId) {
      return res.status(401).send("No autorizado. Inicie sesión.");
  }

  try {
  

      const [rows] = await pool.query(
          `SELECT nombre_apellidos, id_empleado, fecha_inicio, cargo, salario 
           FROM empleados 
           WHERE usuario_id = ?`, 
          [req.session.userId]
      );

      if (rows.length === 0) {
          return res.status(404).json({ error: "Empleado no encontrado" });
      }

      const empleado = rows[0];

      // Formatear fecha actual
      const hoy = new Date();
      const dia_actual = hoy.getDate();
      const mes_actual = hoy.toLocaleString('es-ES', { month: 'long' });
      const año_actual = hoy.getFullYear();
      const fecha_actual = `${dia_actual} de ${mes_actual} de ${año_actual}`;

      // Leer y renderizar la plantilla EJS
      const templatePath = path.join(__dirname, 'views', 'carta.ejs');
      const template = fs.readFileSync(templatePath, 'utf-8');
      const html = ejs.render(template, { empleado, fecha_actual });

      // Generar PDF con Puppeteer
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({ format: 'A4' });

      await browser.close();

      // Enviar el PDF como respuesta
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=carta_laboral.pdf');
      res.send(pdfBuffer);

  } catch (error) {
      console.error("Error generando la carta:", error);
      res.status(500).json({ error: "Error en el servidor" });
  }
});


// LISTAR EMPLEADOS
app.get('/listar_empleados', async (req, res) => {
  if (req.session.loggedin && req.session.rol === 'admin') {
    try {
      const [empleados] = await pool.query('SELECT * FROM empleados');
      const [nominaResult] = await pool.query('SELECT SUM(salario) AS total_nomina FROM empleados WHERE estado = 1');
      const totalNomina = nominaResult.length > 0 ? nominaResult[0].total_nomina || 0 : 0;
      const [empleadosActivosResult] = await pool.query('SELECT COUNT(*) AS total_activos FROM empleados WHERE estado =1');
      const empleadosActivos = empleadosActivosResult[0].total_activos || 0;

      // Pasamos 'rol' y 'username' correctamente dentro del objeto de renderizado
      res.render('listar_empleados', { 
        empleados, 
        totalNomina,
        empleadosActivos,
        activePage: 'listar_empleados',
        rol: req.session.rol, 
        username: req.session.username // Asegúrate de que 'username' esté en la sesión
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Error al obtener los empleados');
    }
  } else {
    res.redirect('/login'); // O alguna otra ruta si no está logueado o no es admin
  }
});

// Ruta para generar y descargar el PDF
app.get('/descargar_carta', async (req, res) => {
  console.log('Solicitud recibida en /descargar_carta');

  let browser;
  try {
    // Iniciar el navegador
    browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Cargar la carta laboral desde la URL de Express
    await page.goto('http://localhost:3000/carta', { waitUntil: 'networkidle0' });

    // Tomar captura para depuración
    await page.screenshot({ path: 'debug_screenshot.png' });

    // Generar el PDF
    const pdfBuffer = await page.pdf({ format: 'A4' });

    await browser.close();

    // Verificar si el PDF tiene contenido
    console.log('Tamaño del PDF generado:', pdfBuffer.length);

    // Enviar el PDF al cliente
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=carta_laboral.pdf');
    res.send(pdfBuffer);
} catch (error) {
    console.error('Error al generar el PDF:', error);
    res.status(500).send('Error al generar el PDF');
}
});

// Crear Empleado
app.get('/crear_empleado', ensureLoggedIn, async (req, res) => {
  if (req.session.rol === 'admin') {
    try {
      // Obtener usuarios de la base de datos usando promesas
      const [usuarios] = await pool.query('SELECT * FROM usuarios');
      
      // Pasar los datos de usuarios, el rol y el username a la vista
      res.render('crear_empleado', { 
        usuarios: usuarios, 
        rol: req.session.rol,
        activePage: 'crear_empleado',
        username: req.session.username // Aquí pasamos el username también
      });
    } catch (err) {
      console.error(err);
      return res.status(500).send('Error al obtener los usuarios');
    }
  } else {
    res.status(403).send('Acceso denegado');
  }
});

app.post('/crear_empleado', ensureLoggedIn, async (req, res) => {
  if (req.session.rol === 'admin') {
    // Obtener todos los valores del formulario
    const { 
      tipo_id_empleado, id_empleado, usuario_id, nombre_apellidos, sexo, direccion, 
      telefono, fecha_nacimiento, email, proyecto, cod_tipo_nomina, numero_cuenta, 
      nombre_banco, fecha_inicio, cargo, salario 
    } = req.body;  
    
    try {
      // Validación de usuario_id (si se obtiene de la sesión)
      const id_usuario = req.session.usuario_id || usuario_id; // Si no está en req.body, lo toma de la sesión

      if (!id_usuario) {
        return res.status(400).send('Error: usuario_id es obligatorio');
      }

      // Consulta SQL corregida con las variables bien definidas
      const query = `
        INSERT INTO empleados (
          tipo_id_empleado, id_empleado, usuario_id, nombre_apellidos, sexo, direccion, 
          telefono, fecha_nacimiento, email, proyecto, cod_tipo_nomina, numero_cuenta, 
          nombre_banco, fecha_inicio, cargo, salario, id_usuario
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      await pool.query(query, [
        tipo_id_empleado, id_empleado, usuario_id, nombre_apellidos, sexo, direccion, 
        telefono, fecha_nacimiento, email, proyecto, cod_tipo_nomina, numero_cuenta, 
        nombre_banco, fecha_inicio, cargo, salario, id_usuario
      ]);

      // Redirigir a la lista de empleados
      res.redirect('/listar_empleados'); 
    } catch (err) {
      console.error('Error al crear el empleado:', err);
      res.status(500).send('Error al crear el empleado');
    }
  } else {
    res.status(403).send('Acceso denegado');
  }
});
// Mostrar formulario con empleados
app.get("/epp", async (req, res) => {
  try {
    const [empleados] = await pool.query("SELECT id_empleado, nombre_apellidos FROM empleados");

          // Pasamos 'rol' y 'username' correctamente dentro del objeto de renderizado
          res.render('epp', { 
            empleados, 
            rol: req.session.rol, 
            username: req.session.username // Asegúrate de que 'username' esté en la sesión
          });
          } catch (error) {
        console.error("Error al obtener empleados:", error);
        res.status(500).send("Error al cargar el formulario de EPP");
    }
});

// Procesar el formulario y guardar en MySQL
  app.post("/registrar_epp", async (req, res) => {
      const { id_empleado, camisa, pantalon, botas, firma_recibido } = req.body;
      console.log("ID del empleado recibido:", id_empleado);  
      try {
        // Verifica si el empleado existe
        const [empleado] = await pool.query("SELECT id_empleado FROM empleados WHERE id_empleado = ?", [id_empleado]);
        if (result.length === 0) {
          return res.status(400).send("Error: El empleado no existe.");
      }

        // Inserta el registro en la tabla epp
        await pool.query(
            "INSERT INTO epp (id_empleado, camisa, pantalon, botas, firma_recibido) VALUES (?, ?, ?, ?, ?)",
            [id_empleado, camisa, pantalon, botas, firma_recibido]
        );

        res.status(201).json({ message: "EPP registrado correctamente" });
    } catch (error) {
        console.error("Error al registrar EPP:", error);
        res.status(500).json({ message: "Error al registrar EPP" });
    }
});

//module.exports = router;

app.use((req, res, next) => {
  res.locals.username = req.session?.username || 'Usuario';
  next();
});
app.use((req, res, next) => {
  res.locals.rol = req.session.rol || ''; // Asegúrate de que `req.session.rol` esté definido
  next();
});
app.use((req, res, next) => {
  res.locals.rol = req.session.usuario ? req.session.usuario.rol : "usuario"; // Valor por defecto
  next();
});

//Ruta para firmar contarto
app.get("/firma_contrato/:id_empleado", async (req, res) => {
  try {
    const empleadoId = req.params.id;

    // Obtener datos del empleado
    const [empleado] = await pool.query("SELECT * FROM empleados WHERE id_empleado = ?", [empleadoId]);

    // Obtener datos del contrato
    const [contrato] = await pool.query("SELECT * FROM empleados WHERE id_empleado = ?", [empleadoId]);

    if (!empleado.length || !contrato.length) {
      return res.status(404).send("Empleado o contrato no encontrados.");
    }

    res.render("firma_contrato", {
      empleado: empleado[0],
      contrato: contrato[0],
    });
  } catch (error) {
    console.error("Error obteniendo datos:", error);
    res.status(500).send("Error del servidor");
  }
});

// Listar terceros
app.get('/terceros', async (req, res) => {
  try {
      const [terceros] = await pool.query('SELECT * FROM terceros');
      res.render('terceros', { terceros });
  } catch (error) {
      console.error(error);
      res.status(500).send("Error obteniendo los terceros");
  }
});
// Listar tercero por id
app.get('/terceros/:doc_id', async (req, res) => {
  try {
      let doc_id = req.params.doc_id;
      let sql = 'SELECT * FROM terceros WHERE doc_id = ?';

      // Usamos `await` sin callback
      let [result] = await pool.query(sql, [doc_id]);

      if (result.length === 0) {
          return res.status(404).json({ error: "Tercero no encontrado" });
      }

      res.json(result[0]); // Enviar solo el objeto encontrado
  } catch (err) {
      console.error("Error en la consulta:", err);
      res.status(500).json({ error: "Error en el servidor" });
  }
});


// Crear tercero
app.post('/terceros', async (req, res) => {
  try {
      // Verifica que req.body tenga datos
      console.log("Datos recibidos:", req.body);

      // Extrae valores del request
      const doc_id = req.body.doc_id || req.body.nuevo_doc_id; // Usa el que esté disponible
      const { tipo_id, razon_social, direccion, celular, telefono, email, ciudad, contacto, estado } = req.body;  

      // Validación de datos obligatorios
      if (!doc_id || !tipo_id || !razon_social) {
          return res.status(400).send("Faltan datos obligatorios.");
      }

      // Inserción en la base de datos
      await pool.query('INSERT INTO terceros SET ?', {
          doc_id, tipo_id, razon_social, direccion, celular, telefono, email, ciudad, contacto, estado
      });

      res.redirect('/terceros');
  } catch (error) {
      console.error("Error al insertar en la BD:", error);
      res.status(500).send("Error creando el tercero");
  }
});


app.get('/terceros/editar/:doc_id', async (req, res) => {
  const { doc_id } = req.params;

  try {
      const [terceros] = await pool.query('SELECT * FROM terceros WHERE doc_id = ?', [doc_id]);

      if (terceros.length === 0) {
          return res.status(404).send("Tercero no encontrado");
      }

      console.log("Datos del tercero:", result[0]); // Verifica en la consola del servidor
      res.render('editarTercero', { tercero: terceros[0] });
  } catch (error) {
      console.error(error);
      res.status(500).send("Error obteniendo los datos del tercero");
  }
});


// Inactivar tercero
app.post('/terceros/inactivar/:doc_id', async (req, res) => {
  const { doc_id } = req.params;
  try {
      await pool.query('UPDATE terceros SET estado = 0 WHERE doc_id = ?', [doc_id]);
      res.redirect('/terceros');
  } catch (error) {
      console.error(error);
      res.status(500).send("Error inactivando el tercero");
  }
});

app.post('/terceros/editar/', async (req, res) => {
  const { tipo_id_tercero, tipo_id, razon_social, direccion, telefono, celular, email, ciudad, contacto, doc_id } = req.body;

  if (!doc_id) {
      console.error("Error: doc_id no llegó correctamente.");
      return res.status(400).send("Error: doc_id no puede estar vacío.");
  }

  try {
      await pool.query(
          `UPDATE terceros 
           SET tipo_id_tercero = ?, tipo_id = ?, razon_social = ?, direccion = ?, telefono = ?, celular = ?, email = ?, ciudad = ?, contacto = ? 
           WHERE doc_id = ?`,
          [tipo_id_tercero, tipo_id, razon_social, direccion, telefono, celular, email, ciudad, contacto, doc_id]
      );

      console.log("Tercero actualizado correctamente");
      res.redirect('/terceros');
  } catch (error) {
      console.error("Error actualizando el tercero:", error);
      res.status(500).send("Error actualizando los datos del tercero");
  }
});

// ***************** REGISTRAR PEDIDOS ********************

// Ruta para mostrar los pedidos y el formulario de registrar nuevo pedido
app.get('/pedidos', async (req, res) => {
  try {
    const [pedidos] = await pool.promise().query('SELECT * FROM registro_pedidos');
    res.render('registrar_pedidos', { pedidos });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al obtener los pedidos');
  }
});





app.get('/registrar_pedidos', async (req, res) => {
  try {
      // Obtener pedidos
      const [pedidos] = await pool.query(`
          SELECT 
              rp.numero_pedido, 
              t.razon_social, 
              rp.fecha_registro, 
              rp.fecha_despacho, 
              ep.estado, 
              rp.prioridad, 
              rp.observacion
          FROM registro_pedidos rp
          LEFT JOIN terceros t ON rp.doc_id = t.doc_id
          LEFT JOIN estados_pedidos ep ON rp.id_estado = ep.id
      `);

      // Obtener terceros y estados de pedidos
      const [terceros] = await pool.query('SELECT * FROM terceros');
      const [estados] = await pool.query('SELECT * FROM estados_pedidos');

      // Formatear fechas antes de enviarlas a la vista
      pedidos.forEach(pedido => {
          pedido.fecha_registro = format(new Date(pedido.fecha_registro), 'dd MMM yyyy');
          pedido.fecha_despacho = format(new Date(pedido.fecha_despacho), 'dd MMM yyyy');
      });

      // Renderizar la vista con todos los datos
      res.render('registrar_pedidos', { pedidos, terceros, estados });

  } catch (error) {
      console.error("Error obteniendo los datos:", error);
      res.status(500).send('Error al cargar los datos');
  }
});



app.get('/editar-pedido/:numero_pedido', async (req, res) => {
  const { numero_pedido } = req.params;

  try {
    // Obtener los datos del pedido
    const [pedido] = await pool.query('SELECT * FROM registro_pedidos WHERE numero_pedido = ?', [numero_pedido]);
    const [estados] = await pool.query('SELECT * FROM estados_pedidos'); // Obtener los estados

    console.log(pedido);  // Asegúrate de que el pedido no esté vacío

    if (pedido.length === 0) {
      return res.status(404).send('Pedido no encontrado');
    }

    // Formatear fechas antes de enviarlas a la vista
    pedido[0].fecha_registro = format(new Date(pedido[0].fecha_registro), 'dd MMM yyyy');
    pedido[0].fecha_despacho = format(new Date(pedido[0].fecha_despacho), 'dd MMM yyyy');

    // Enviar los datos del pedido y los estados a la vista 'registrar_pedidos'
    res.render('registrar_pedidos', { 
      pedido: pedido[0], // Un solo pedido
      estados,
      editar: true, // Indicamos que es una operación de edición
      terceros: []  // Si tienes una lista de terceros, pásala aquí
    });

  } catch (error) {
    console.error(error);
    res.status(500).send("Error al obtener los datos del pedido");
  }
});



app.post('/editar-pedido/:numero_pedido', async (req, res) => {
  const { numero_pedido } = req.params;
  const { fecha_despacho, id_estado, prioridad, observacion } = req.body;

  try {
    await pool.query(
      `UPDATE registro_pedidos 
       SET fecha_despacho = ?, id_estado = ?, prioridad = ?, observacion = ? 
       WHERE numero_pedido = ?`,
      [fecha_despacho, id_estado, prioridad, observacion, numero_pedido]
    );
    res.redirect('/registrar_pedidos'); // Redirige al listado de pedidos
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al actualizar el pedido");
  }
});


app.post('/registrar_pedidos', async (req, res) => {
  const { doc_id, numero_pedido, fecha_registro, fecha_despacho, id_estado, prioridad, observacion } = req.body;
  const usuario_id = 1; // O el usuario autenticado

  try {
      await pool.query(
          `INSERT INTO registro_pedidos (doc_id, numero_pedido, fecha_Registro, fecha_despacho, id_estado, prioridad, observacion, usuario_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [doc_id, numero_pedido, fecha_registro, fecha_despacho, id_estado, prioridad, observacion, usuario_id]
      );

      console.log("Pedido registrado correctamente");
      res.redirect('/registrar_pedidos');
  } catch (error) {
      console.error("Error registrando el pedido:", error);
      res.status(500).send('Error al registrar el pedido');
  }
});
/*
/// ENVIOS DE CORREOS ////


// Configuración del transporte de correo
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'pedidoshmb@gmail.com', // Reemplázalo con tu correo
        pass: 'eyopehbcxwrwjlne' // Reemplázalo con tu contraseña o usa variables de entorno
    }
});

// Función para verificar pedidos y enviar correos
async function verificarYEnviarCorreo() {
  try {
    const [pedidos] = await pool.query(`
      SELECT rp.numero_pedido, ep.estado 
      FROM registro_pedidos rp
      JOIN estados_pedidos ep ON rp.id_estado = ep.id
      WHERE rp.fecha_despacho = CURDATE() + INTERVAL 1 DAY 
      AND rp.id_estado IN (1,2,3,4)
  `);
      console.log("Pedidos encontrados:", pedidos);

      if (pedidos.length > 0) {
        const pedidosTexto = pedidos.map(p => 
          `Pedido #${p['numero_pedido']} - Estado: ${p['estado']}`
      ).join('\n');
      console.log("Texto del correo:", pedidosTexto);

          const mailOptions = {
              from: 'pedidoshmb@gmail.com',
              to: 'oswaldo979@hotmail.com, info@grupogec.com.co, pedidoshmb@gmail.com',
              subject: '⚠️ Pedido pendiente de despacho',
              text: `Los siguientes pedidos aún no han sido despachados y falta 1 día para la entrega:\n\n${pedidosTexto}`
          };

          await transporter.sendMail(mailOptions);
          console.log("Correo enviado con éxito!");
      } else {
          console.log("No hay pedidos pendientes para enviar correo.");
      }
  } catch (error) {
      console.error("Error al verificar y enviar el correo:", error);
  }
}

// Ejecutar la función manualmente
verificarYEnviarCorreo();

*/


// Iniciar el servidor
app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});