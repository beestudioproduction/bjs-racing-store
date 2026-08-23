// src/components/CatalogFilter.jsx

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseBrowserClient.ts";
import { FiSearch, FiRefreshCw, FiX } from "react-icons/fi";
import SearchableCombobox from "./SearchableCombobox.jsx";

const MOTOR_SAYA_KEY = "bjstore_motor_saya";

function readMotorSaya() {
    try {
        const raw = localStorage.getItem(MOTOR_SAYA_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

const CatalogFilter = ({ filters, setFilters, filterConfig }) => {
    // State baru untuk menampung data master
    const [categories, setCategories] = useState([]);
    const [activeMereks, setActiveMereks] = useState(new Set());
    const [vehicleBrands, setVehicleBrands] = useState([]);
    const [vehicleModels, setVehicleModels] = useState([]);
    const [allProducts, setAllProducts] = useState([]);
    const debounceTimerRef = useRef(null);

    // 🏍️ Motor Saya: ingat kendaraan terakhir pelanggan
    const [motorSaya, setMotorSaya] = useState(null);
    const [motorDismissed, setMotorDismissed] = useState(false);

    useEffect(() => {
        setMotorSaya(readMotorSaya());
        const fetchFilterData = async () => {
            // Ambil data produk untuk filter merek/cascade dengan PAGINATION
            // (PostgREST membatasi 1000 baris/request; tanpa pagination opsi
            // merek/lini/ukuran hanya berasal dari 1000 produk pertama).
            const PAGE = 1000;
            let from = 0;
            let allProductData = [];
            while (true) {
                let productQuery = supabase
                    .from("products")
                    .select("merek, lini_produk, color_variant, ukuran")
                    .eq("status", "Aktif")
                    .range(from, from + PAGE - 1);
                if (filterConfig.category) {
                    productQuery = productQuery.eq("kategori", filterConfig.category);
                }
                if (filterConfig.showVehicleBrandFilter) {
                    productQuery = productQuery.not("kategori", "in", '("Pilok", "Jasa")');
                }
                const { data: productPage, error } = await productQuery;
                if (error) {
                    console.error("Gagal memuat data filter:", error.message);
                    break;
                }
                if (!productPage || productPage.length === 0) break;
                allProductData = allProductData.concat(productPage);
                if (productPage.length < PAGE) break;
                from += PAGE;
            }
            setAllProducts(allProductData);

            // PERBAIKAN 1: Ambil data Kategori jika filter diaktifkan
            // Hanya kategori yang AKTIF di product_categories (visibilitas /onderdil)
            if (filterConfig.showCategoryFilter) {
                const { data: activeCatData } = await supabase
                    .from('product_categories')
                    .select('kategori')
                    .eq('is_active', true);
                const activeCatSet = new Set((activeCatData || []).map(c => c.kategori));

                const { data: productCatData } = await supabase
                    .from('products')
                    .select('kategori')
                    .not('kategori', 'in', '("Pilok", "Jasa")')
                    .not('kategori', 'is', null);

                if (productCatData) {
                    const uniqueCategories = [...new Set(productCatData.map(p => p.kategori))]
                        .filter(k => activeCatSet.has(k))
                        .sort();
                    setCategories(uniqueCategories);
                }
            }

            // Ambil merek yang AKTIF di product_mereks (visibilitas /onderdil)
            if (filterConfig.showVehicleBrandFilter) {
                const { data: merekData } = await supabase
                    .from('product_mereks')
                    .select('merek')
                    .eq('is_active', true);
                setActiveMereks(new Set((merekData || []).map(m => m.merek)));
            }

            // Ambil data kendaraan jika filter kendaraan aktif
            if (filterConfig.showVehicleBrandFilter) {
                const { data: brandsData } = await supabase.from('vehicle_brands').select('*').order('name');
                setVehicleBrands(brandsData || []);
            }
            if (filterConfig.showVehicleModelFilter) {
                const { data: modelsData } = await supabase.from('vehicle_models').select('*').order('name');
                setVehicleModels(modelsData || []);
            }
        };
        fetchFilterData();
        return () => clearTimeout(debounceTimerRef.current);
    }, [filterConfig]);

    useEffect(() => {
        return () => clearTimeout(debounceTimerRef.current);
    }, []);

    // Simpan pilihan kendaraan sebagai "Motor Saya" saat keduanya terisi
    useEffect(() => {
        if (!filterConfig.showVehicleBrandFilter) return;
        if (filters.merek_motor === "semua" || filters.tipe_motor === "semua") return;
        const b = vehicleBrands.find(
            (x) => String(x.id) === String(filters.merek_motor),
        );
        const m = vehicleModels.find(
            (x) => String(x.id) === String(filters.tipe_motor),
        );
        if (!b || !m) return;
        const payload = {
            brandId: b.id,
            brandName: b.name,
            modelId: m.id,
            modelName: m.name,
            savedAt: Date.now(),
        };
        try {
            localStorage.setItem(MOTOR_SAYA_KEY, JSON.stringify(payload));
            setMotorSaya(payload);
        } catch {
            /* localStorage diblokir — fitur diam-diam nonaktif */
        }
    }, [
        filters.merek_motor,
        filters.tipe_motor,
        vehicleBrands,
        vehicleModels,
        filterConfig.showVehicleBrandFilter,
    ]);

    const applyMotorSaya = () => {
        if (!motorSaya) return;
        setFilters((prev) => ({
            ...prev,
            merek_motor: String(motorSaya.brandId),
            tipe_motor: String(motorSaya.modelId),
        }));
    };

    const options = useMemo(() => {
        // Pada halaman /onderdil, opsi merek dibatasi hanya merek AKTIF
        // dan nilai kosong/'-' dinormalisasi menjadi 'TANPA MEREK'
        const merekOptions = filterConfig.showVehicleBrandFilter
            ? [...new Set(
                  allProducts.map((p) =>
                      !p.merek || p.merek === "-" || p.merek === ""
                          ? "TANPA MEREK"
                          : p.merek
                  )
              )].filter((m) => activeMereks.has(m)).sort()
            : [...new Set(allProducts.map((p) => p.merek).filter(Boolean))].sort();
        const filteredByMerek =
            filters.merek === "semua"
                ? allProducts
                : allProducts.filter((p) => p.merek === filters.merek);
        const liniProdukOptions = [
            ...new Set(
                filteredByMerek.map((p) => p.lini_produk).filter(Boolean),
            ),
        ].sort();
        const filteredByLine =
            filters.lini_produk === "semua"
                ? filteredByMerek
                : filteredByMerek.filter(
                      (p) => p.lini_produk === filters.lini_produk,
                  );
        const colorVariantOptions = [
            ...new Set(
                filteredByLine.map((p) => p.color_variant).filter(Boolean),
            ),
        ].sort();
        const filteredByVariant =
            filters.color_variant === "semua"
                ? filteredByLine
                : filteredByLine.filter(
                      (p) => p.color_variant === filters.color_variant,
                  );
        const ukuranOptions = [
            ...new Set(filteredByVariant.map((p) => p.ukuran).filter(Boolean)),
        ].sort();

        const filteredModels =
            filters.merek_motor === "semua"
                ? vehicleModels
                : vehicleModels.filter(
                      (model) => String(model.brand_id) === String(filters.merek_motor),
                  );

        return {
            merek: merekOptions,
            lini_produk: liniProdukOptions,
            color_variant: colorVariantOptions,
            ukuran: ukuranOptions,
            kategori: categories, // PERBAIKAN 2: Sediakan opsi kategori
            vehicle_brands: vehicleBrands,
            vehicle_models: filteredModels,
        };
    }, [allProducts, filters, activeMereks, vehicleBrands, vehicleModels, categories]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name === "merek") {
            setFilters((prev) => ({
                ...prev,
                merek: value,
                lini_produk: "semua",
                color_variant: "semua",
                ukuran: "semua",
            }));
        } else if (name === "lini_produk") {
            setFilters((prev) => ({
                ...prev,
                lini_produk: value,
                color_variant: "semua",
                ukuran: "semua",
            }));
        } else if (name === "color_variant") {
            setFilters((prev) => ({
                ...prev,
                color_variant: value,
                ukuran: "semua",
            }));
        } else if (name === "merek_motor") {
            setFilters((prev) => ({
                ...prev,
                merek_motor: value,
                tipe_motor: "semua",
            }));
        } else {
            setFilters((prev) => ({ ...prev, [name]: value }));
        }
    };

    // Adapter agar SearchableCombobox memakai logika cascade yang sama
    const setField = (name, value) =>
        handleInputChange({ target: { name, value } });

    // Hapus satu filter via chip (termasuk reset anak-cascade)
    const CHIP_CHILD_RESETS = {
        merek: { lini_produk: "semua", color_variant: "semua", ukuran: "semua" },
        lini_produk: { color_variant: "semua", ukuran: "semua" },
        color_variant: { ukuran: "semua" },
        merek_motor: { tipe_motor: "semua" },
    };

    const removeFilter = (key) => {
        const def = key === "searchTerm" ? "" : "semua";
        setFilters((prev) => ({
            ...prev,
            [key]: def,
            ...(CHIP_CHILD_RESETS[key] || {}),
        }));
    };

    // Derivasi chip filter aktif
    const chipDefs = useMemo(() => {
        const chips = [];
        const q = (filters.searchTerm || "").trim();
        if (q) chips.push({ key: "searchTerm", label: `Cari: ${q}` });
        if (filters.kategori !== "semua")
            chips.push({ key: "kategori", label: `Kategori: ${filters.kategori}` });
        if (filters.merek !== "semua")
            chips.push({ key: "merek", label: `Merek: ${filters.merek}` });
        if (filters.lini_produk !== "semua")
            chips.push({ key: "lini_produk", label: `Lini: ${filters.lini_produk}` });
        if (filters.color_variant !== "semua")
            chips.push({ key: "color_variant", label: `Varian: ${filters.color_variant}` });
        if (filters.ukuran !== "semua")
            chips.push({ key: "ukuran", label: `Ukuran: ${filters.ukuran}` });
        if (filters.merek_motor !== "semua") {
            const b = vehicleBrands.find(
                (x) => String(x.id) === String(filters.merek_motor),
            );
            chips.push({
                key: "merek_motor",
                label: `🏍️ ${b ? b.name : filters.merek_motor}`,
            });
        }
        if (filters.tipe_motor !== "semua") {
            const m = vehicleModels.find(
                (x) => String(x.id) === String(filters.tipe_motor),
            );
            chips.push({
                key: "tipe_motor",
                label: m ? m.name : filters.tipe_motor,
            });
        }
        return chips;
    }, [filters, vehicleBrands, vehicleModels]);

    const handleSearchChange = useCallback((e) => {
        const { value } = e.target;
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            setFilters((prev) => ({ ...prev, searchTerm: value }));
        }, 300);
    }, [setFilters]);

    const handleSortChange = (type, value) => {
        if (type === "sort" && filters.price !== "")
            setFilters((prev) => ({ ...prev, sort: value, price: "" }));
        else
            setFilters((prev) => ({
                ...prev,
                sort: value,
                price: type === "price" ? value : "",
            }));
    };

    const resetFilters = () =>
        setFilters({
            searchTerm: "",
            sort: "terlaris",
            price: "",
            kategori: "semua",
            merek: "semua",
            lini_produk: "semua",
            color_variant: "semua",
            ukuran: "semua",
            merek_motor: "semua", // Pastikan reset juga filter baru
            tipe_motor: "semua", // Pastikan reset juga filter baru
        });

    // Tampilkan ajakan "Motor Saya" bila tersimpan & belum dipakai sekarang
    const showMotorSaya =
        filterConfig.showVehicleBrandFilter &&
        motorSaya &&
        !motorDismissed &&
        String(motorSaya.modelId) !== String(filters.tipe_motor);

    const toOpts = (arr) => arr.map((o) => ({ value: o, label: o }));

    return (
    <div className="bg-white p-4 rounded-lg shadow-sm mb-6 space-y-4">
      {/* Kolom Pencarian */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          name="searchTerm"
          defaultValue={filters.searchTerm}
          onChange={handleSearchChange}
          className="w-full p-2 pl-10 border rounded-lg text-sm"
          placeholder="Cari di toko ini..."
        />
      </div>

      {/* Ajakan Motor Saya */}
      {showMotorSaya && (
        <div className="flex flex-wrap items-center gap-2 text-sm bg-orange-50/70 border border-orange-100 rounded-lg px-3 py-2">
          <span className="text-slate-500">Motor saya:</span>
          <span className="font-medium text-slate-700">
            {motorSaya.modelName} — {motorSaya.brandName}
          </span>
          <button
            type="button"
            onClick={applyMotorSaya}
            className="px-2.5 py-1 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors"
          >
            Terapkan
          </button>
          <button
            type="button"
            onClick={() => setMotorDismissed(true)}
            aria-label="Tutup saran motor saya"
            className="ml-auto text-slate-400 hover:text-slate-600"
          >
            <FiX size={14} />
          </button>
        </div>
      )}

      {/* Jajaran Dropdown Filter */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">

        {/* --- FILTER KATEGORI --- */}
        {filterConfig.showCategoryFilter && (
            <SearchableCombobox
                id="filter-kategori"
                options={toOpts(options.kategori)}
                value={filters.kategori}
                onChange={(v) => setField("kategori", v)}
                placeholder="Semua Kategori"
                searchPlaceholder="Cari kategori..."
                emptyMessage="Kategori tidak ditemukan"
                onClear={() => setField("kategori", "semua")}
            />
        )}

        {/* Filter Merek Produk (seperti Federal, Aspira) */}
        {filterConfig.showMerekFilter && (
          <SearchableCombobox
            id="filter-merek"
            options={toOpts(options.merek)}
            value={filters.merek}
            onChange={(v) => setField("merek", v)}
            placeholder="Semua Merek Produk"
            searchPlaceholder="Cari merek..."
            emptyMessage="Merek tidak ditemukan"
            onClear={() => setField("merek", "semua")}
          />
        )}

        {/* Filter Kendaraan */}
        {filterConfig.showVehicleBrandFilter && (
          <SearchableCombobox
            id="filter-merek-motor"
            options={options.vehicle_brands.map((b) => ({ value: String(b.id), label: b.name }))}
            value={filters.merek_motor}
            onChange={(v) => setField("merek_motor", v)}
            placeholder="Semua Merek Motor"
            searchPlaceholder="Cari merek motor..."
            emptyMessage="Merek motor tidak ditemukan"
            onClear={() => setField("merek_motor", "semua")}
          />
        )}
        {filterConfig.showVehicleModelFilter && (
          <SearchableCombobox
            id="filter-tipe-motor"
            options={options.vehicle_models.map((m) => ({ value: String(m.id), label: m.name }))}
            value={filters.tipe_motor}
            onChange={(v) => setField("tipe_motor", v)}
            placeholder="Semua Tipe Motor"
            searchPlaceholder="Cari tipe motor..."
            emptyMessage="Tipe tidak ditemukan"
            onClear={() => setField("tipe_motor", "semua")}
          />
        )}

        {/* Filter untuk Pilok (tetap ada) */}
        {filterConfig.showLiniProdukFilter && (
          <SearchableCombobox
            id="filter-lini"
            options={toOpts(options.lini_produk)}
            value={filters.lini_produk}
            onChange={(v) => setField("lini_produk", v)}
            placeholder="Semua Lini Produk"
            searchPlaceholder="Cari lini produk..."
            emptyMessage="Lini tidak ditemukan"
            onClear={() => setField("lini_produk", "semua")}
          />
        )}
        {filterConfig.showColorVariantFilter && (
          <SearchableCombobox
            id="filter-varian"
            options={toOpts(options.color_variant)}
            value={filters.color_variant}
            onChange={(v) => setField("color_variant", v)}
            placeholder="Semua Varian Warna"
            searchPlaceholder="Cari varian warna..."
            emptyMessage="Varian tidak ditemukan"
            onClear={() => setField("color_variant", "semua")}
          />
        )}
        {filterConfig.showUkuranFilter && (
          <SearchableCombobox
            id="filter-ukuran"
            options={toOpts(options.ukuran)}
            value={filters.ukuran}
            onChange={(v) => setField("ukuran", v)}
            placeholder="Semua Ukuran"
            searchPlaceholder="Cari ukuran..."
            emptyMessage="Ukuran tidak ditemukan"
            onClear={() => setField("ukuran", "semua")}
          />
        )}

        {/* Tombol Reset */}
        <button
          onClick={resetFilters}
          className="flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-4 rounded-lg text-sm"
        >
          <FiRefreshCw size={16} /> Reset
        </button>
      </div>

      {/* Bar chip filter aktif */}
      {chipDefs.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          {chipDefs.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-medium"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => removeFilter(chip.key)}
                aria-label={`Hapus filter ${chip.label}`}
                className="hover:text-red-600 font-bold leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Jajaran Tombol Urutkan */}
      <div className="flex items-center gap-2 border-t pt-4">
        <span className="text-sm font-semibold text-slate-700 mr-2">
          Urutkan:
        </span>
        <button
          onClick={() => handleSortChange("sort", "terlaris")}
          className={`px-4 py-2 text-sm rounded-md ${filters.sort === "terlaris" && !filters.price ? "bg-orange-500 text-white" : "bg-slate-100"}`}
        >
          Terlaris
        </button>
        <button
          onClick={() => handleSortChange("sort", "terbaru")}
          className={`px-4 py-2 text-sm rounded-md ${filters.sort === "terbaru" && !filters.price ? "bg-orange-500 text-white" : "bg-slate-100"}`}
        >
          Terbaru
        </button>
        <select
          value={filters.price}
          onChange={(e) => handleSortChange("price", e.target.value)}
          className="p-2 border rounded-lg bg-white text-sm"
        >
          <option value="">Harga</option>
          <option value="terendah">Terendah</option>
          <option value="tertinggi">Tertinggi</option>
        </select>
      </div>
    </div>
  );
};

export default CatalogFilter;
