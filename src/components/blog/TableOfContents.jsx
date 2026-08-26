// TableOfContents.jsx — Sticky sidebar TOC untuk artikel blog
import React, { useState, useEffect } from "react";

const TableOfContents = () => {
  const [headings, setHeadings] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const content = document.getElementById("article-content");
    if (!content) return;

    const elements = content.querySelectorAll("h2, h3");
    const items = Array.from(elements).map((el) => {
      if (!el.id) {
        el.id = el.textContent
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
      }
      return {
        id: el.id,
        text: el.textContent,
        level: el.tagName === "H2" ? 2 : 3,
      };
    });

    setHeadings(items);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  if (headings.length === 0) return null;

  const visibleHeadings = isExpanded ? headings : headings.slice(0, 8);

  return (
    <nav aria-label="Daftar isi" className="sticky top-24">
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
        Daftar Isi
      </h4>
      <ul className="space-y-1">
        {visibleHeadings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`block text-sm leading-snug py-1 transition-colors duration-150 border-l-2 pl-3 ${
                h.level === 3 ? "ml-3" : ""
              } ${
                activeId === h.id
                  ? "border-orange-500 text-orange-600 font-medium"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
      {headings.length > 8 && !isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="text-xs text-orange-600 hover:text-orange-700 font-medium mt-2 pl-3 cursor-pointer"
        >
          Tampilkan semua ({headings.length}) →
        </button>
      )}
    </nav>
  );
};

export default TableOfContents;
