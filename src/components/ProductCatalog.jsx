// src/components/ProductCatalog.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseBrowserClient.ts";
import CatalogFilter from "./CatalogFilter.jsx";
import ProductCard from "./ProductCard.jsx";
import ColorSwatchCard from "./ColorSwatchCard.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { FiInbox } from "react-icons/fi";

const DEFAULT_FILTERS = {
    searchTerm: "",
    sort: "terlaris",
    price: "",
    kategori: "semua",
    merek: "semua",
    lini_produk: "semua",
    color_variant: "semua",
    ukuran: "semua",
    merek_motor: "semua",
    tipe_motor: "semua",
};

const intParamOrSemua = (v) => (v && /^\d+$/.test(v) ? v : "semua");

// Baca filter awal dari URL (?q=&sort=&kategori=&merek=&lini=&varian=&ukuran=&merek_motor=&tipe_motor=)
// Param tidak dikenal/tidak valid diabaikan lunak → fallback "semua".
const initialFiltersFromUrl = () => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    if (![...sp.keys()].length) return null;
    const strOrSemua = (k) => sp.get(k) || "semua";
    return {
        searchTerm: sp.get("q") || "",
        sort: ["terlaris", "terbaru"].includes(sp.get("sort"))
            ? sp.get("sort")
            : "terlaris",
        price: ["terendah", "tertinggi"].includes(sp.get("price"))
            ? sp.get("price")
            : "",
        kategori: strOrSemua("kategori"),
        merek: strOrSemua("merek"),
        lini_produk: strOrSemua("lini"),
        color_variant: strOrSemua("varian"),
        ukuran: strOrSemua("ukuran"),
        merek_motor: intParamOrSemua(sp.get("merek_motor")),
        tipe_motor: intParamOrSemua(sp.get("tipe_motor")),
    };
};

const ProductCatalog = ({ filterConfig, cardType = "product" }) => {
    const [allProducts, setAllProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    const [filters, setFilters] = useState(
        initialFiltersFromUrl() || DEFAULT_FILTERS,
    );

    // Cerminan state filter ke URL agar link hasil filter bisa dibagikan
    useEffect(() => {
        if (typeof window === "undefined") return;
        const sp = new URLSearchParams();
        const q = (filters.searchTerm || "").trim();
        if (q) sp.set("q", q);
        if (filters.sort !== "terlaris") sp.set("sort", filters.sort);
        if (filters.price) sp.set("price", filters.price);
        if (filters.kategori !== "semua") sp.set("kategori", filters.kategori);
        if (filters.merek !== "semua") sp.set("merek", filters.merek);
        if (filters.lini_produk !== "semua")
            sp.set("lini", filters.lini_produk);
        if (filters.color_variant !== "semua")
            sp.set("varian", filters.color_variant);
        if (filters.ukuran !== "semua") sp.set("ukuran", filters.ukuran);
        if (filters.merek_motor !== "semua")
            sp.set("merek_motor", String(filters.merek_motor));
        if (filters.tipe_motor !== "semua")
            sp.set("tipe_motor", String(filters.tipe_motor));
        const qs = sp.toString();
        window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${qs ? `?${qs}` : ""}`,
        );
    }, [filters]);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        let sortBy = filters.sort;
        if (filters.price === "terendah") sortBy = "harga_asc";
        if (filters.price === "tertinggi") sortBy = "harga_desc";

        const isOnderdilPage = filterConfig.showVehicleBrandFilter;

        const functionName = isOnderdilPage
            ? 'search_onderdil_products'
            : 'search_and_sort_products';

        let finalCategoryFilter = null;
        if (filters.kategori !== "semua") {
            finalCategoryFilter = filters.kategori;
        } else if (filterConfig.category) {
            finalCategoryFilter = filterConfig.category;
        }

        let params = {
            p_sort_by: sortBy,
            p_search_term: filters.searchTerm,
            p_kategori: finalCategoryFilter,
            p_merek: filters.merek === "semua" ? null : filters.merek
        };

        if (isOnderdilPage) {
            params.p_vehicle_brand_id = filters.merek_motor === "semua" ? null : parseInt(filters.merek_motor, 10);
            params.p_vehicle_model_id = filters.tipe_motor === "semua" ? null : parseInt(filters.tipe_motor, 10);
        } else {
            params.p_lini_produk = filters.lini_produk === "semua" ? null : filters.lini_produk;
            params.p_color_variant = filters.color_variant === "semua" ? null : filters.color_variant;
            params.p_ukuran = filters.ukuran === "semua" ? null : filters.ukuran;
        }

        // Ambil semua hasil dengan PAGINATION via parameter RPC
        // (PostgREST membatasi 1000 baris/request & mengabaikan header Range
        // pada pemanggilan RPC, sehingga p_limit/p_offset diproses di SQL).
        const PAGE = 1000;
        let offset = 0;
        let allResult = [];
        while (true) {
            const { data, error } = await supabase.rpc(functionName, {
                ...params,
                p_limit: PAGE,
                p_offset: offset,
            });

            if (error) {
                console.error(`Gagal memuat produk (${functionName}):`, error.message);
                break;
            }
            if (!data || data.length === 0) break;
            allResult = allResult.concat(data);
            if (data.length < PAGE) break;
            offset += PAGE;
        }
        setAllProducts(allResult);

        setLoading(false);
    }, [filterConfig, filters]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const groupedProducts = useMemo(() => {
        if (cardType !== "colorSwatch") return null;
        const uniqueProducts = new Map();
        allProducts.forEach((p) => {
            if (!uniqueProducts.has(p.nama) && p.color_swatch_url) {
                uniqueProducts.set(p.nama, p);
            }
        });
        const uniqueProductList = Array.from(uniqueProducts.values());
        return uniqueProductList.reduce((acc, product) => {
            const variant = product.color_variant || "Lainnya";
            if (!acc[variant]) acc[variant] = [];
            acc[variant].push(product);
            return acc;
        }, {});
    }, [allProducts, cardType]);

    return (
        <ErrorBoundary>
            <div>
                <CatalogFilter
                    filters={filters}
                    setFilters={setFilters}
                    filterConfig={filterConfig}
                />

                {loading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div
                                key={i}
                                className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden animate-pulse"
                            >
                                <div className="aspect-square bg-slate-200" />
                                <div className="p-3 space-y-2">
                                    <div className="h-3 bg-slate-200 rounded w-3/4" />
                                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                                    <div className="h-5 bg-slate-200 rounded w-2/3 mt-3" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : cardType === "colorSwatch" ? (
                    Object.keys(groupedProducts).length > 0 ? (
                        <div className="space-y-12">
                            {Object.entries(groupedProducts).map(
                                ([variantName, products]) => (
                                    <div key={variantName}>
                                        <h2 className="text-xl font-bold border-b-2 border-orange-400 pb-2 mb-6">
                                            {variantName}
                                        </h2>
                                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-x-4 gap-y-8">
                                            {products.map((product) => (
                                                <ColorSwatchCard
                                                    key={product.id}
                                                    product={product}
                                                    allProductsInCatalog={allProducts}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ),
                            )}
                        </div>
                    ) : (
                        <p className="text-center py-20 text-slate-500">
                            Warna tidak ditemukan.
                        </p>
                    )
                ) : allProducts.length > 0 ? (
                    <>
                        <p className="text-sm text-slate-500 mb-3">
                            {allProducts.length} produk ditemukan
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            {allProducts.map((product) => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="text-center py-16 bg-white rounded-lg shadow-sm">
                        <FiInbox size={48} className="mx-auto text-slate-300" />
                        <p className="mt-3 text-slate-500">
                            Tidak ada produk yang cocok dengan filter ini.
                        </p>
                        <button
                            type="button"
                            onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                            className="mt-4 inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                        >
                            Hapus semua filter
                        </button>
                    </div>
                )}
            </div>
        </ErrorBoundary>
    );
};

export default ProductCatalog;
