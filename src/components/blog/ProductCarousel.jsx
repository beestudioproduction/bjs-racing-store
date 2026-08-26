// ProductCarousel.jsx — Grid produk terkait di halaman artikel
import React, { useState, useCallback } from "react";

const formatPrice = (value) =>
  `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

const SkeletonCard = () => (
  <div className="flex bg-white border border-slate-100 rounded-xl overflow-hidden animate-pulse">
    <div className="w-28 h-28 bg-slate-100 shrink-0" />
    <div className="flex-1 p-3 space-y-2">
      <div className="h-4 bg-slate-100 rounded w-3/4" />
      <div className="h-3 bg-slate-100 rounded w-1/2" />
      <div className="h-3 bg-slate-100 rounded w-2/3" />
      <div className="h-4 bg-slate-100 rounded w-1/3 mt-auto" />
    </div>
  </div>
);

const ProductCarousel = ({ products }) => {
  const [loadingId, setLoadingId] = useState(null);

  const handleClick = useCallback((e, productId) => {
    e.preventDefault();
    setLoadingId(productId);
    setTimeout(() => {
      window.location.href = `/products/${productId}`;
    }, 500);
  }, []);

  if (!products || products.length === 0) return null;

  return (
    <div className="mb-4">
      <h3 className="text-lg font-bold text-slate-800 mb-3">Produk Terkait</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {products.map((product) => (
          <a
            key={product.id}
            href={`/products/${product.id}`}
            onClick={(e) => handleClick(e, product.id)}
            className={`group flex flex-col bg-white border rounded-xl overflow-hidden transition-all duration-200 ${
              loadingId === product.id
                ? "border-orange-300 shadow-md"
                : "border-slate-100 hover:border-orange-200 hover:shadow-md"
            }`}
          >
            {/* Top: Image + Details */}
            <div className="flex">
              {/* Image */}
              <div className="relative w-28 h-28 shrink-0 bg-slate-50 p-2 flex items-center justify-center overflow-hidden">
                {loadingId === product.id ? (
                  <div className="w-full h-full bg-orange-100 rounded flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.nama}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                ) : (
                  <svg className="w-10 h-10 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                )}
                {product.color_swatch_url && (
                  <img
                    src={product.color_swatch_url}
                    alt=""
                    className="absolute bottom-3.5 left-3.5 w-12 h-12 rounded-full shadow-sm object-cover"
                  />
                )}
              </div>

              {/* Details */}
              <div className="flex-1 p-3 flex flex-col min-w-0">
                {/* Nama */}
                <h4 className="text-base font-bold text-slate-800 line-clamp-2 leading-snug">
                  {product.nama}
                </h4>
                {product.sku && (
                  <div className="text-lg font-bold text-blue-500 mb-2">
                    {product.sku}
                  </div>
                )}

                {/* Merek + Lini */}
                <div className="flex items-center gap-1.5 flex-wrap text-[13px] font-bold text-slate-800">
                  {product.merek && <span>{product.merek}</span>}
                  {product.lini_produk && (
                    <>
                      <span>•</span>
                      <span>{product.lini_produk}</span>
                    </>
                  )}
                </div>

                {/* Color Variant + Ukuran */}
                <div className="flex items-center gap-1.5 flex-wrap text-[13px] font-bold text-slate-500">
                  {product.color_variant && <span>{product.color_variant}</span>}
                  {product.ukuran && (
                    <>
                      {product.color_variant && <span>•</span>}
                      <span>Ukuran: {product.ukuran}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom: Harga + Lihat */}
            <div className="flex items-center justify-between px-3 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                {product.harga_coret && product.harga_coret > product.harga_jual && (
                  <span className="text-sm font-bold text-slate-800 line-through">
                    {formatPrice(product.harga_coret)}
                  </span>
                )}
                <span className="text-lg font-bold text-orange-600">
                  {formatPrice(product.harga_jual)}
                </span>
              </div>
              <span className="text-xs font-semibold text-orange-500 group-hover:text-orange-600 flex items-center gap-1">
                Lihat
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

export default ProductCarousel;
