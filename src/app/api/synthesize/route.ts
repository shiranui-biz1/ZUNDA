import { NextRequest, NextResponse } from "next/server";

const VOICEVOX_URL =
  process.env.VOICEVOX_API_URL ??
  "https://api.tts.quest/v3/voicevox/synthesis";
const SPEAKER_ID = 3; // ずんだもん（ノーマル）
const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 30;

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "テキストが必要です" }, { status: 400 });
    }

    // 1. 合成リクエスト送信
    const synthRes = await fetch(
      `${VOICEVOX_URL}?text=${encodeURIComponent(text)}&speaker=${SPEAKER_ID}`
    );

    if (!synthRes.ok) {
      throw new Error(`synthesis request failed: ${synthRes.status}`);
    }

    const synthData = await synthRes.json();

    if (!synthData.success) {
      if (synthData.retryAfter) {
        return NextResponse.json(
          { error: `レート制限中です。${synthData.retryAfter}秒後に再試行してください` },
          { status: 429 }
        );
      }
      throw new Error("synthesis request failed");
    }

    // 2. 音声生成完了をポーリングで待機
    const { audioStatusUrl, wavDownloadUrl } = synthData;

    for (let i = 0; i < MAX_POLLS; i++) {
      const statusRes = await fetch(audioStatusUrl);
      const status = await statusRes.json();

      if (status.isAudioError) {
        throw new Error("音声生成でエラーが発生しました");
      }

      if (status.isAudioReady) {
        // 3. WAV をダウンロードして返す
        const wavRes = await fetch(wavDownloadUrl);
        if (!wavRes.ok) {
          throw new Error(`WAV download failed: ${wavRes.status}`);
        }

        const audioBuffer = await wavRes.arrayBuffer();
        return new NextResponse(audioBuffer, {
          headers: { "Content-Type": "audio/wav" },
        });
      }

      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    throw new Error("音声生成がタイムアウトしました");
  } catch (error) {
    console.error("Synthesize error:", error);
    return NextResponse.json({ error: "音声合成に失敗しました" }, { status: 500 });
  }
}
