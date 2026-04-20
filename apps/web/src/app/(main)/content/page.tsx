"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { ARTICLES, CATEGORIES } from "@/lib/content/articles";

const CATEGORY_COLORS: Record<string, string> = {
  기초: "var(--element-earth)",
  궁합: "var(--brand-red)",
  건강: "var(--element-wood)",
  연애: "var(--element-fire)",
};

export default function ContentPage() {
  const router = useRouter();
  const [category, setCategory] = useState("전체");

  const filtered = category === "전체" ? ARTICLES : ARTICLES.filter(a => a.category === category);

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)]">
            궁합 콘텐츠
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            사주명리학을 쉽게 배워보세요
          </p>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                category === cat
                  ? "bg-[var(--brand-red)] text-white"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map((article) => (
            <Card
              key={article.slug}
              className="border-none shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/content/${article.slug}`)}
            >
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[article.category] || "var(--muted-foreground)" }}
                  />
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: CATEGORY_COLORS[article.category] }}>
                      {article.category}
                    </p>
                    <h3 className="font-[family-name:var(--font-serif)] text-base font-bold text-[var(--foreground)]">
                      {article.title}
                    </h3>
                    <p className="text-sm text-[var(--muted-foreground)] mt-1 leading-relaxed">
                      {article.summary}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
