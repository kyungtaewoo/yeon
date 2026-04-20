import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const features = [
  {
    title: "역방향 매칭",
    description:
      "내 사주를 분석하여 가장 잘 맞는 상대의 사주를 먼저 찾아냅니다. 운명이 맞는 사람만 매칭됩니다.",
    icon: "🔄",
  },
  {
    title: "사주명리 분석",
    description:
      "전통 사주명리학의 합(合)·충(沖)·오행 상생상극을 기반으로 연애·결혼·재물·건강 궁합을 종합 분석합니다.",
    icon: "📊",
  },
  {
    title: "운명의 서사",
    description:
      "단순 점수가 아닌, 두 사람의 사주가 만들어내는 스토리를 들려드립니다. 왜 맞는지, 어떤 시너지가 있는지.",
    icon: "📖",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)]">
      {/* 상단 네비 */}
      <div className="px-4 pt-4">
        <Link href="/home" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          &larr; 홈으로
        </Link>
      </div>

      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="font-[family-name:var(--font-serif)] text-8xl text-[var(--brand-red)] leading-none">
          緣
        </h1>
        <p className="mt-4 font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)]">
          사주로 찾는 운명의 인연
        </p>
        <p className="mt-3 max-w-md text-[var(--muted-foreground)] leading-relaxed">
          사주명리학 기반 역방향 매칭으로
          <br />
          당신에게 가장 잘 맞는 상대를 찾아드립니다
        </p>
        <Link href="/saju-input" className="mt-8">
          <Button className="bg-[var(--brand-red)] hover:bg-[var(--brand-red)]/90 text-white px-8 py-6 text-lg rounded-xl shadow-lg">
            운명의 상대를 찾아보세요
          </Button>
        </Link>
      </section>

      {/* Divider */}
      <div className="flex justify-center">
        <div className="w-16 h-px bg-[var(--brand-gold)]" />
      </div>

      {/* Features Section */}
      <section className="px-4 py-20">
        <h2 className="text-center font-[family-name:var(--font-serif)] text-xl text-[var(--foreground)] mb-12">
          緣이 특별한 이유
        </h2>
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="border-none bg-[var(--card)] shadow-sm"
            >
              <CardContent className="pt-6 text-center">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="font-[family-name:var(--font-serif)] text-lg font-bold text-[var(--foreground)] mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-[var(--card)] px-4 py-20">
        <h2 className="text-center font-[family-name:var(--font-serif)] text-xl text-[var(--foreground)] mb-12">
          이용 방법
        </h2>
        <div className="mx-auto max-w-2xl space-y-8">
          {[
            { step: "1", title: "사주 입력", desc: "생년월일시를 입력하면 사주팔자를 분석합니다" },
            { step: "2", title: "궁합 선호도 설정", desc: "연애·결혼·재물 등 중요한 항목의 가중치를 설정합니다" },
            { step: "3", title: "이상적 상대 도출", desc: "나와 가장 잘 맞는 상대의 사주를 역산출합니다" },
            { step: "4", title: "운명의 매칭", desc: "실제 사용자 중 사주가 일치하는 상대와 매칭됩니다" },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-gold)] text-white font-bold">
                {item.step}
              </div>
              <div>
                <h3 className="font-medium text-[var(--foreground)]">
                  {item.title}
                </h3>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20 text-center">
        <p className="font-[family-name:var(--font-serif)] text-lg text-[var(--foreground)] mb-6">
          운명의 인연, 지금 시작하세요
        </p>
        <Link href="/saju-input">
          <Button className="bg-[var(--brand-red)] hover:bg-[var(--brand-red)]/90 text-white px-8 py-6 text-lg rounded-xl shadow-lg">
            무료로 체험하기
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
        <p>&copy; 2026 緣 (연) &mdash; 사주궁합 매칭 플랫폼</p>
        <p className="mt-1">본 서비스는 궁합 정보 제공 서비스이며, 결혼중개업이 아닙니다.</p>
      </footer>
    </div>
  );
}
