// src/components/feed/CommentSection.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseBrowserClient";

const CommentSection = ({ postId }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState(null);
  const [loginHref, setLoginHref] = useState("/login");

  useEffect(() => {
    fetchComments();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
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
