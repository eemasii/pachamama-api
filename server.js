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
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Conectado exitosamente a MongoDB Atlas'))
  .catch((err) => console.error('❌ Error conectando a MongoDB Atlas:', err));

// --- RUTAS PÚBLICAS ---

// GET /api/products (Con Paginación, Filtro por Categoría y Búsqueda Servidor)
app.get('/api/products', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // Límite por defecto
    const { category, search } = req.query;

    const query = {};

    if (category && category !== 'Todas' && category !== 'Todos') {
      query.category = category;
    }

    if (search && search.trim() !== '') {
      query.title = { $regex: search.trim(),$options: 'i' };
    }

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Product.countDocuments(query)
    ]);

    res.json({
      success: true,
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener productos', error: error.message });
  }
});

// --- RUTAS PROTEGIDAS (Solo Admin) ---

// POST /api/products (Crear)
app.post('/api/products', requireAdmin, async (req, res) => {
  try {
    const { title, description, price, imageUrl, category, unit } = req.body;

    if (!title || price === undefined || !imageUrl || !category) {
      return res.status(400).json({ 
        success: false, 
        message: 'Faltan campos obligatorios (title, price, imageUrl, category).' 
      });
    }

    const newProduct = new Product({
      title,
      description,
      price: Number(price),
      imageUrl,
      category,
      unit: unit || '1kg'
    });

    const savedProduct = await newProduct.save();
    res.status(201).json({ success: true, product: savedProduct });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error al crear el producto', error: error.message });
  }
});

// PUT /api/products/:id (Editar)
app.put('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    res.json({ success: true, product: updatedProduct });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error al actualizar el producto', error: error.message });
  }
});

// DELETE /api/products/:id (Eliminar)
app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if (!deletedProduct) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    res.json({ success: true, message: 'Producto eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar el producto', error: error.message });
  }
});

// Middleware Global para manejo de errores de sintaxis o JSON malformado
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor Backend protegido corriendo en http://localhost:${PORT}`);
});