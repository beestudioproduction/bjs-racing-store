// File: src/components/AddressSection.tsx
import React, { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import AddressForm from "./AddressForm";
import type { Address } from "@/lib/store";

function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetPrimary,
}: {
  address: Address;
  onEdit: () => void;
  onDelete: () => void;
  onSetPrimary: () => void;
}) {
  return (
    <div
      className={`bg-white shadow-sm rounded-xl flex flex-col transition-all duration-200 hover:shadow-md ${
        address.is_primary ? "border-2 border-orange-500" : "border border-gray-200"
      }`}
    >
      <div className="p-5 space-y-3 flex-grow">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-bold text-lg text-slate-800 break-words">
              {address.label || "Alamat"}
            </h3>
            {address.is_primary && (
              <span className="flex-shrink-0 bg-orange-100 text-orange-600 text-xs font-bold px-3 py-1 rounded-full">
                Utama
              </span>
            )}
          </div>
        </div>
        <div className="space-y-2 text-slate-600 text-sm">
          <p className="font-medium text-slate-700">{address.recipient_name}</p>
          <p>{address.recipient_phone}</p>
          <p className="leading-relaxed">{address.full_address}</p>
          {address.postal_code && (
            <p className="text-sm text-slate-500">Kode Pos: {address.postal_code}</p>
          )}
        </div>
      </div>
      <div className="flex justify-end items-center space-x-2 p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
        {!address.is_primary && (
          <button
            onClick={onSetPrimary}
            className="text-sm font-medium text-green-600 hover:text-green-800 transition-colors px-3 py-1.5 rounded-md hover:bg-green-50"
          >
            Jadikan Utama
          </button>
        )}
        <button
          onClick={onEdit}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors px-3 py-1.5 rounded-md hover:bg-blue-50"
        >
          Ubah
        </button>
        <button
          onClick={onDelete}
          className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors px-3 py-1.5 rounded-md hover:bg-red-50"
        >
          Hapus
        </button>
      </div>
    </div>
  );
}

export default function AddressSection() {
  const { addresses, fetchAddresses, deleteAddress, addToast } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addressToEdit, setAddressToEdit] = useState<Address | null>(null);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const handleSetPrimary = async (addressId: string) => {
    try {
      const response = await fetch("/api/addresses/set-primary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address_id: addressId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal menjadikan alamat utama.");
      }
      addToast({ type: "success", message: "Alamat utama berhasil diubah." });
      fetchAddresses();
    } catch (error) {
      addToast({ type: "error", message: (error as Error).message });
    }
  };

  const handleAddNew = () => {
    setAddressToEdit(null);
    setIsModalOpen(true);
  };
  const handleEdit = (address: Address) => {
    setAddressToEdit(address);
    setIsModalOpen(true);
  };

  const handleDelete = async (addressId: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus alamat ini?")) {
      try {
        await deleteAddress(addressId);
        addToast({ type: "success", message: "Alamat berhasil dihapus." });
      } catch (error) {
        addToast({ type: "error", message: (error as Error).message });
      }
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4 mb-6">
        <button
          onClick={handleAddNew}
          className="bg-orange-500 text-white px-5 py-2.5 rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium shadow-sm flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Tambah Alamat Baru
        </button>
      </div>

      {addresses.length === 0 ? (
        <div className="bg-white shadow-sm rounded-xl p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-800 mb-1">Belum ada alamat</h3>
          <p className="text-sm text-gray-500 mb-6">
            Tambahkan alamat pertama Anda untuk memudahkan checkout.
          </p>
          <button
            onClick={handleAddNew}
            className="bg-orange-500 text-white px-5 py-2.5 rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium shadow-sm"
          >
            Tambah Alamat Baru
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              onEdit={() => handleEdit(address)}
              onDelete={() => handleDelete(address.id)}
              onSetPrimary={() => handleSetPrimary(address.id)}
            />
          ))}
        </div>
      )}

      <AddressForm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        addressToEdit={addressToEdit}
      />
    </div>
  );
}
