"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { getAnonymousUserId } from "@/lib/anonymous-user";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import type { FoodCourt } from "@/lib/types";

type FormState = {
  peopleCount: string;
  locationNote: string;
  landmarkNote: string;
};

const initialFormState: FormState = {
  peopleCount: "2",
  locationNote: "",
  landmarkNote: ""
};

export default function NewOfferPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;
  const [anonymousUserId, setAnonymousUserId] = useState("");
  const [foodCourt, setFoodCourt] = useState<FoodCourt | null>(null);
  const [form, setForm] = useState<FormState>(initialFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

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

  useEffect(() => {
    setAnonymousUserId(getAnonymousUserId());
    void loadFoodCourt();
  }, [loadFoodCourt]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const peopleCount = Number(form.peopleCount);
    if (!supabase || !foodCourt || !anonymousUserId) {
      setError("投稿に必要な設定が不足しています。");
      return;
    }

    if (!Number.isInteger(peopleCount) || peopleCount <= 0) {
      setError("人数は1人以上で入力してください。");
      return;
    }

    if (!form.locationNote.trim()) {
      setError("場所を入力してください。");
      return;
    }

    setIsSubmitting(true);

    const { error: insertError } = await supabase.from("seat_posts").insert({
      food_court_id: foodCourt.id,
      post_type: "offer",
      people_count: peopleCount,
      location_note: form.locationNote.trim(),
      scheduled_time: null,
      comment: form.landmarkNote.trim() || null,
      anonymous_user_id: anonymousUserId
    });

    setIsSubmitting(false);

    if (insertError) {
      setError("投稿できませんでした。入力内容とSupabaseの設定を確認してください。");
      return;
    }

    router.push(`/f/${slug}`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 px-4 py-5">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-leaf">{foodCourt?.name ?? "SeatSoon"}</p>
          <h1 className="text-2xl font-bold text-ink">席をゆずる</h1>
        </div>
        <Link className="shrink-0 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700" href={`/f/${slug}`}>
          戻る
        </Link>
      </header>

      {!hasSupabaseConfig && (
        <section className="rounded-md border border-coral bg-white p-4 text-sm text-stone-800">
          <p className="font-semibold text-coral">Supabase未設定</p>
          <p className="mt-1">環境変数を設定してください。</p>
        </section>
      )}

      <form className="space-y-4 rounded-md border border-stone-200 bg-white p-4 shadow-sm" onSubmit={handleSubmit}>
        <div className="rounded-md border border-sun bg-yellow-50 p-3 text-sm leading-6 text-stone-800">
          これは席の予約ではありません。金銭のやり取りは禁止です。現地で譲り合って確認してください。
        </div>

        {isLoading ? (
          <p className="text-sm text-stone-600">読み込み中...</p>
        ) : !foodCourt ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">フードコートが見つかりません。</p>
        ) : null}

        <label className="block text-sm font-semibold text-ink">
          人数
          <input
            className="mt-2 w-full rounded-md border border-stone-300 px-3 py-3 text-base outline-none focus:border-leaf focus:ring-2 focus:ring-mint"
            inputMode="numeric"
            min="1"
            type="number"
            value={form.peopleCount}
            onChange={(event) => setForm((current) => ({ ...current, peopleCount: event.target.value }))}
          />
        </label>

        <label className="block text-sm font-semibold text-ink">
          場所
          <input
            className="mt-2 w-full rounded-md border border-stone-300 px-3 py-3 text-base outline-none focus:border-leaf focus:ring-2 focus:ring-mint"
            maxLength={80}
            placeholder="例: マクドナルド前の窓側"
            value={form.locationNote}
            onChange={(event) => setForm((current) => ({ ...current, locationNote: event.target.value }))}
          />
        </label>

        <label className="block text-sm font-semibold text-ink">
          目印
          <input
            className="mt-2 w-full rounded-md border border-stone-300 px-3 py-3 text-base outline-none focus:border-leaf focus:ring-2 focus:ring-mint"
            maxLength={120}
            placeholder="任意: 赤いトレー、ベビーカーあり"
            value={form.landmarkNote}
            onChange={(event) => setForm((current) => ({ ...current, landmarkNote: event.target.value }))}
          />
        </label>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          className="w-full rounded-md bg-leaf px-4 py-3 text-base font-bold text-white disabled:cursor-not-allowed disabled:bg-stone-400"
          disabled={isSubmitting || !hasSupabaseConfig || !foodCourt}
          type="submit"
        >
          {isSubmitting ? "投稿中..." : "10分だけ投稿する"}
        </button>
      </form>
    </main>
  );
}
