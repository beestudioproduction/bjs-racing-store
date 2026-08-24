// src/components/feed/CommentSection.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseBrowserClient";

const CommentSection = ({ postId }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginHref, setLoginHref] = useState("/login");

  useEffect(() => {
    fetchComments();
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      // Hanya role admin/owner yang boleh menghapus komentar siapa pun
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();
        setIsAdmin(["admin", "owner"].includes(profile?.role));
      }
    });
    // Pengunjung anonim diarahkan ke login lalu kembali ke artikel ini
    setLoginHref(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
  }, [postId]);

  const fetchComments = async () => {
    const { data } = await supabase
      .from("feed_comments")
      .select("*, customers(nama_pelanggan)")
      .eq("post_id", postId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    setComments(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);

    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!customer) {
      alert("Profil customer tidak ditemukan.");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("feed_comments").insert({
      post_id: postId,
      customer_id: customer.id,
      content: content.trim(),
    });

    if (error) {
      alert("Gagal mengirim komentar: " + error.message);
    } else {
      setContent("");
      fetchComments();
    }
    setSubmitting(false);
  };

  // Hard delete: baris komentar dihapus permanen dari database.
  // Kebijakan RLS hanya mengizinkan role admin/owner.
  const handleDelete = async (commentId) => {
    if (!window.confirm("Hapus komentar ini secara permanen?")) return;
    const { error } = await supabase
      .from("feed_comments")
      .delete()
      .eq("id", commentId);
    if (error) {
      alert("Gagal menghapus komentar: " + error.message);
      return;
    }
    fetchComments();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-lg font-bold text-slate-800 mb-4">Komentar</h3>

      {user && (
        <form onSubmit={handleSubmit} className="mb-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tulis komentar..."
            className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            rows={3}
          />
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="mt-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors"
          >
            {submitting ? "Mengirim..." : "Kirim Komentar"}
          </button>
        </form>
      )}

      {!user && !loading && (
        <a
          href={loginHref}
          className="inline-block mb-6 text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors"
        >
          Masuk untuk berkomentar →
        </a>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Memuat komentar...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada komentar. Jadilah yang pertama!</p>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="border-b border-slate-100 pb-4 last:border-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-slate-800">
                  {c.customers?.nama_pelanggan || "Anonim"}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(c.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    aria-label="Hapus komentar"
                    title="Hapus permanen"
                    className="ml-auto text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="text-sm text-slate-600">{c.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentSection;
