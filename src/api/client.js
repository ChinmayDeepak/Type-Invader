import { requireSupabase } from "./supabase.js";

export async function rpc(name, args = {}) {
  const { data, error } = await requireSupabase().rpc(name, args);
  if (error) {
    const message = error.code === "PGRST202" || error.code === "42P01"
      ? "Database setup is incomplete. Run supabase/schema.sql in the Supabase SQL Editor."
      : error.message?.includes("fetch")
      ? "Cannot reach Supabase. Check your internet connection and whether the project is paused."
      : error.message || "Request failed. Please try again.";
    throw new Error(message);
  }
  // Return rejected results, not SQL exceptions, so the audit row commits.
  if (data?.error) throw new Error(data.error);
  return data;
}
export const api = {
  register: async ({ username, email, password }) => {
    const { data, error } = await requireSupabase().auth.signUp({
      email: email.trim(), password,
      options: { data: { username: username.trim() }, emailRedirectTo: window.location.origin + "/login" },
    });
    if (error) throw error;
    return data;
  },
  login: async ({ email, password }) => {
    const { data, error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    return data;
  },
  me: () => rpc("ti_me"),
  createRun: () => rpc("ti_start_run"),
  completeRun: (id, result) => rpc("ti_finish_run", { p_run_id: id, p_result: result }),
  history: (page = 0, size = 20) => rpc("ti_history", { p_page: page, p_size: size }),
  stats: () => rpc("ti_player_stats"),
  words: () => rpc("ti_words"),
  leaderboard: async (page = 0, size = 20, minStage) =>
    (await api.leaderboardPage({ page, size, minStage })).rows,
  leaderboardPage: (f = {}) => rpc("ti_leaderboard", {
    p_page: Number(f.page || 0), p_size: Number(f.size || 20),
    p_min_stage: f.minStage ? Number(f.minStage) : null,
    p_difficulty: f.difficulty || null, p_search: f.search || "", p_sort: f.sort || "score",
  }),
  adminStats: () => rpc("ti_admin_stats"),
  wordPacks: () => rpc("ti_admin_packs"),
  createPack: (pack) => rpc("ti_save_pack", { p_id: null, p_pack: pack }),
  updatePack: (id, pack) => rpc("ti_save_pack", { p_id: id, p_pack: pack }),
  deletePack: (id) => rpc("ti_delete_pack", { p_id: id }),
  users: () => rpc("ti_admin_users"),
  updateUser: (id, patch) => rpc("ti_suspend_user", { p_user_id: id, p_banned: patch.banned }),
};
