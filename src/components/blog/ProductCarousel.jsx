// ProductCarousel.jsx — Horizontal scroll carousel untuk produk terkait
import React from "react";

const formatPrice = (value) =>
  `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

const ProductCarousel = ({ products }) => {
  if (!products || products.length === 0) return null;

  return (
    <div className="mb-8">
      <h3 className="text-lg font-bold text-slate-800 mb-3">Produk Terkait</h3>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
        {products.map((product) => (
          <a
            key={product.id}
            href={`/products/${product.id}`}
            className="group flex-shrink-0 w-48 bg-white border border-slate-100 rounded-xl overflow-hidden hover:border-orange-200 hover:shadow-md transition-all duration-200"
          >
            <div className="relative w-full aspect-square bg-slate-50 p-3 flex items-center justify-center">
              {product.image_url && (
                <img
                  src={product.image_url}
                  alt={product.nama}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              )}
              {product.color_swatch_url && (
                <img
                  src={product.color_swatch_url}
                  alt=""
                  className="absolute bottom-1.5 left-1.5 w-7 h-7 rounded-full shadow-sm object-cover border border-white"
                />
              )}
            </div>
            <div className="p-3">
              <p className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug mb-1">
                {product.nama}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                {[product.merek, product.color_variant].filter(Boolean).map((v) => (
                  <span key={v} className="text-[10px] text-slate-400">{v}</span>
                ))}
              </div>
              {product.harga_coret && (
                <p className="text-[11px] text-slate-400 line-through">
                  {formatPrice(product.harga_coret)}
                </p>
              )}
              <p className="text-sm font-bold text-orange-600">
                {formatPrice(product.harga_jual)}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

export default ProductCarousel;
