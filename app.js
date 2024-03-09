const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const { body, validationResult } = require('express-validator');


const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

// Configuración de la conexión a la base de datos
const db = mysql.createConnection({
  host: 'petpatrol.ch4ga6k2yl99.us-east-2.rds.amazonaws.com',
  user: 'admin',
  password: 'Crhis240611',
  database: 'petpatrol_db'
});

db.connect((err) => {
  if (err) throw err;
  console.log('Conectado a la base de datos MySQL');
});

// Obtener datos
app.get('/datos', (req, res) => {
  db.query('SELECT * FROM users', (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

app.post('/users/login', (req, res) => {
    const { email_address, password } = req.body;
    // console.log("Hola", req.body)
    if (!email_address || !password) {
      return res.status(400).json({ message: 'Email y contraseña son requeridos.' });
    }

  // console.log("Email proporcionado:", email_address);
  // console.log("Contraseña proporcionada:", password);
  db.query('SELECT * FROM users WHERE email_address = ?', [email_address], async (err, results) => {
    if (err) {
        // console.error("Error al realizar la consulta:", err);
        return res.status(500).json({ message: 'Error al consultar la base de datos.' });
    }
    console.log("Resultados de la consulta:", results);
    if (results.length > 0) {
        const user = results[0];
        // console.log("Usuario encontrado:", user);
        const match = password === user.password;
        // console.log("¿Contraseña coincide?:", match);
        if (match) {
          console.log('match', match)
          res.status(200).json({ message: 'Inicio de sesión exitoso.', user: { id: user.id, email: user.email_address }});
        } else {
          res.status(401).json({ message: 'Contraseña incorrecta.' });
        }
      } else {
        res.status(404).json({ message: 'Usuario no encontrado.' });
      }
    });
  });
  
  
// Obtener perfil de usuario por ID
app.get('/users/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM users WHERE user_id = ?', [id], (err, results) => {
      if (err) {
          console.error("Error al realizar la consulta:", err);
          return res.status(500).json({ message: 'Error al consultar la base de datos.' });
      }
      if (results.length > 0) {
          res.json(results[0]);
      } else {
          res.status(404).json({ message: 'Usuario no encontrado.' });
      }
  });
});

// Endpoint para actualizar los datos de un usuario basado en su correo electrónico
app.put('/users/update', [
  body('email_address').isEmail().withMessage('Debe proporcionar un correo electrónico válido.'),
  body('first_name').optional().trim().escape(),
  body('last_name').optional().trim().escape(),
  body('phone_number').optional().trim().escape(),
  // Agregar más validaciones si es necesario
], (req, res) => {
  // Verificar si hay errores de validación
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Extrayendo datos del cuerpo de la solicitud
  const { email_address, first_name, last_name, phone_number } = req.body;

  // Creando un objeto con los datos a actualizar
  const dataToUpdate = {
    ...(first_name && { first_name }),
    ...(last_name && { last_name }),
    ...(phone_number && { phone_number }),
    // Agregar más campos si es necesario
  };

  // Verifica si se ha enviado una nueva contraseña y si es válida
  if (req.body.password) {
    const { password } = req.body;
    // Agregar aquí la lógica de validación o encriptación de la contraseña si es necesario
    dataToUpdate.password = password;
  }

  // Realizar la actualización usando el correo electrónico como clave
  db.query('UPDATE users SET ? WHERE email_address = ?', [dataToUpdate, email_address], (err, results) => {
    if (err) {
      console.error("Error al realizar la actualización:", err);
      return res.status(500).json({ message: 'Error al actualizar la base de datos.' });
    }
    if (results.affectedRows > 0) {
      res.json({ message: 'Perfil actualizado con éxito.' });
    } else {
      res.status(404).json({ message: 'Usuario no encontrado con ese correo electrónico.' });
    }
  });
});

  app.get('/post', (req, res) => {
    db.query('SELECT * FROM post', (err, results) => {
      if (err) throw err;
      res.json(results);
    });
  });

  app.get('/tipoPost', (req, res) => {
    db.query('SELECT * FROM tipo_post', (err, results) => {
      if (err) throw err;
      res.json(results);
    });
  });

  app.get('/distritos', (req, res) => {
    db.query('SELECT * FROM distrito', (err, results) => {
      if (err) {
        console.error("Error al realizar la consulta:", err);
        return res.status(500).json({ message: 'Error al consultar la base de datos.' });
      }
      // Enviamos los resultados de la consulta al cliente
      res.json(results);
    });
  });

  app.get('/edadMascotas', (req, res) => {
    db.query('SELECT * FROM edad_mascota', (err, results) => {
      if (err) {
        console.error("Error al realizar la consulta:", err);
        return res.status(500).json({ message: 'Error al consultar la base de datos.' });
      }
      // Enviamos los resultados de la consulta al cliente
      res.json(results);
    });
  });

  app.get('/tipoMascotas', (req, res) => {
    db.query('SELECT * FROM tipo_mascota', (err, results) => {
      if (err) {
        console.error("Error al realizar la consulta:", err);
        return res.status(500).json({ message: 'Error al consultar la base de datos.' });
      }
      // Enviamos los resultados de la consulta al cliente
      res.json(results);
    });
  });

// Insertar datos
app.post('/datos', (req, res) => {
  const data = req.body; // Asume que envías los datos como JSON
  db.query('INSERT INTO tu_tabla SET ?', data, (err, results) => {
    if (err) throw err;
    res.json({ id: results.insertId });
  });
});

// Actualizar datos
app.put('/datos/:id', (req, res) => {
  const data = req.body;
  const { id } = req.params;
  db.query('UPDATE tu_tabla SET ? WHERE id = ?', [data, id], (err, results) => {
    if (err) throw err;
    res.json({ success: true });
  });
});

// Eliminar datos
app.delete('/datos/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM tu_tabla WHERE id = ?', id, (err, results) => {
    if (err) throw err;
    res.json({ success: true });
  });
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
