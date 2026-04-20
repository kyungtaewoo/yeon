"use client";

import { useState, useEffect } from "react";

export default function TestPage() {
  const [count, setCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [testResult, setTestResult] = useState("pending");
  const [gender, setGender] = useState("");

  useEffect(() => {
    setHydrated(true);

    // 1. Button import 테스트
    import("@/components/ui/button")
      .then(() => setTestResult(r => r === "pending" ? "button OK" : r + " | button OK"))
      .catch((e) => setTestResult(r => `button FAIL: ${e.message}`));
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h2>디버그 v2</h2>
      <p>Hydrated: <b>{hydrated ? "YES" : "NO"}</b></p>
      <p>Import: <b>{testResult}</b></p>
      <p>Count: <b>{count}</b></p>
      <p>Gender: <b>{gender || "없음"}</b></p>

      <button
        type="button"
        onClick={() => setCount(c => c + 1)}
        style={{ padding: 16, fontSize: 16, marginTop: 10, display: "block", width: "100%" }}
      >
        카운트 +1
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        <button
          type="button"
          onClick={() => setGender("male")}
          style={{
            padding: 12, fontSize: 14, borderRadius: 8,
            border: gender === "male" ? "2px solid red" : "1px solid #ccc",
            background: gender === "male" ? "red" : "white",
            color: gender === "male" ? "white" : "black",
          }}
        >
          남성
        </button>
        <button
          type="button"
          onClick={() => setGender("female")}
          style={{
            padding: 12, fontSize: 14, borderRadius: 8,
            border: gender === "female" ? "2px solid red" : "1px solid #ccc",
            background: gender === "female" ? "red" : "white",
            color: gender === "female" ? "white" : "black",
          }}
        >
          여성
        </button>
      </div>
    </div>
  );
}
