// CommentSection.jsx — Komentar artikel dengan avatar & empty state yang lebih baik
import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseBrowserClient";

const getInitials = (name) => {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
};

const getAvatarColor = (name) => {
  if (!name) return "bg-slate-300";
  const colors = [
    "bg-orange-500", "bg-blue-500", "bg-emerald-500",
    "bg-violet-500", "bg-rose-500", "bg-amber-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

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
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();
        setIsAdmin(["admin", "owner"].includes(profile?.role));
      }
    });
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
    <div className="bg-white rounded-xl border border-slate-100 p-5 md:p-6" id="komentar">
      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Komentar
      </h3>

      {user && (
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1">
              {getInitials(user.email)}
            </div>
            <div className="flex-1">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Tulis komentar..."
                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                rows={3}
              />
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={submitting || !content.trim()}
                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold py-2 px-5 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {submitting ? "Mengirim..." : "Kirim"}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {!user && !loading && (
        <a
          href={loginHref}
          className="inline-flex items-center gap-2 mb-6 text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
          Masuk untuk berkomentar
        </a>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-9 h-9 bg-slate-200 rounded-full flex-shrink-0" />
              <div className="flex-1">
                <div className="h-3 bg-slate-200 rounded w-24 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-full mb-1" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8">
          <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm text-slate-400">Belum ada komentar.</p>
          <p className="text-xs text-slate-300 mt-1">Jadilah yang pertama berkomentar!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => {
            const name = c.customers?.nama_pelanggan || "Anonim";
            return (
              <div key={c.id} className="flex gap-3 group">
                <div className={`w-9 h-9 rounded-full ${getAvatarColor(name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {getInitials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-slate-800">{name}</span>
                    <span className="text-xs text-slate-400">
                      {new Date(c.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        aria-label="Hapus komentar"
                        title="Hapus permanen"
                        className="ml-auto opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{c.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CommentSection;
