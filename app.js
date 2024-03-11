const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const dotenv = require('dotenv');
const fileUpload = require('express-fileupload');

dotenv.config();

const client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  region: "us-east-2",
});

const app = express();

app.use(express.json());
app.use(fileUpload());

const port = 3000;

app.use(cors());
app.use(bodyParser.json());

// Configuración de la conexión a la base de datos
const db = mysql.createConnection({
  host: process.env.HOST,
  user: process.env.ADMIN,
  password: process.env.PASSWORD,
  database: process.env.DATABASE
});

db.connect((err) => {
  if (err) throw err;
  console.log('Conectado a la base de datos MySQL');
});

app.get('/datos', (req, res) => {
  db.query('SELECT * FROM users', (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

app.post('/users/login', (req, res) => {
  const { email_address, password } = req.body;
  if (!email_address || !password) {
      return res.status(400).json({ message: 'Email y contraseña son requeridos.' });
  }
  db.query('SELECT * FROM users WHERE email_address = ?', [email_address], async (err, results) => {
      if (err) {
          return res.status(500).json({ message: 'Error al consultar la base de datos.' });
      }
      if (results.length > 0) {
          const user = results[0];
          const match = password === user.password;
          if (match) {
              res.status(200).json({ message: 'Inicio de sesión exitoso.', user: { id: user.user_id }});
          } else {
              res.status(401).json({ message: 'Contraseña incorrecta.' });
          }
      } else {
          res.status(404).json({ message: 'Usuario no encontrado.' });
      }
  });
});

app.get('/users/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM users WHERE user_id = ?', [id], (err, results) => {
      if (err) {
          return res.status(500).json({ message: 'Error al consultar la base de datos.' });
      }
      if (results.length > 0) {
          res.json(results[0]);
      } else {
          res.status(404).json({ message: 'Usuario no encontrado.' });
      }
  });
});

app.put('/users/update/:id', [
  body('email_address').isEmail().withMessage('Debe proporcionar un correo electrónico válido.'),
  body('first_name').optional().trim().escape(),
  body('last_name').optional().trim().escape(),
  body('phone_number').optional().trim().escape(),
  body('password').optional().trim(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const userId = req.params.id; 
  const { email_address, first_name, last_name, phone_number, password } = req.body;
  const dataToUpdate = {
    ...(email_address && { email_address }), 
    ...(first_name && { first_name }),
    ...(last_name && { last_name }),
    ...(phone_number && { phone_number }),
    ...(password && { password }), 
  };


  db.query('UPDATE users SET ? WHERE user_id = ?', [dataToUpdate, userId], (err, results) => {
    if (err) {
      console.error("Error al realizar la actualización:", err);
      return res.status(500).json({ message: 'Error al actualizar la base de datos.' });
    }
    if (results.affectedRows > 0) {
      res.json({ message: 'Perfil actualizado con éxito.' });
    } else {
      res.status(404).json({ message: 'Usuario no encontrado.' });
    }
  });
});

app.post('/users/register', [
  body('first_name').notEmpty().withMessage('El nombre es requerido.'),
  body('last_name').notEmpty().withMessage('El apellido es requerido.'),
  body('email_address').isEmail().withMessage('Debe proporcionar un correo electrónico válido.'),
  body('phone_number').isMobilePhone('es-PE').withMessage('Debe proporcionar un número de teléfono válido.'),
  body('password').isLength({ min: 5 }).withMessage('La contraseña debe tener al menos 5 caracteres.')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { first_name, last_name, email_address, phone_number, password } = req.body;

  db.query('SELECT * FROM users WHERE email_address = ?', [email_address], (err, results) => {
    if (err) {
      console.error("Error al consultar la base de datos:", err);
      return res.status(500).json({ message: 'Error al consultar la base de datos.' });
    }
    if (results.length > 0) {
      return res.status(400).json({ message: 'El correo electrónico ya está registrado.' });
    }

    db.query('INSERT INTO users (first_name, last_name, email_address, phone_number, password) VALUES (?, ?, ?, ?, ?)', [first_name, last_name, email_address, phone_number, password], (err, results) => {
      if (err) {
        console.error("Error al registrar el usuario:", err);
        return res.status(500).json({ message: 'Error al registrar el usuario.' });
      }
      res.status(201).json({ message: 'Usuario registrado exitosamente.' });
    });
  });
});

app.get('/post', (req, res) => {
    db.query('SELECT * FROM post', (err, results) => {
      if (err) throw err;
      res.json(results);
    });
});

//adoptar, ayudar, cruce
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
      res.json(results);
    });
});

app.get('/edadMascotas', (req, res) => {
  db.query('SELECT * FROM edad_mascota', (err, results) => {
      if (err) {
        console.error("Error al realizar la consulta:", err);
        return res.status(500).json({ message: 'Error al consultar la base de datos.' });
      }
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

app.get('/sizeMascotas', (req, res) => {
  db.query('SELECT * FROM size_mascota', (err, results) => {
    if (err) {
      console.error("Error al realizar la consulta:", err);
      return res.status(500).json({ message: 'Error al consultar la base de datos.' });
    }
    res.json(results);
  });
});

app.get('/sexoMascotas', (req, res) => {
  db.query('SELECT * FROM sexo_mascota', (err, results) => {
    if (err) {
      console.error("Error al realizar la consulta:", err);
      return res.status(500).json({ message: 'Error al consultar la base de datos.' });
    }
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




// app.post('/post/create', async (req, res) => {

//   // const postData = { 
//   //   name_post: 'Post de prueba para perritos',
//   //   description: 'Este es un post de prueba para perritos',
//   //  } // esto viene desde el req.body

//    const imagen_del_post = req.files.create;
//    console.log(imagen_del_post)

//   // /** Esta parte es la insercion a la bd de mysql */

//   const postId = 1; // Este valor debe venir de la base de datos
  
//   const command = new PutObjectCommand({
//     Bucket: process.env.BUCKET_NAME,
//     Key: postId.toString(),
//     Body: imagen_del_post.data,
//     ContentType: imagen_del_post.mimetype, 
//     ACL: 'public-read'
//   });

//   await client.send(command);

//   return res.json({ message: 'Imagen subida con éxito.' });

// }

// );

app.post('/crearMascotaYPost', (req, res) => {
  const { name_mascota, contenido_mascota, id_distrito, id_edad, id_sexo, id_size, id_tipo, user_id, tipo_post } = req.body;

  // Iniciar la transacción
  db.beginTransaction(err => {
    if (err) {
      console.error('Error al iniciar la transacción:', err);
      return res.status(500).json({ message: 'Error al iniciar la transacción', error: err });
    }

    // Inserción en la tabla mascota
    const insertMascotaQuery = 'INSERT INTO mascota (name_mascota, contenido_mascota, fch_mascota, id_distrito, id_edad, id_sexo, id_size, id_tipo, user_id) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?)';
    db.query(insertMascotaQuery, [name_mascota, contenido_mascota, id_distrito, id_edad, id_sexo, id_size, id_tipo, user_id], (err, resultsMascota) => {
      if (err) {
        return db.rollback(() => {
          console.error('Error al insertar en mascota:', err);
          return res.status(500).json({ message: 'Error al insertar en mascota', error: err });
        });
      }

      const id_mascota = resultsMascota.insertId;

      // Inserción en la tabla post
      const insertPostQuery = 'INSERT INTO post (fch_post, user_id, id_mascota, tipo_post) VALUES (NOW(), ?, ?, ?)';
      db.query(insertPostQuery, [user_id, id_mascota, tipo_post], (err, resultsPost) => {
        if (err) {
          return db.rollback(() => {
            console.error('Error al insertar en post:', err);
            return res.status(500).json({ message: 'Error al insertar post', error: err });
          });
        }

        const id_post = resultsPost.insertId;

        // Actualizar la columna id_post en la tabla mascota
        const updateMascotaQuery = 'UPDATE mascota SET id_post = ? WHERE id_mascota = ?';
        db.query(updateMascotaQuery, [id_post, id_mascota], (err, resultsUpdate) => {
          if (err) {
            return db.rollback(() => {
              console.error('Error al actualizar mascota con id_post:', err);
              return res.status(500).json({ message: 'Error al actualizar mascota con id_post', error: err });
            });
          }

          // Si todo sale bien, confirmamos la transacción
          db.commit(err => {
            if (err) {
              return db.rollback(() => {
                console.error('Error al confirmar la transacción:', err);
                return res.status(500).json({ message: 'Error al confirmar la transacción', error: err });
              });
            }
            res.status(201).json({
              message: 'Mascota y Post creados y vinculados exitosamente',
              mascotaId: id_mascota,
              postId: id_post
            });
          });
        });
      });
    });
  });
});





//Escuchando
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
