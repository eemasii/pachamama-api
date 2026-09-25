import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { Product } from './models/Product.js';
import { requireAdmin } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configuración de CORS y Parsers
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-admin-token']
}));
app.use(express.json());

// Conexión a MongoDB Atlas
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Conectado exitosamente a MongoDB Atlas'))
    .catch((err) => console.error('❌ Error conectando a MongoDB Atlas:', err.message));
}

// --- RUTA DE AUTENTICACIÓN ---

// POST /api/auth/login (Verificar Contraseña del Admin)
app.post('/api/auth/login', (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'La contraseña es requerida.' });
    }

    const expectedToken = (process.env.ADMIN_TOKEN || '').trim();

    if (password.trim() === expectedToken) {
      return res.json({ success: true, message: 'Acceso concedido', token: expectedToken });
    }

    return res.status(401).json({ success: false, message: 'Contraseña incorrecta.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error en el servidor al autenticar' });
  }
});

// --- RUTAS PÚBLICAS ---

// 1. GET /api/categories (Obtener todas las categorías ÚNICAS)
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    
    // Limpieza, formateo y ordenamiento alfabético en español
    const cleanCategories = categories
      .filter((c) => c && typeof c === 'string' && c.trim() !== '')
      .map((c) => c.trim())
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

    // Eliminar duplicados
    const uniqueCategories = Array.from(new Set(cleanCategories));

    res.json({ success: true, categories: uniqueCategories });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener categorías', error: error.message });
  }
});

// 2. GET /api/products (Paginación, Filtros y Orden Alfabético A-Z)
app.get('/api/products', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const { category, search } = req.query;

    const query = {};

    // Filtrar por categoría
    if (category && category !== 'Todas' && category !== 'Todos') {
      query.category = category;
    }

    // Buscador por texto en título o descripción
    if (search && search.trim() !== '') {
      const searchRegex = { $regex: search.trim(),$options: 'i' };
      query.$or = [{ title: searchRegex }, { description: searchRegex }];
    }

    const skip = (page - 1) * limit;

    // Consulta con orden alfabético A-Z
    const [products, total] = await Promise.all([
      Product.find(query)
        .collation({ locale: 'es', strength: 2 })
        .sort({ title: 1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    res.json({
      success: true,
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener productos', error: error.message });
  }
});

// --- RUTAS PROTEGIDAS (Admin) ---

// POST /api/products (Crear Producto)
app.post('/api/products', requireAdmin, async (req, res) => {
  try {
    const { title, description, price, imageUrl, category, unit } = req.body;

    if (!title || price === undefined || !imageUrl || !category) {
      return res.status(400).json({ 
        success: false, 
        message: 'Faltan campos obligatorios (title, price, imageUrl, category).' 
      });
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ success: false, message: 'El precio ingresado no es válido.' });
    }

    const newProduct = new Product({
      title: title.trim(),
      description: description ? description.trim() : '',
      price: numPrice,
      imageUrl: imageUrl.trim(),
      category: category.trim(),
      unit: unit ? unit.trim() : '1kg'
    });

    const savedProduct = await newProduct.save();
    res.status(201).json({ success: true, product: savedProduct });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error al crear el producto', error: error.message });
  }
});

// PUT /api/products/:id (Editar Producto)
app.put('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Validar formato del ObjectId de MongoDB
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'El ID del producto no es válido para MongoDB.' 
      });
    }

    // Filtrar metadatos de MongoDB
    const { _id, __v, createdAt, updatedAt, ...updateData } = req.body;

    if (updateData.price !== undefined) {
      const numPrice = Number(updateData.price);
      if (isNaN(numPrice) || numPrice < 0) {
        return res.status(400).json({
          success: false,
          message: 'El precio debe ser un número válido mayor o igual a 0.'
        });
      }
      updateData.price = numPrice;
    }

    if (updateData.title) updateData.title = updateData.title.trim();
    if (updateData.category) updateData.category = updateData.category.trim();
    if (updateData.imageUrl) updateData.imageUrl = updateData.imageUrl.trim();
    if (updateData.unit) updateData.unit = updateData.unit.trim();
    if (updateData.description !== undefined) updateData.description = updateData.description.trim();

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado en la base de datos.' });
    }

    res.json({ success: true, product: updatedProduct });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(400).json({ 
      success: false, 
      message: 'Error de validación al actualizar', 
      error: error.message 
    });
  }
});

// DELETE /api/products/:id (Eliminar Producto)
app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID de producto no válido.' });
    }

    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    res.json({ success: true, message: 'Producto eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar el producto', error: error.message });
  }
});

// Middleware global de manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor Backend corriendo en http://localhost:${PORT}`);
});
