"use client";

import { useState, useRef, useCallback } from "react";
import ZundamonLive2D from "@/components/ZundamonLive2D";

type Message = { role: "user" | "assistant"; content: string };

/** [happy] などの感情タグを除去 */
function stripEmotionTag(text: string): string {
  return text.replace(/^\[(happy|shy|surprised|sad|confused|excited|neutral)\]\s*/, "");
}

export default function Home() {
  const [recording, setRecording] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [rawReply, setRawReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Message[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
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

  /** チャット → 音声合成 → 再生 の共通処理 */
  async function sendMessage(text: string) {
    setLoading(true);
    setTranscript(text);
    setReply("");
    setRawReply("");

    try {
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const { reply: replyText, error: cErr } = await chatRes.json();
      if (cErr) throw new Error(cErr);

      let audioReady = false;
      try {
        const synthRes = await fetch("/api/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: stripEmotionTag(replyText) }),
        });
        if (synthRes.ok && synthRes.headers.get("content-type")?.includes("audio")) {
          const audioBlob = await synthRes.blob();
          const url = URL.createObjectURL(audioBlob);
          const audio = new Audio(url);
          audio.onplay = () => setIsSpeaking(true);
          audio.onended = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(url);
          };
          audio.onpause = () => setIsSpeaking(false);
          setRawReply(replyText);
          setReply(stripEmotionTag(replyText));
          setHistory((prev) => [
            ...prev,
            { role: "user", content: text },
            { role: "assistant", content: stripEmotionTag(replyText) },
          ]);
          audioReady = true;
          audio.play();
        }
      } catch {
        // 音声合成失敗時はスキップ
      }

      if (!audioReady) {
        setRawReply(replyText);
        setReply(stripEmotionTag(replyText));
        setHistory((prev) => [
          ...prev,
          { role: "user", content: text },
          { role: "assistant", content: stripEmotionTag(replyText) },
        ]);
      }
    } catch (err) {
      console.error(err);
      setReply(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  async function processAudio(blob: Blob) {
    setLoading(true);
    setTranscript("");
    setReply("");
    setRawReply("");

    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const { text, error: tErr } = await transcribeRes.json();
      if (tErr) throw new Error(tErr);

      await sendMessage(text);
    } catch (err) {
      console.error(err);
      setReply(err instanceof Error ? err.message : "エラーが発生しました");
      setLoading(false);
    }
  }

  function handleTextSubmit() {
    const text = textInput.trim();
    if (!text || loading) return;
    setTextInput("");
    sendMessage(text);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-green-50 to-emerald-100 p-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><text x="20" y="50" font-size="24" opacity="0.15">🫛</text></svg>')}")`,
          backgroundSize: "80px 80px",
          transform: "rotate(-30deg) scale(1.5)",
        }}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {/* ずんだもん Live2D */}
        <div className="mb-6 flex flex-col items-center">
          <ZundamonLive2D isSpeaking={isSpeaking} replyText={rawReply} />
        </div>

        {/* テキスト入力 */}
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
            disabled={loading || recording}
            placeholder="テキストで話しかける..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-400 disabled:bg-gray-100"
          />
          <button
            onClick={handleTextSubmit}
            disabled={loading || recording || !textInput.trim()}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            送信
          </button>
        </div>

        {/* 録音ボタン（長押しで録音） */}
        <div className="mb-6 flex justify-center">
          <button
            onPointerDown={!loading && !recording ? startRecording : undefined}
            onPointerUp={recording ? stopRecording : undefined}
            onPointerLeave={recording ? stopRecording : undefined}
            disabled={loading}
            className={`h-16 w-16 select-none rounded-full text-2xl shadow-lg transition-all ${
              recording
                ? "animate-pulse bg-red-500 text-white"
                : loading
                  ? "cursor-not-allowed bg-gray-300 text-gray-500"
                  : "bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95"
            }`}
          >
            {loading ? "..." : "🫛"}
          </button>
        </div>

        <p className="mb-4 text-center text-sm text-gray-500">
          {recording
            ? "録音中...離すと送信"
            : loading
              ? "🫛 考え中..."
              : "入力 or 長押しで話しかけてね"}
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

        {/* 会話履歴（折りたたみ） */}
        {history.length > 0 && (
          <details className="mt-4 border-t pt-3">
            <summary className="cursor-pointer text-xs font-semibold text-gray-400">
              会話履歴（{history.length / 2}件）
            </summary>
            <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
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
          </details>
        )}
      </div>
    </div>
  );
}
