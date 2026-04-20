"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname || !gender) return;

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      nickname,
      gender,
      birth_date: "2000-01-01", // 임시 — 온보딩에서 입력
    });

    if (error) {
      console.error("Profile creation error:", error);
      setLoading(false);
      return;
    }

    router.push("/saju-input");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <Card className="w-full max-w-sm border-none shadow-lg">
        <CardHeader className="text-center">
          <h1 className="font-[family-name:var(--font-serif)] text-3xl text-[var(--brand-red)]">
            기본 정보
          </h1>
          <CardTitle className="mt-1 text-sm text-[var(--muted-foreground)]">
            매칭에 사용할 기본 정보를 입력해주세요
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">닉네임</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="닉네임을 입력하세요"
                className="w-full rounded-lg border border-[var(--border)] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-gold)]"
                maxLength={10}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">성별</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setGender("male")}
                  className={`rounded-lg border px-4 py-3 text-sm transition-colors ${
                    gender === "male"
                      ? "border-[var(--brand-red)] bg-[var(--brand-red)] text-white"
                      : "border-[var(--border)] hover:border-[var(--brand-gold)]"
                  }`}
                >
                  남성
                </button>
                <button
                  type="button"
                  onClick={() => setGender("female")}
                  className={`rounded-lg border px-4 py-3 text-sm transition-colors ${
                    gender === "female"
                      ? "border-[var(--brand-red)] bg-[var(--brand-red)] text-white"
                      : "border-[var(--border)] hover:border-[var(--brand-gold)]"
                  }`}
                >
                  여성
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={!nickname || !gender || loading}
              className="w-full bg-[var(--brand-red)] hover:bg-[var(--brand-red)]/90 text-white py-6"
            >
              {loading ? "처리 중..." : "다음"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
