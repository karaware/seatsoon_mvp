"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getAnonymousUserId } from "@/lib/anonymous-user";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import type { FoodCourt, PostType, SeatPost } from "@/lib/types";

const scheduledTimeOptions = ["今すぐ", "5分以内", "10分以内", "15分以内"];
const refreshIntervalMs = 20_000;

type FormState = {
  postType: PostType;
  peopleCount: string;
  locationNote: string;
  scheduledTime: string;
  comment: string;
};

const initialFormState: FormState = {
  postType: "offer",
  peopleCount: "2",
  locationNote: "",
  scheduledTime: scheduledTimeOptions[1],
  comment: ""
};

export default function Home() {
  const [anonymousUserId, setAnonymousUserId] = useState("");
  const [foodCourts, setFoodCourts] = useState<FoodCourt[]>([]);
  const [selectedFoodCourtId, setSelectedFoodCourtId] = useState("");
  const [posts, setPosts] = useState<SeatPost[]>([]);
  const [form, setForm] = useState<FormState>(initialFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const selectedFoodCourt = useMemo(
    () => foodCourts.find((foodCourt) => foodCourt.id === selectedFoodCourtId),
    [foodCourts, selectedFoodCourtId]
  );

  const loadFoodCourts = useCallback(async () => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("food_courts")
      .select("*")
      .order("created_at", { ascending: true });

    if (fetchError) {
      setError("フードコートを取得できませんでした。Supabaseの設定を確認してください。");
      setIsLoading(false);
      return;
    }

    setFoodCourts(data ?? []);
    setSelectedFoodCourtId((current) => current || data?.[0]?.id || "");
    setIsLoading(false);
  }, []);

  const loadPosts = useCallback(async () => {
    if (!supabase || !selectedFoodCourtId) {
      setPosts([]);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("seat_posts")
      .select("*")
      .eq("food_court_id", selectedFoodCourtId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError("投稿一覧を取得できませんでした。");
      return;
    }

    setPosts(data ?? []);
  }, [selectedFoodCourtId]);

  useEffect(() => {
    setAnonymousUserId(getAnonymousUserId());
    void loadFoodCourts();
  }, [loadFoodCourts]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
      void loadPosts();
    }, refreshIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [loadPosts]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const peopleCount = Number(form.peopleCount);
    if (!supabase || !selectedFoodCourtId || !anonymousUserId) {
      setError("投稿に必要な設定が不足しています。");
      return;
    }

    if (!Number.isInteger(peopleCount) || peopleCount <= 0) {
      setError("人数は1人以上で入力してください。");
      return;
    }

    if (!form.locationNote.trim()) {
      setError("場所メモを入力してください。");
      return;
    }

    setIsSubmitting(true);

    const { error: insertError } = await supabase.from("seat_posts").insert({
      food_court_id: selectedFoodCourtId,
      post_type: form.postType,
      people_count: peopleCount,
      location_note: form.locationNote.trim(),
      scheduled_time: form.scheduledTime,
      comment: form.comment.trim() || null,
      anonymous_user_id: anonymousUserId
    });

    setIsSubmitting(false);

    if (insertError) {
      setError("投稿できませんでした。入力内容とSupabaseの設定を確認してください。");
      return;
    }

    setForm(initialFormState);
    setMessage("投稿しました。10分間だけ一覧に表示されます。");
    await loadPosts();
  }

  async function updatePost(postId: string, update: { status?: "matched" | "cancelled"; expires_at?: string }) {
    if (!supabase) {
      return;
    }

    setError("");
    setMessage("");

    const { error: updateError } = await supabase
      .from("seat_posts")
      .update(update)
      .eq("id", postId)
      .eq("anonymous_user_id", anonymousUserId);

    if (updateError) {
      setError("投稿を更新できませんでした。");
      return;
    }

    setMessage("投稿を更新しました。");
    await loadPosts();
  }

  function remainingMinutes(expiresAt: string) {
    const diffMs = new Date(expiresAt).getTime() - now;
    return Math.max(0, Math.ceil(diffMs / 60_000));
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-5 sm:px-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-leaf">SeatSoon MVP</p>
        <h1 className="text-3xl font-bold leading-tight text-ink">席ゆずり情報</h1>
        <p className="text-sm leading-6 text-stone-700">
          混雑したフードコートで、もうすぐ空く席や探している席の情報を10分だけ共有します。
        </p>
      </header>

      {!hasSupabaseConfig && (
        <section className="rounded-md border border-coral bg-white p-4 text-sm text-stone-800">
          <p className="font-semibold text-coral">Supabase未設定</p>
          <p className="mt-1">`.env.local` に `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定してください。</p>
        </section>
      )}

      <section className="rounded-md border border-stone-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-semibold text-ink" htmlFor="food-court">
          フードコート
        </label>
        <select
          id="food-court"
          className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-3 text-base outline-none focus:border-leaf focus:ring-2 focus:ring-mint"
          value={selectedFoodCourtId}
          onChange={(event) => setSelectedFoodCourtId(event.target.value)}
          disabled={isLoading || foodCourts.length === 0}
        >
          {foodCourts.length === 0 ? (
            <option value="">フードコートがありません</option>
          ) : (
            foodCourts.map((foodCourt) => (
              <option key={foodCourt.id} value={foodCourt.id}>
                {foodCourt.name}
                {foodCourt.area ? ` / ${foodCourt.area}` : ""}
              </option>
            ))
          )}
        </select>
      </section>

      <section className="rounded-md border border-stone-200 bg-white p-4 shadow-sm">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="rounded-md border border-sun bg-yellow-50 p-3 text-sm leading-6 text-stone-800">
            これは席の予約ではありません。施設公式サービスではなく、席の確保や優先権は保証しません。金銭のやり取りは禁止です。
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`rounded-md border px-3 py-3 text-sm font-semibold ${
                form.postType === "offer" ? "border-leaf bg-mint text-leaf" : "border-stone-300 bg-white text-stone-700"
              }`}
              onClick={() => setForm((current) => ({ ...current, postType: "offer" }))}
            >
              席ゆずります
            </button>
            <button
              type="button"
              className={`rounded-md border px-3 py-3 text-sm font-semibold ${
                form.postType === "request" ? "border-leaf bg-mint text-leaf" : "border-stone-300 bg-white text-stone-700"
              }`}
              onClick={() => setForm((current) => ({ ...current, postType: "request" }))}
            >
              席さがしてます
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-ink">
              人数
              <input
                className="mt-2 w-full rounded-md border border-stone-300 px-3 py-3 text-base outline-none focus:border-leaf focus:ring-2 focus:ring-mint"
                min="1"
                inputMode="numeric"
                type="number"
                value={form.peopleCount}
                onChange={(event) => setForm((current) => ({ ...current, peopleCount: event.target.value }))}
              />
            </label>

            <label className="text-sm font-semibold text-ink">
              予定時間
              <select
                className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-3 text-base outline-none focus:border-leaf focus:ring-2 focus:ring-mint"
                value={form.scheduledTime}
                onChange={(event) => setForm((current) => ({ ...current, scheduledTime: event.target.value }))}
              >
                {scheduledTimeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm font-semibold text-ink">
            場所メモ
            <input
              className="mt-2 w-full rounded-md border border-stone-300 px-3 py-3 text-base outline-none focus:border-leaf focus:ring-2 focus:ring-mint"
              maxLength={80}
              placeholder="例: マクドナルド前、窓側、中央エリア"
              value={form.locationNote}
              onChange={(event) => setForm((current) => ({ ...current, locationNote: event.target.value }))}
            />
          </label>

          <label className="block text-sm font-semibold text-ink">
            コメント
            <textarea
              className="mt-2 min-h-24 w-full resize-y rounded-md border border-stone-300 px-3 py-3 text-base outline-none focus:border-leaf focus:ring-2 focus:ring-mint"
              maxLength={160}
              placeholder="任意: ベビーカーあり、4人席希望など"
              value={form.comment}
              onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))}
            />
          </label>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {message && <p className="rounded-md bg-mint px-3 py-2 text-sm text-leaf">{message}</p>}

          <button
            className="w-full rounded-md bg-leaf px-4 py-3 text-base font-bold text-white disabled:cursor-not-allowed disabled:bg-stone-400"
            type="submit"
            disabled={isSubmitting || !hasSupabaseConfig || !selectedFoodCourtId}
          >
            {isSubmitting ? "投稿中..." : "投稿する"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink">有効な投稿</h2>
            <p className="text-sm text-stone-600">{selectedFoodCourt?.name ?? "フードコート未選択"}</p>
          </div>
          <button
            type="button"
            className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700"
            onClick={() => void loadPosts()}
          >
            更新
          </button>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-md border border-dashed border-stone-300 bg-white p-6 text-center text-sm text-stone-600">
            いま表示できる投稿はありません。
          </div>
        ) : (
          posts.map((post) => {
            const isOwner = post.anonymous_user_id === anonymousUserId;
            return (
              <article key={post.id} className="rounded-md border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={`text-sm font-bold ${post.post_type === "offer" ? "text-leaf" : "text-coral"}`}>
                      {post.post_type === "offer" ? "席ゆずります" : "席さがしてます"}
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-ink">{post.location_note}</h3>
                  </div>
                  <div className="rounded-md bg-stone-100 px-3 py-2 text-right text-sm text-stone-700">
                    <p>{post.people_count}人</p>
                    <p>残り約{remainingMinutes(post.expires_at)}分</p>
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-1 gap-2 text-sm text-stone-700 sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-stone-500">予定時間</dt>
                    <dd>{post.scheduled_time || "未設定"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-stone-500">コメント</dt>
                    <dd>{post.comment || "なし"}</dd>
                  </div>
                </dl>

                {isOwner && (
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      className="rounded-md border border-leaf bg-white px-3 py-2 text-sm font-semibold text-leaf"
                      onClick={() =>
                        void updatePost(post.id, {
                          expires_at: new Date(Date.now() + 10 * 60_000).toISOString()
                        })
                      }
                    >
                      まだ有効
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-stone-300 bg-stone-900 px-3 py-2 text-sm font-semibold text-white"
                      onClick={() => void updatePost(post.id, { status: "matched" })}
                    >
                      マッチしました
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-coral bg-white px-3 py-2 text-sm font-semibold text-coral"
                      onClick={() => void updatePost(post.id, { status: "cancelled" })}
                    >
                      取り下げ
                    </button>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
