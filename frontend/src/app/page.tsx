"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [status, setStatus] = useState("Checking...");

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/health`)
      .then(res => res.json())
      .then(data => setStatus(data.message))
      .catch(() => setStatus("❌ Backend unreachable"));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">📦 Dataset AI Platform</h1>
        <p className="text-lg">Backend Status: <span className="font-mono bg-gray-200 px-2 py-1 rounded">{status}</span></p>
      </div>
    </main>
  );
}