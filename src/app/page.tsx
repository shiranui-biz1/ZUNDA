"use client";

import { useState, useRef, useCallback } from "react";

type Message = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Message[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await processAudio(blob);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      alert("マイクのアクセスが許可されていません");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  async function processAudio(blob: Blob) {
    setLoading(true);
    setTranscript("");
    setReply("");

    try {
      // 1. 文字起こし
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const { text, error: tErr } = await transcribeRes.json();
      if (tErr) throw new Error(tErr);
      setTranscript(text);

      // 2. チャット
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const { reply: replyText, error: cErr } = await chatRes.json();
      if (cErr) throw new Error(cErr);
      setReply(replyText);
      setHistory((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: replyText },
      ]);

      // 3. 音声合成
      try {
        const synthRes = await fetch("/api/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: replyText }),
        });
        if (synthRes.ok && synthRes.headers.get("content-type")?.includes("audio")) {
          const audioBlob = await synthRes.blob();
          const url = URL.createObjectURL(audioBlob);
          const audio = new Audio(url);
          audio.onended = () => URL.revokeObjectURL(url);
          audio.play();
        }
      } catch {
        // VOICEVOX未起動の場合は音声合成をスキップ
      }
    } catch (err) {
      console.error(err);
      setReply(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-50 to-emerald-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {/* ずんだもんアイコン */}
        <div className="mb-6 flex flex-col items-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-5xl">
            🟢
          </div>
          <h1 className="mt-3 text-xl font-bold text-emerald-800">
            ずんだもん AI アシスタント
          </h1>
          <p className="text-sm text-emerald-600">
            話しかけてみるのだ！
          </p>
        </div>

        {/* 録音ボタン */}
        <div className="mb-6 flex justify-center">
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={loading}
            className={`h-20 w-20 rounded-full text-3xl shadow-lg transition-all ${
              recording
                ? "animate-pulse bg-red-500 text-white"
                : loading
                  ? "cursor-not-allowed bg-gray-300 text-gray-500"
                  : "bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95"
            }`}
          >
            {recording ? "⏹" : loading ? "..." : "🎤"}
          </button>
        </div>

        <p className="mb-4 text-center text-sm text-gray-500">
          {recording
            ? "録音中...ボタンを押して停止"
            : loading
              ? "処理中..."
              : "ボタンを押して話しかけてね"}
        </p>

        {/* 結果表示 */}
        {transcript && (
          <div className="mb-3 rounded-lg bg-gray-50 p-3">
            <p className="mb-1 text-xs font-semibold text-gray-400">あなた</p>
            <p className="text-sm text-gray-700">{transcript}</p>
          </div>
        )}

        {reply && (
          <div className="rounded-lg bg-emerald-50 p-3">
            <p className="mb-1 text-xs font-semibold text-emerald-400">
              ずんだもん
            </p>
            <p className="text-sm text-emerald-800">{reply}</p>
          </div>
        )}

        {/* 会話履歴 */}
        {history.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <p className="mb-2 text-xs font-semibold text-gray-400">会話履歴</p>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {history.map((msg, i) => (
                <div
                  key={i}
                  className={`rounded p-2 text-xs ${
                    msg.role === "user"
                      ? "bg-gray-50 text-gray-600"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  <span className="font-semibold">
                    {msg.role === "user" ? "あなた: " : "ずんだもん: "}
                  </span>
                  {msg.content}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
