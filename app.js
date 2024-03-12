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
app.use(express.urlencoded({extended:true}));
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


global.id_post = null;

app.post('/crearMascotaYPost', async (req, res) => {
  const { name_mascota, contenido_mascota, id_distrito, id_edad, id_sexo, id_size, id_tipo, user_id, tipo_post } = req.body;
  const imagen_del_post = req.files ? req.files.image : null;

  db.beginTransaction(async (err) => {
      if (err) {
          console.error('Error al iniciar la transacción:', err);
          return res.status(500).json({ message: 'Error al iniciar la transacción', error: err });
      }

      try {
          // Insertar mascota
          const insertMascotaQuery = `
          INSERT INTO mascota 
          (name_mascota, contenido_mascota, id_distrito, id_edad, id_sexo, id_size, id_tipo, user_id, fch_mascota)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
          const [mascotaResult] = await db.promise().query(insertMascotaQuery, [name_mascota, contenido_mascota, id_distrito, id_edad, id_sexo, id_size, id_tipo, user_id]);
          const id_mascota = mascotaResult.insertId;

          const insertPostQuery = `
          INSERT INTO post 
          (user_id, id_mascota, tipo_post, fch_post)
          VALUES (?, ?, ?, NOW())`;

          const [postResult] = await db.promise().query(insertPostQuery, [user_id, id_mascota, tipo_post]);
          const id_post = postResult.insertId; // Obtener el id_post recién insertado

          console.log("Consulta a ejecutar:", insertPostQuery);
          console.log("Valores:", [user_id, id_mascota, tipo_post, id_distrito]);

          // Actualizar la columna id_post en la tabla mascota
          const updateMascotaQuery = 'UPDATE mascota SET id_post = ? WHERE id_mascota = ?';
          await db.promise().query(updateMascotaQuery, [id_post, id_mascota]);

          // Subir imagen a S3, si existe
          let imageUrl = null;
          if (imagen_del_post) {
              const command = new PutObjectCommand({
                  Bucket: process.env.BUCKET_NAME,
                  Key: `${id_post.toString()}`,
                  Body: imagen_del_post.data,
                  ContentType: imagen_del_post.mimetype,
                  ACL: 'public-read',
              });
              const data = await client.send(command);
              imageUrl = `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${id_post.toString()}`;
          }

          console.log("req.files:", req.files);
          if (req.files) {
          console.log("Imagen recibida:", req.files.image);
          } else {
              console.log("No se recibió ningún archivo");
          }

          console.log("image", imageUrl)
          db.commit((err) => {
              if (err) {
                  db.rollback(() => {
                      console.error('Error al confirmar la transacción:', err);
                      return res.status(500).json({ message: 'Error al confirmar la transacción', error: err });
                  });
              } else {
                  res.status(201).json({
                      message: 'Mascota, post e imagen creados exitosamente',
                      mascotaId: id_mascota,
                      postId: id_post,
                      imageUrl: imageUrl
                  });
              }
          });
      } catch (error) {
          db.rollback(() => {
              console.error('Error durante la creación de mascota/post:', error);
              res.status(500).json({ message: 'Error al crear mascota y post', error: error });
          });
      }
  });
});

app.get('/posts', (req, res) => {
  const tipoPost = req.query.tipo_post;
  
  let query = `
    SELECT post.*, mascota.name_mascota, mascota.contenido_mascota, mascota.id_distrito, mascota.id_edad, mascota.id_sexo, mascota.id_size 
    FROM post
    JOIN mascota ON post.id_mascota = mascota.id_mascota
    WHERE post.tipo_post = 1`;

  db.query(query, [tipoPost], (err, results) => {
    if (err) {
      console.error("Error al obtener los posts con detalles de mascota:", err);
      return res.status(500).json({ message: 'Error al consultar los posts y detalles de mascota.', error: err });
    }
    const formattedResults = results.map(result => {
      return {
        ...result,
        imageUrl: `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${result.id_post}`
      };
    });
    res.json(formattedResults);
  });
});

app.get('/posts2', (req, res) => {
  const tipoPost = req.query.tipo_post;
  
  let query = `
    SELECT post.*, mascota.name_mascota, mascota.contenido_mascota, mascota.id_distrito, mascota.id_edad, mascota.id_sexo, mascota.id_size 
    FROM post
    JOIN mascota ON post.id_mascota = mascota.id_mascota
    WHERE post.tipo_post = 2`;

  db.query(query, [tipoPost], (err, results) => {
    if (err) {
      console.error("Error al obtener los posts con detalles de mascota:", err);
      return res.status(500).json({ message: 'Error al consultar los posts y detalles de mascota.', error: err });
    }
    const formattedResults = results.map(result => {
      return {
        ...result,
        imageUrl: `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${result.id_post}`
      };
    });
    res.json(formattedResults);
  });
});

app.get('/posts3', (req, res) => {
  const tipoPost = req.query.tipo_post;
  
  let query = `
    SELECT post.*, mascota.name_mascota, mascota.contenido_mascota, mascota.id_distrito, mascota.id_edad, mascota.id_sexo, mascota.id_size 
    FROM post
    JOIN mascota ON post.id_mascota = mascota.id_mascota
    WHERE post.tipo_post = 3`;

  db.query(query, [tipoPost], (err, results) => {
    if (err) {
      console.error("Error al obtener los posts con detalles de mascota:", err);
      return res.status(500).json({ message: 'Error al consultar los posts y detalles de mascota.', error: err });
    }
    const formattedResults = results.map(result => {
      return {
        ...result,
        imageUrl: `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${result.id_post}`
      };
    });
    res.json(formattedResults);
  });
});


app.post('/filtrarMascotas', (req, res) => {
  const { id_distrito, id_edad, id_sexo, id_size, id_tipo } = req.body;

  // Crear la consulta SQL dinámica basada en los parámetros proporcionados
  let query = `
    SELECT mascota.id_mascota, mascota.name_mascota, mascota.contenido_mascota, mascota.id_post,
           mascota.id_distrito, mascota.id_edad, mascota.id_sexo, mascota.id_size, mascota.id_tipo,
           post.fch_post AS fecha_post
    FROM mascota
    INNER JOIN post ON mascota.id_post = post.id_post
    WHERE 1 = 1
  `;

  const params = [];

  // Agregar condiciones según los parámetros proporcionados
  if (id_distrito) {
    query += ' AND mascota.id_distrito = ?';
    params.push(id_distrito);
  }

  if (id_edad) {
    query += ' AND mascota.id_edad = ?';
    params.push(id_edad);
  }

  if (id_sexo) {
    query += ' AND mascota.id_sexo = ?';
    params.push(id_sexo);
  }

  if (id_size) {
    query += ' AND mascota.id_size = ?';
    params.push(id_size);
  }

  if (id_tipo) {
    query += ' AND mascota.id_tipo = ?';
    params.push(id_tipo);
  }

  // Ejecutar la consulta con los parámetros
  db.query(query, params, async (err, results) => {
    if (err) {
      console.error("Error al filtrar las mascotas:", err);
      return res.status(500).json({ message: 'Error al consultar las mascotas.', error: err });
    }

    const formattedResults = await Promise.all(results.map(async (result) => {
      // Obtener la URL de la imagen del post desde AWS S3
      const imageUrl = await getImageUrlFromS3(result.id_post);
      return {
        id_mascota: result.id_mascota,
        name_mascota: result.name_mascota,
        contenido_mascota: result.contenido_mascota,
        id_post: result.id_post,
        id_distrito: result.id_distrito,
        id_edad: result.id_edad,
        id_sexo: result.id_sexo,
        id_size: result.id_size,
        id_tipo: result.id_tipo,
        fecha_post: result.fecha_post,
        imageUrl: imageUrl
      };
    }));

    res.json(formattedResults);
  });
});

// Función para obtener la URL de la imagen del post desde AWS S3
async function getImageUrlFromS3(postId) {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: postId.toString(),
    });
    const { ContentLength, ContentType } = await client.send(command);
    return `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${postId.toString()}`;
  } catch (error) {
    console.error("Error al obtener la imagen del post desde S3:", error);
    return null;
  }
}




//Escuchando
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
