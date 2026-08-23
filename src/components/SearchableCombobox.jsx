// src/components/SearchableCombobox.jsx
// Dropdown dengan pencarian internal — pengganti <select> untuk daftar opsi panjang
// (kategori 300+, merek 200+, tipe motor 159). Tanpa dependensi baru.

import { useState, useRef, useEffect, useMemo } from "react";
import { FiChevronDown, FiCheck, FiX, FiSearch } from "react-icons/fi";

const SearchableCombobox = ({
    id,
    options = [], // [{ value: string, label: string }]
    value,
    onChange,
    placeholder = "Pilih...",
    searchPlaceholder = "Cari...",
    emptyMessage = "Tidak ditemukan",
    onClear,
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [highlightIndex, setHighlightIndex] = useState(0);
    const rootRef = useRef(null);
    const searchInputRef = useRef(null);
    const listRef = useRef(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter((o) => o.label.toLowerCase().includes(q));
    }, [options, query]);

    const selected =
        options.find((o) => String(o.value) === String(value)) || null;

    // Tutup panel saat klik di luar komponen
    useEffect(() => {
        if (!open) return undefined;
        const handleDocMouseDown = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleDocMouseDown);
        return () =>
            document.removeEventListener("mousedown", handleDocMouseDown);
    }, [open]);

    // Reset pencarian & highlight tiap kali panel dibuka + fokuskan input
    useEffect(() => {
        if (open) {
            setQuery("");
            requestAnimationFrame(() => searchInputRef.current?.focus());
        }
    }, [open]);

    // Highlight kembali ke atas saat query berubah
    useEffect(() => {
        setHighlightIndex(0);
    }, [query]);

    // Pastikan opsi ter-highlight selalu terlihat
    useEffect(() => {
        if (!open) return;
        const el = listRef.current?.querySelector(
            `[data-idx="${highlightIndex}"]`,
        );
        el?.scrollIntoView({ block: "nearest" });
    }, [highlightIndex, open]);

    const selectValue = (val) => {
        onChange(val);
        setOpen(false);
    };

    const handleKeyDown = (e) => {
        if (!open) {
            if (
                e.key === "Enter" ||
                e.key === " " ||
                e.key === "ArrowDown"
            ) {
                e.preventDefault();
                setOpen(true);
            }
            return;
        }
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setHighlightIndex((i) =>
                    Math.min(i + 1, Math.max(filtered.length - 1, 0)),
                );
                break;
            case "ArrowUp":
                e.preventDefault();
                setHighlightIndex((i) => Math.max(i - 1, 0));
                break;
            case "Home":
                e.preventDefault();
                setHighlightIndex(0);
                break;
            case "End":
                e.preventDefault();
                setHighlightIndex(Math.max(filtered.length - 1, 0));
                break;
            case "Enter":
                e.preventDefault();
                if (filtered[highlightIndex]) {
                    selectValue(filtered[highlightIndex].value);
                }
                break;
            case "Escape":
                e.preventDefault();
                setOpen(false);
                break;
            case "Tab":
                setOpen(false);
                break;
            default:
                break;
        }
    };

    return (
        <div className="relative" ref={rootRef} onKeyDown={handleKeyDown}>
            {/* Trigger — tampilan menyerupai <select> lama */}
            <button
                type="button"
                id={id}
                role="combobox"
                aria-expanded={open}
                aria-controls={id ? `${id}-listbox` : undefined}
                aria-haspopup="listbox"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-2 p-2 border rounded-lg bg-white text-sm text-left hover:border-slate-400 focus:outline-none focus:border-orange-500"
            >
                <span
                    className={`truncate ${
                        selected ? "text-slate-800" : "text-slate-500"
                    }`}
                >
                    {selected ? selected.label : placeholder}
                </span>
                {onClear && selected ? (
                    <span
                        role="button"
                        tabIndex={-1}
                        aria-label="Kosongkan pilihan"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClear();
                        }}
                        className="shrink-0 p-0.5 text-slate-400 hover:text-red-500"
                    >
                        <FiX size={16} />
                    </span>
                ) : (
                    <FiChevronDown
                        size={16}
                        className={`shrink-0 text-slate-400 transition-transform ${
                            open ? "rotate-180" : ""
                        }`}
                    />
                )}
            </button>

            {open && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 overflow-hidden">
                    <div className="p-2 border-b relative">
                        <FiSearch
                            size={14}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={searchPlaceholder}
                            className="w-full pl-7 pr-2 py-1.5 border rounded-md text-sm focus:outline-none focus:border-orange-500"
                        />
                    </div>
                    <ul
                        id={id ? `${id}-listbox` : undefined}
                        role="listbox"
                        ref={listRef}
                        className="max-h-64 overflow-y-auto"
                    >
                        {filtered.length === 0 && (
                            <li className="px-3 py-6 text-center text-sm text-slate-400">
                                {emptyMessage}
                            </li>
                        )}
                        {filtered.map((o, idx) => {
                            const isSel =
                                String(o.value) === String(value);
                            const isHi = idx === highlightIndex;
                            return (
                                <li
                                    key={String(o.value)}
                                    role="option"
                                    aria-selected={isSel}
                                    data-idx={idx}
                                    onMouseEnter={() => setHighlightIndex(idx)}
                                    onClick={() => selectValue(o.value)}
                                    className={`flex items-center justify-between gap-2 px-3 py-2.5 text-sm cursor-pointer ${
                                        isHi ? "bg-orange-50" : ""
                                    } ${
                                        isSel
                                            ? "text-orange-700 font-medium"
                                            : "text-slate-700"
                                    }`}
                                >
                                    <span className="truncate">{o.label}</span>
                                    {isSel && (
                                        <FiCheck
                                            size={16}
                                            className="text-orange-500 shrink-0"
                                        />
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SearchableCombobox;
