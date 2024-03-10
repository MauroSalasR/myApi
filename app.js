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

app.post('/post/create', async (req, res) => {

  // const postData = { 
  //   name_post: 'Post de prueba para perritos',
  //   description: 'Este es un post de prueba para perritos',
  //  } // esto viene desde el req.body

   const imagen_del_post = req.files.image;
   console.log(imagen_del_post)

  // /** Esta parte es la insercion a la bd de mysql */

  const postId = 1; // Este valor debe venir de la base de datos
  
  const command = new PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: postId.toString(),
    Body: imagen_del_post.data,
    ContentType: imagen_del_post.mimetype, 
    ACL: 'public-read'
  });

  await client.send(command);

  return res.json({ message: 'Imagen subida con éxito.' });

}

);

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
