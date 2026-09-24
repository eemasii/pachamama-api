import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    title: { 
      type: String, 
      required: [true, 'El título del producto es obligatorio'], 
      trim: true,
      maxlength: [120, 'El título no puede superar los 120 caracteres']
    },
    description: { 
      type: String, 
      default: '',
      trim: true,
      maxlength: [500, 'La descripción no puede superar los 500 caracteres']
    },
    price: { 
      type: Number, 
      required: [true, 'El precio es obligatorio'],
      min: [0, 'El precio no puede ser negativo']
    },
    imageUrl: { 
      type: String, 
      required: [true, 'La URL de la imagen es obligatoria'],
      trim: true
    },
    category: { 
      type: String, 
      required: [true, 'La categoría es obligatoria'],
      trim: true
    },
    unit: { 
      type: String, 
      default: '1kg',
      trim: true
    },
    inStock: { 
      type: Boolean, 
      default: true 
    }
  },
  {
    timestamps: true
  }
);

// Índice para acelerar búsquedas por texto y filtro por categoría en MongoDB Atlas
productSchema.index({ title: 'text', category: 1 });

export const Product = mongoose.model('Product', productSchema);