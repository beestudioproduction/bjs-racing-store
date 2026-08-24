// src/components/ImageUploader.jsx

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseBrowserClient.ts";
import imageCompression from "browser-image-compression";
import { FiUpload } from "react-icons/fi";

const SLOT_CONFIG = [
  { key: "image_url", label: "Gambar Utama", accept: "image/jpeg, image/png, image/webp", suffix: "main" },
  { key: "image_url_2", label: "Gambar 2", accept: "image/jpeg, image/png, image/webp", suffix: "2" },
  { key: "image_url_3", label: "Gambar 3", accept: "image/jpeg, image/png, image/webp", suffix: "3" },
];

const ImageUploader = ({ productId, kategori = "", merek = "", onUploadComplete = () => {} }) => {
  const [files, setFiles] = useState({});
  const [previews, setPreviews] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Gerbang admin dipindah ke sisi browser agar HTML halaman produk identik
  // untuk semua pengunjung dan aman di-cache CDN.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single()
        .then(({ data }) => setIsAdmin(data?.role === "admin"));
    });
  }, []);

  const handleFileChange = (e, key) => {
    const file = e.target.files[0];
    if (!file) return;
    setFiles((prev) => ({ ...prev, [key]: file }));
    setPreviews((prev) => ({ ...prev, [key]: URL.createObjectURL(file) }));
  };

  const handleUpload = async () => {
    if (!Object.keys(files).length) {
      alert("Silakan pilih setidaknya satu gambar untuk diupload.");
      return;
    }

    const isPilok = kategori === "Pilok";
    if (!isPilok && (!kategori || !merek)) {
      alert("Isi Kategori dan Merek terlebih dahulu sebelum upload gambar untuk produk non-Pilok.");
      return;
    }

    setIsUploading(true);

    try {
      const updateData = {};
      const compressionOptions = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      };

      const BUCKET_NAME = isPilok ? "produk-pilok" : "produk-parts";

      const slugify = (text) => {
        return text
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-");
      };

      const uploadFile = async (file, path) => {
        let compressedFile = await imageCompression(file, compressionOptions);
        compressedFile = await convertToWebP(compressedFile);
        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(path, compressedFile, { upsert: true, contentType: "image/webp" });
        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
        return publicUrl;
      };

      for (const [key, file] of Object.entries(files)) {
        const slot = SLOT_CONFIG.find((s) => s.key === key);
        let path;
        if (isPilok) {
          path = `public/${productId}-${slot?.suffix || key}.webp`;
        } else {
          const kategoriSlug = slugify(kategori || "lainnya");
          const merekSlug = slugify(merek || "umum");
          path = `${kategoriSlug}/${merekSlug}/${productId}-${slot?.suffix || key}.webp`;
        }
        updateData[key] = await uploadFile(file, path);
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from("products")
          .update(updateData)
          .eq("id", productId);
        if (updateError) throw updateError;
      }

      alert(
        "Gambar berhasil diupload dan disimpan! Halaman akan dimuat ulang.",
      );
      window.location.reload();
    } catch (error) {
      console.error("Error uploading image:", error);
      alert(
        `Gagal mengupload gambar: ${error?.message || JSON.stringify(error)}`,
      );
    } finally {
      setIsUploading(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="bg-slate-50 border-t-4 border-orange-400 p-4 rounded-b-lg shadow-md mt-8">
      <h3 className="font-bold text-lg text-slate-800 mb-4">
        Panel Admin: Upload Gambar
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SLOT_CONFIG.map((slot) => (
          <div key={slot.key} className="text-center">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {slot.label}
            </label>
            <div className="w-full h-40 border-2 border-dashed rounded-md flex items-center justify-center bg-white">
              {previews[slot.key] ? (
                <img
                  src={previews[slot.key]}
                  alt={slot.label}
                  className="max-h-full max-w-full"
                />
              ) : (
                <span className="text-slate-400">Pilih gambar...</span>
              )}
            </div>
            <input
              type="file"
              accept={slot.accept}
              onChange={(e) => handleFileChange(e, slot.key)}
              className="text-sm mt-2"
            />
          </div>
        ))}
      </div>
      <div className="mt-4 text-right">
        <button
          onClick={handleUpload}
          disabled={isUploading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors disabled:bg-slate-400"
        >
          {isUploading ? "Mengunggah..." : "Upload & Simpan Gambar"}
        </button>
      </div>
    </div>
  );
};

export default ImageUploader;
