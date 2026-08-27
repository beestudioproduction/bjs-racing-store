// File: src/components/AddressForm.tsx
// Form alamat: Biteship area search + peta Leaflet GPS.

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "@/lib/store";
import type { Address, FormDataState } from "@/lib/store";
import type { BiteshipAreaResult } from "@/lib/biteship";
import MapPicker from "@/components/MapPicker";

interface AddressFormProps {
  isOpen: boolean;
  onClose: () => void;
  addressToEdit?: Address | null;
}

const initialFormState: FormDataState = {
  label: "",
  recipient_name: "",
  recipient_phone: "",
  destination: "",
  destination_text: "",
  village_name: "",
  full_address: "",
  postal_code: "",
  city_id: "",
  province_id: "",
  latitude: "",
  longitude: "",
};

export default function AddressForm({
  isOpen,
  onClose,
  addressToEdit,
}: AddressFormProps) {
  const [formData, setFormData] = useState<FormDataState>(initialFormState);
  const [detailAddress, setDetailAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BiteshipAreaResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [desas, setDesas] = useState<
    { village_name: string; shipping_cost: number; etd: string }[]
  >([]);
  const [hasAllDesa, setHasAllDesa] = useState(false);
  const [isLoadingDesas, setIsLoadingDesas] = useState(false);
  const [isMapEditing, setIsMapEditing] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [gpsMessage, setGpsMessage] = useState("");
  const [locateKey, setLocateKey] = useState(0);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const addAddress = useAppStore((state) => state.addAddress);
  const updateAddress = useAppStore((state) => state.updateAddress);

  useEffect(() => {
    if (isOpen) {
      if (addressToEdit) {
        setFormData({
          label: addressToEdit.label || "",
          recipient_name: addressToEdit.recipient_name || "",
          recipient_phone: addressToEdit.recipient_phone || "",
          destination: addressToEdit.destination || "",
          destination_text: addressToEdit.destination_text || "",
          village_name: addressToEdit.village_name || "",
          full_address: addressToEdit.full_address || "",
          postal_code: addressToEdit.postal_code || "",
          province_id: addressToEdit.province_id || "",
          city_id: addressToEdit.city_id || "",
          latitude: addressToEdit.latitude || "",
          longitude: addressToEdit.longitude || "",
        });
        setSearchQuery(addressToEdit.destination_text || "");
        setDetailAddress(extractDetailAddress(addressToEdit.full_address || ""));
      } else {
        setFormData(initialFormState);
        setDetailAddress("");
        setSearchQuery("");
      }
      setErrorMessage("");
      setSearchResults([]);
      setIsMapEditing(false);
      setGpsMessage("");
      setLocateKey(0);
    }
  }, [addressToEdit, isOpen]);

  useEffect(() => {
    const parts: string[] = [];
    if (detailAddress.trim()) parts.push(detailAddress.trim());
    if (formData.destination_text) parts.push(formData.destination_text);
    else if (formData.postal_code) parts.push(`Kode Pos: ${formData.postal_code}`);
    const composed = parts.join(", ");
    setFormData((prev) => {
      if (prev.full_address === composed) return prev;
      return { ...prev, full_address: composed };
    });
  }, [detailAddress, formData.destination_text, formData.postal_code]);

  function extractDetailAddress(fullAddress: string): string {
    if (!fullAddress) return "";
    const dest = fullAddress.split(",")[0] || "";
    return dest.trim();
  }

  useEffect(() => {
    if (!isOpen) return;
    if (!searchQuery || searchQuery.length < 3 || searchQuery === formData.destination_text) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    fetch(`/api/shipping/biteship/search-area?q=${encodeURIComponent(searchQuery)}`)
      .then(async (res) => {
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.message || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((results: BiteshipAreaResult[]) => {
        setSearchResults(results);
      })
      .catch((err) => {
        console.warn("Biteship search gagal:", err);
        setSearchResults([]);
      })
      .finally(() => setIsSearching(false));
  }, [searchQuery, formData.destination_text, isOpen]);

  useEffect(() => {
    if (!isOpen || !formData.destination) {
      setDesas([]);
      setHasAllDesa(false);
      return;
    }
    let cancelled = false;
    setIsLoadingDesas(true);
    fetch(
      `/api/shipping/bjs-express-desas?subdistrict_id=${encodeURIComponent(
        formData.destination,
      )}`,
    )
      .then(async (res) => {
        if (!res.ok) return { desas: [], hasAllDesa: false };
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setDesas(data.desas || []);
        setHasAllDesa(!!data.hasAllDesa);
      })
      .catch(() => {
        if (cancelled) return;
        setDesas([]);
        setHasAllDesa(false);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDesas(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, formData.destination]);

  useEffect(() => {
    if (searchResults.length > 0 && searchInputRef.current) {
      const rect = searchInputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    } else if (searchResults.length === 0 && !isSearching) {
      setDropdownPos(null);
    }
  }, [searchResults, isSearching]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !dropdownPos) return;
    const handleScroll = () => {
      if (searchInputRef.current) {
        const rect = searchInputRef.current.getBoundingClientRect();
        setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      }
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [dropdownPos]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    if (name === "detail_address") {
      setDetailAddress(value);
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setSearchQuery(newQuery);
    if (newQuery !== formData.destination_text) {
      setFormData((prev) => ({ ...prev, destination: "" }));
    }
  };

  const handleAreaSelect = (area: BiteshipAreaResult) => {
    const fullText = [
      area.administrativeLevel3,
      area.administrativeLevel2,
      area.administrativeLevel1,
    ]
      .filter(Boolean)
      .join(", ");

    setFormData((prev) => ({
      ...prev,
      destination: area.id,
      destination_text: fullText || area.name,
      village_name: "",
      postal_code: area.postalCode || "",
      city_id: area.administrativeLevel2 || "",
      province_id: area.administrativeLevel1 || "",
      latitude: area.latitude || prev.latitude,
      longitude: area.longitude || prev.longitude,
    }));
    setSearchQuery(fullText || area.name);
  };

  const handleMapSelect = (result: { lat: number; lng: number }) => {
    setFormData((prev) => ({
      ...prev,
      latitude: String(result.lat),
      longitude: String(result.lng),
    }));
  };

  const handleLocationFound = (lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      latitude: String(lat),
      longitude: String(lng),
    }));
    setGpsMessage("");

    fetch(`/api/maps/reverse-geocode?lat=${lat}&lng=${lng}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.postal_code) {
          setFormData((prev) => ({
            ...prev,
            postal_code: data.postal_code,
            destination_text:
              data.full_address || data.display_name || prev.destination_text,
            city_id: data.city || prev.city_id,
            province_id: data.province || prev.province_id,
          }));
        }
      })
      .catch(() => {});
  };

  const handleLocationError = (msg: string) => {
    setGpsMessage(msg);
  };

  const handleRetryGps = () => {
    setLocateKey((k) => k + 1);
    setGpsMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    if (!formData.destination) {
      setErrorMessage(
        "Area/Kecamatan harus dipilih dari hasil pencarian.",
      );
      setIsLoading(false);
      return;
    }

    if (!formData.recipient_name || !formData.recipient_phone) {
      setErrorMessage("Nama Penerima dan Nomor Telepon wajib diisi.");
      setIsLoading(false);
      return;
    }

    if (!detailAddress.trim()) {
      setErrorMessage(
        "Detail alamat wajib diisi (Jalan, No. Rumah, RT/RW, Desa/Kelurahan).",
      );
      setIsLoading(false);
      return;
    }

    if (!formData.latitude || !formData.longitude) {
      setErrorMessage(
        "Koordinat lokasi belum terisi. Aktifkan GPS atau tandai lokasi di peta.",
      );
      setIsLoading(false);
      return;
    }

    try {
      if (addressToEdit) {
        await updateAddress(addressToEdit.id, formData);
      } else {
        await addAddress(formData);
      }
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Terjadi kesalahan.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/50 sm:bg-black/60 sm:backdrop-blur-sm" />

      <div className="relative z-10 flex flex-col h-full bg-white sm:max-w-lg sm:mx-auto sm:my-8 sm:rounded-xl sm:shadow-2xl">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col h-full"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0 sm:px-6">
            <h3 className="text-lg font-bold text-slate-800 sm:text-xl">
              {addressToEdit ? "Ubah Alamat" : "Tambah Alamat Baru"}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1 -mr-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-4 sm:px-6 sm:space-y-5">
            {errorMessage && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {errorMessage}
              </div>
            )}

            <div>
              <label
                htmlFor="label"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Label Alamat
              </label>
              <input
                type="text"
                id="label"
                name="label"
                value={formData.label}
                onChange={handleChange}
                placeholder="Contoh: Rumah, Kantor"
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="recipient_name"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Nama Penerima <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="recipient_name"
                name="recipient_name"
                value={formData.recipient_name}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="recipient_phone"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Nomor Telepon <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                id="recipient_phone"
                name="recipient_phone"
                value={formData.recipient_phone}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="area-search"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Cari Area / Kecamatan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="area-search"
                ref={searchInputRef}
                autoComplete="off"
                placeholder="Contoh: Pesanggrahan, Jakarta Selatan"
                value={searchQuery}
                onChange={handleSearchInputChange}
                onFocus={() => {
                  if (searchResults.length > 0 && searchInputRef.current) {
                    const rect = searchInputRef.current.getBoundingClientRect();
                    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setDropdownPos(null), 200);
                }}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              />
              {isSearching && (
                <p className="text-xs text-gray-500 mt-1">Mencari...</p>
              )}
              {searchResults.length > 0 && dropdownPos && createPortal(
                <div
                  className="z-[9999] rounded-lg bg-white shadow-xl ring-1 ring-black/5 overflow-y-auto"
                  style={{
                    position: "fixed",
                    top: dropdownPos.top,
                    left: dropdownPos.left,
                    width: dropdownPos.width,
                    maxHeight: 240,
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {searchResults.map((area) => (
                    <div
                      key={area.id}
                      onMouseDown={() => handleAreaSelect(area)}
                      className="cursor-pointer p-3 hover:bg-orange-50 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-semibold text-gray-800 text-sm">
                        {area.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {[
                          area.administrativeLevel4,
                          area.administrativeLevel3,
                          area.administrativeLevel2,
                          area.administrativeLevel1,
                        ]
                          .filter(Boolean)
                          .join(", ") || area.type}
                      </div>
                      {area.postalCode && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          Kode pos: {area.postalCode}
                        </div>
                      )}
                    </div>
                  ))}
                </div>,
                document.body
              )}
            </div>

            {(desas.length > 0 || hasAllDesa) && (
              <div>
                <label
                  htmlFor="village_name"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Desa / Kelurahan
                </label>
                <select
                  id="village_name"
                  name="village_name"
                  value={formData.village_name}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors bg-white"
                >
                  <option value="">
                    {hasAllDesa
                      ? "-- Semua Desa (harga kecamatan) --"
                      : "-- Pilih Desa --"}
                  </option>
                  {desas.map((d) => (
                    <option key={d.village_name} value={d.village_name}>
                      {d.village_name} (Ongkir{" "}
                      {new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      }).format(d.shipping_cost)}
                      )
                    </option>
                  ))}
                </select>
                {isLoadingDesas && (
                  <p className="text-xs text-gray-500 mt-1">
                    Memuat daftar desa...
                  </p>
                )}
                {!isLoadingDesas &&
                  (desas.length > 0 || hasAllDesa) && (
                    <p className="text-xs text-gray-400 mt-1">
                      Pilih desa agar ongkir BJS Express dihitung sesuai harga
                      desa.
                    </p>
                  )}
              </div>
            )}

            <div>
              <label
                htmlFor="detail_address"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Detail Alamat <span className="text-red-500">*</span>
              </label>
              <textarea
                id="detail_address"
                name="detail_address"
                value={detailAddress}
                onChange={handleChange}
                rows={3}
                required
                placeholder="Contoh: Jl. Merdeka No. 10, RT 01/RW 02, Desa Pesanggrahan"
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                Jalan, nomor rumah, RT/RW, dan Desa/Kelurahan
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Alamat Lengkap
              </label>
              <textarea
                value={formData.full_address}
                readOnly
                rows={3}
                className="w-full border border-gray-200 rounded-lg p-3 text-sm bg-gray-50 text-gray-600 cursor-not-allowed resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                Otomatis terisi dari detail alamat + area yang dipilih
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Kode Pos
              </label>
              <input
                type="text"
                value={formData.postal_code}
                readOnly
                className="w-full border border-gray-200 rounded-lg p-3 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Koordinat Lokasi <span className="text-red-500">*</span>
                </label>
              </div>

              <div className="rounded-xl overflow-hidden border border-gray-200 mb-3">
                {!isMapFullscreen && (
                  <div className="relative">
                    <MapPicker
                      latitude={formData.latitude}
                      longitude={formData.longitude}
                      onSelect={handleMapSelect}
                      onLocationFound={handleLocationFound}
                      onLocationError={handleLocationError}
                      height={200}
                      interactive={isMapEditing}
                      autoLocate={!addressToEdit && !formData.latitude}
                      showStore={true}
                      locateKey={locateKey}
                    />
                    <button
                      type="button"
                      onClick={() => setIsMapFullscreen(true)}
                      className="absolute top-2 right-2 z-[1000] bg-white/90 hover:bg-white p-2 rounded-lg shadow-md transition-colors"
                      title="Buka peta fullscreen"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {isMapFullscreen &&
                createPortal(
                  <div className="fixed inset-0 z-[60]">
                    <div
                      className="absolute inset-0 bg-black/80"
                      onClick={() => setIsMapFullscreen(false)}
                    />
                    <div className="relative w-full h-[100dvh]">
                      <MapPicker
                        latitude={formData.latitude}
                        longitude={formData.longitude}
                        onSelect={handleMapSelect}
                        onLocationFound={handleLocationFound}
                        onLocationError={handleLocationError}
                        height="100dvh"
                        interactive={true}
                        autoLocate={false}
                        showStore={true}
                        locateKey={locateKey}
                      />
                      <button
                        type="button"
                        onClick={() => setIsMapFullscreen(false)}
                        className="absolute top-4 right-4 bg-white hover:bg-gray-100 p-3 rounded-full shadow-lg z-[1001] transition-colors"
                        title="Tutup peta"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>,
                  document.body
                )}

              <div className="grid grid-cols-2 gap-3 mb-3">
                <input
                  type="text"
                  value={formData.latitude}
                  readOnly
                  placeholder="Latitude"
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <input
                  type="text"
                  value={formData.longitude}
                  readOnly
                  placeholder="Longitude"
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>

              <div className="flex gap-2 mb-2">
                {!addressToEdit && !formData.latitude && (
                  <button
                    type="button"
                    onClick={handleRetryGps}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Ulangi GPS
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsMapEditing((v) => !v)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-lg transition-colors ${
                    isMapEditing
                      ? "text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100"
                      : "text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  {isMapEditing ? "Selesai" : "Koreksi Lokasi"}
                </button>
              </div>

              {gpsMessage && (
                <p className="text-xs text-amber-600">
                  {gpsMessage} Gunakan tombol "Koreksi Lokasi" untuk menandai
                  posisi secara manual.
                </p>
              )}
              {!formData.latitude && !formData.longitude && !gpsMessage && (
                <p className="text-xs text-amber-600">
                  GPS belum aktif. Menunggu deteksi lokasi...
                </p>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-5 py-3 flex justify-end gap-3 sm:px-6 sm:py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors text-sm"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm"
            >
              {isLoading ? "Menyimpan..." : "Simpan Alamat"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
