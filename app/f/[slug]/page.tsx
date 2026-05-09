"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAnonymousUserId } from "@/lib/anonymous-user";
import { remainingMinutes, shortPostCode } from "@/lib/post-display";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import type { FoodCourt, PostType, SeatMatch, SeatPost } from "@/lib/types";

const refreshIntervalMs = 15_000;
const requestLocationFallback = "指定なし";
const extensionMinutes = 3;
const extensionMs = extensionMinutes * 60_000;

export default function FoodCourtPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [anonymousUserId, setAnonymousUserId] = useState("");
  const [foodCourt, setFoodCourt] = useState<FoodCourt | null>(null);
  const [posts, setPosts] = useState<SeatPost[]>([]);
  const [matches, setMatches] = useState<SeatMatch[]>([]);
  const [activeTab, setActiveTab] = useState<PostType>("offer");
  const [selectedPost, setSelectedPost] = useState<SeatPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMatching, setIsMatching] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const selectedIsOwner = useMemo(
    () => selectedPost?.anonymous_user_id === anonymousUserId,
    [anonymousUserId, selectedPost]
  );
  const offerPosts = useMemo(() => posts.filter((post) => post.post_type === "offer"), [posts]);
  const requestPosts = useMemo(() => posts.filter((post) => post.post_type === "request"), [posts]);
  const activePosts = activeTab === "offer" ? offerPosts : requestPosts;
  const selectedMatch = useMemo(
    () => matches.find((match) => match.offer_post_id === selectedPost?.id && match.status === "pending") ?? null,
    [matches, selectedPost]
  );
  const selectedMatchIsMine = selectedMatch?.matched_by_anonymous_user_id === anonymousUserId;

  const loadFoodCourt = useCallback(async () => {
    if (!supabase || !slug) {
      setIsLoading(false);
      return;
    }

    const { data, error: slugError } = await supabase.from("food_courts").select("*").eq("slug", slug).maybeSingle();

    if (slugError) {
      setError("フードコートを取得できませんでした。");
      setIsLoading(false);
      return;
    }

    if (data) {
      setFoodCourt(data);
      setIsLoading(false);
      return;
    }

    const { data: idData, error: idError } = await supabase.from("food_courts").select("*").eq("id", slug).maybeSingle();

    if (idError) {
      setError("フードコートを取得できませんでした。");
      setIsLoading(false);
      return;
    }

    setFoodCourt(idData);
    setIsLoading(false);
  }, [slug]);

  const loadPosts = useCallback(async () => {
    if (!supabase || !foodCourt) {
      setPosts([]);
      setMatches([]);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("seat_posts")
      .select("*")
      .eq("food_court_id", foodCourt.id)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError("投稿一覧を取得できませんでした。");
      return;
    }

    const activeSeatPosts = data ?? [];
    setPosts(activeSeatPosts);

    const offerPostIds = activeSeatPosts.filter((post) => post.post_type === "offer").map((post) => post.id);
    if (offerPostIds.length === 0) {
      setMatches([]);
      return;
    }

    const { data: matchData, error: matchFetchError } = await supabase
      .from("seat_matches")
      .select("*")
      .in("offer_post_id", offerPostIds)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (matchFetchError) {
      setError("マッチング状況を取得できませんでした。");
      return;
    }

    setMatches(matchData ?? []);
  }, [foodCourt]);

  useEffect(() => {
    setAnonymousUserId(getAnonymousUserId());
    void loadFoodCourt();
  }, [loadFoodCourt]);

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
    setSelectedPost(null);
    await loadPosts();
  }

  async function claimSeat(post: SeatPost) {
    if (!supabase || !foodCourt || !anonymousUserId) {
      setError("マッチングに必要な設定が不足しています。");
      return;
    }

    if (post.anonymous_user_id === anonymousUserId) {
      setError("自分の投稿には向かえません。");
      return;
    }

    setIsMatching(true);
    setError("");
    setMessage("");

    const { error: insertError } = await supabase.from("seat_matches").insert({
      food_court_id: foodCourt.id,
      offer_post_id: post.id,
      matched_by_anonymous_user_id: anonymousUserId
    });

    setIsMatching(false);

    if (insertError) {
      setError("この席へのマッチングを開始できませんでした。すでに誰かが向かっている可能性があります。");
      await loadPosts();
      return;
    }

    setMessage("この席に向かう状態にしました。席を確保できたら記録してください。");
    await loadPosts();
  }

  async function completeMatch(match: SeatMatch) {
    if (!supabase || !selectedPost) {
      return;
    }

    setIsMatching(true);
    setError("");
    setMessage("");

    const completedAt = new Date().toISOString();
    const { error: matchUpdateError } = await supabase
      .from("seat_matches")
      .update({ status: "completed", completed_at: completedAt })
      .eq("id", match.id)
      .eq("matched_by_anonymous_user_id", anonymousUserId);

    if (matchUpdateError) {
      setIsMatching(false);
      setError("席確保を記録できませんでした。");
      return;
    }

    const { error: postUpdateError } = await supabase
      .from("seat_posts")
      .update({ status: "matched" })
      .eq("id", selectedPost.id)
      .eq("status", "active");

    setIsMatching(false);

    if (postUpdateError) {
      setError("席確保は記録しましたが、投稿の終了に失敗しました。");
      await loadPosts();
      return;
    }

    setMessage("席確保を記録しました。ご協力ありがとうございます。");
    setSelectedPost(null);
    await loadPosts();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col bg-[#f7f5ef]">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-[#f7f5ef]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-leaf">{foodCourt?.name ?? "SeatSoon"}</p>
            <h1 className="text-xl font-bold text-ink">席の状況</h1>
          </div>
        </div>
      </header>

      <section className="flex flex-1 flex-col gap-3 px-4 py-3">
        {!hasSupabaseConfig && (
          <div className="rounded-md border border-coral bg-white p-3 text-sm text-stone-800">
            <p className="font-semibold text-coral">Supabase未設定</p>
            <p className="mt-1">環境変数を設定してください。</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            className={`rounded-md border p-3 text-left ${activeTab === "request" ? "border-coral bg-white shadow-sm" : "border-stone-200 bg-stone-50"}`}
            onClick={() => setActiveTab("request")}
            type="button"
          >
            <p className="text-xs font-bold text-coral">席探してます</p>
            <p className="mt-1 text-2xl font-bold text-ink">{requestPosts.length}組</p>
          </button>
          <button
            className={`rounded-md border p-3 text-left ${activeTab === "offer" ? "border-leaf bg-white shadow-sm" : "border-stone-200 bg-stone-50"}`}
            onClick={() => setActiveTab("offer")}
            type="button"
          >
            <p className="text-xs font-bold text-leaf">席譲ります</p>
            <p className="mt-1 text-2xl font-bold text-ink">{offerPosts.length}件</p>
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-stone-600">{activeTab === "offer" ? "空きそうな席" : "席を探している人"}</p>
          <button className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700" onClick={() => void loadPosts()} type="button">
            更新
          </button>
        </div>

        <Link
          className={`block rounded-md px-4 py-3 text-center text-base font-bold text-white ${activeTab === "offer" ? "bg-leaf" : "bg-coral"}`}
          href={`/f/${slug}/new?type=${activeTab}`}
        >
          {activeTab === "offer" ? "席を譲る投稿" : "席を探す投稿"}
        </Link>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {message && <p className="rounded-md bg-mint px-3 py-2 text-sm text-leaf">{message}</p>}

        {isLoading ? (
          <div className="rounded-md bg-white p-6 text-center text-sm text-stone-600">読み込み中...</div>
        ) : !foodCourt ? (
          <div className="rounded-md bg-white p-6 text-center text-sm text-stone-600">フードコートが見つかりません。</div>
        ) : activePosts.length === 0 ? (
          <div className="rounded-md border border-dashed border-stone-300 bg-white p-6 text-center">
            <p className="font-bold text-ink">{activeTab === "offer" ? "いま表示できる席はありません" : "席を探している人はいません"}</p>
            <p className="mt-2 text-sm text-stone-600">
              {activeTab === "offer" ? "席を空ける人の投稿が入るとここに表示されます。" : "席を探している人が投稿するとここに表示されます。"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activePosts.map((post) => {
              const isOwner = post.anonymous_user_id === anonymousUserId;
              const isOffer = post.post_type === "offer";
              const locationText = post.location_note === requestLocationFallback ? "希望エリアなし" : post.location_note;
              const pendingMatch = matches.find((match) => match.offer_post_id === post.id && match.status === "pending");
              const isMyPendingMatch = pendingMatch?.matched_by_anonymous_user_id === anonymousUserId;
              return (
                <button
                  className="w-full rounded-md border border-stone-200 bg-white p-3 text-left shadow-sm"
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-xs font-bold ${isOffer ? "text-leaf" : "text-coral"}`}>#{shortPostCode(post.id)}</p>
                      <p className="mt-1 truncate text-lg font-bold text-ink">{locationText}</p>
                      {post.comment && <p className="mt-1 line-clamp-1 text-sm text-stone-600">{isOffer ? "目印" : "メモ"}: {post.comment}</p>}
                    </div>
                    <div className="shrink-0 rounded-md bg-stone-100 px-3 py-2 text-right text-sm text-stone-700">
                      <p>{post.people_count}人</p>
                      <p>約{remainingMinutes(post.expires_at, now)}分</p>
                    </div>
                  </div>
                  {isOwner && <p className="mt-2 text-xs font-semibold text-coral">自分の投稿</p>}
                  {isOffer && pendingMatch && (
                    <p className={`mt-2 text-xs font-semibold ${isMyPendingMatch ? "text-leaf" : "text-stone-600"}`}>
                      {isMyPendingMatch ? "自分が向かっています" : "誰かが向かっています"}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedPost && (
        <div className="fixed inset-0 z-20 flex items-end bg-black/35 px-3 pb-3" onClick={() => setSelectedPost(null)}>
          <section className="w-full rounded-md bg-white p-4 shadow-lg" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-sm font-bold ${selectedPost.post_type === "offer" ? "text-leaf" : "text-coral"}`}>
                  {selectedPost.post_type === "offer" ? "席譲ります" : "席探してます"} #{shortPostCode(selectedPost.id)}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-ink">
                  {selectedPost.location_note === requestLocationFallback ? "希望エリアなし" : selectedPost.location_note}
                </h2>
              </div>
              <button className="rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700" onClick={() => setSelectedPost(null)} type="button">
                閉じる
              </button>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-stone-50 p-3">
                <dt className="font-semibold text-stone-500">人数</dt>
                <dd className="mt-1 text-lg font-bold text-ink">{selectedPost.people_count}人</dd>
              </div>
              <div className="rounded-md bg-stone-50 p-3">
                <dt className="font-semibold text-stone-500">残り</dt>
                <dd className="mt-1 text-lg font-bold text-ink">約{remainingMinutes(selectedPost.expires_at, now)}分</dd>
              </div>
            </dl>

            {selectedPost.comment && (
              <div className="mt-3 rounded-md bg-mint p-3 text-sm text-ink">
                <p className="font-semibold">{selectedPost.post_type === "offer" ? "目印" : "メモ"}</p>
                <p className="mt-1">{selectedPost.comment}</p>
              </div>
            )}

            <p className="mt-3 rounded-md bg-yellow-50 p-3 text-sm leading-6 text-stone-800">
              この投稿は席の予約ではありません。現地で譲り合って確認してください。
            </p>

            {selectedPost.post_type === "offer" && (
              <div className="mt-3 space-y-3">
                <p className="text-sm font-semibold text-stone-700">声かけ例: SeatSoonの #{shortPostCode(selectedPost.id)} を見ました。</p>
                {!selectedIsOwner && !selectedMatch && (
                  <button
                    className="w-full rounded-md bg-leaf px-3 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-stone-400"
                    disabled={isMatching}
                    onClick={() => void claimSeat(selectedPost)}
                    type="button"
                  >
                    {isMatching ? "記録中..." : "この席に向かう"}
                  </button>
                )}
                {!selectedIsOwner && selectedMatch && !selectedMatchIsMine && (
                  <p className="rounded-md bg-stone-100 p-3 text-sm font-semibold text-stone-700">誰かがこの席に向かっています。</p>
                )}
                {!selectedIsOwner && selectedMatchIsMine && selectedMatch && (
                  <div className="space-y-2 rounded-md border border-leaf bg-mint p-3">
                    <p className="text-sm font-semibold text-leaf">この席に向かっています。確保できたら記録してください。</p>
                    <button
                      className="w-full rounded-md bg-leaf px-3 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-stone-400"
                      disabled={isMatching}
                      onClick={() => void completeMatch(selectedMatch)}
                      type="button"
                    >
                      {isMatching ? "記録中..." : "席を確保できた"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {selectedIsOwner && (
              <div className="mt-4 grid grid-cols-1 gap-2">
                {selectedPost.post_type === "offer" && selectedMatch && (
                  <p className="rounded-md bg-mint p-3 text-sm font-semibold text-leaf">席を探している人が向かっています。</p>
                )}
                <button
                  className="rounded-md border border-leaf bg-white px-3 py-3 text-sm font-semibold text-leaf"
                  onClick={() => {
                    const currentExpiresAt = new Date(selectedPost.expires_at).getTime();
                    const baseTime = Math.max(currentExpiresAt, Date.now());
                    void updatePost(selectedPost.id, { expires_at: new Date(baseTime + extensionMs).toISOString() });
                  }}
                  type="button"
                >
                  {selectedPost.post_type === "offer" ? `まだ譲れます（+${extensionMinutes}分）` : `まだ探しています（+${extensionMinutes}分）`}
                </button>
                <button
                  className="rounded-md bg-stone-900 px-3 py-3 text-sm font-semibold text-white"
                  onClick={() => void updatePost(selectedPost.id, { status: "matched" })}
                  type="button"
                >
                  投稿を終了
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
