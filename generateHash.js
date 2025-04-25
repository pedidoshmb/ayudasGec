const bcrypt = require('bcryptjs');

// Contraseña que quieres hashear
const password = 'admin123';

// Generar un salt (un valor aleatorio para aumentar la seguridad)
const salt = bcrypt.genSaltSync(10);

// Generar el hash de la contraseña
const hash = bcrypt.hashSync(password, salt);

const saltRounds = 10;
bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
  if (err) throw err;
  // Almacena hashedPassword en la base de datos
});


// Mostrar el hash en la consola
console.log('Hash generado:', hash);