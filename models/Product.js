import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    imageUrl: { type: String, required: true },
    inStock: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const Product = mongoose.model('Product', productSchema);