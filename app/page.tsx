"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import type { FoodCourt } from "@/lib/types";

export default function Home() {
  const [foodCourts, setFoodCourts] = useState<FoodCourt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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
      setError("フードコートを取得できませんでした。");
      setIsLoading(false);
      return;
    }

    setFoodCourts(data ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadFoodCourts();
  }, [loadFoodCourts]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-5 px-4 py-5">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-leaf">SeatSoon</p>
        <h1 className="text-3xl font-bold leading-tight text-ink">フードコートを選択</h1>
        <p className="text-sm leading-6 text-stone-700">実地検証ではQRコードから施設別URLへ直接アクセスします。</p>
      </header>

      {!hasSupabaseConfig && (
        <section className="rounded-md border border-coral bg-white p-4 text-sm text-stone-800">
          <p className="font-semibold text-coral">Supabase未設定</p>
          <p className="mt-1">`.env.local` にSupabase接続情報を設定してください。</p>
        </section>
      )}

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="space-y-2">
        {isLoading ? (
          <p className="rounded-md bg-white p-4 text-sm text-stone-600">読み込み中...</p>
        ) : foodCourts.length === 0 ? (
          <p className="rounded-md bg-white p-4 text-sm text-stone-600">フードコートがありません。</p>
        ) : (
          foodCourts.map((foodCourt) => (
            <Link
              className="block rounded-md border border-stone-200 bg-white p-4 shadow-sm"
              href={`/f/${foodCourt.slug ?? foodCourt.id}`}
              key={foodCourt.id}
            >
              <p className="text-lg font-bold text-ink">{foodCourt.name}</p>
              {foodCourt.area && <p className="mt-1 text-sm text-stone-600">{foodCourt.area}</p>}
            </Link>
          ))
        )}
      </section>
    </main>
  );
}
