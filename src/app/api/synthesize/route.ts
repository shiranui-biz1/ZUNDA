import { NextRequest, NextResponse } from "next/server";

const VOICEVOX_URL = process.env.VOICEVOX_API_URL ?? "http://localhost:50021";
const SPEAKER_ID = 3; // ずんだもん（ノーマル）

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "テキストが必要です" }, { status: 400 });
    }

    // 1. 音声クエリを生成
    const queryRes = await fetch(
      `${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${SPEAKER_ID}`,
      { method: "POST" }
    );

    if (!queryRes.ok) {
      throw new Error(`audio_query failed: ${queryRes.status}`);
    }

    const query = await queryRes.json();

    // 2. 音声合成
    const synthesisRes = await fetch(
      `${VOICEVOX_URL}/synthesis?speaker=${SPEAKER_ID}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(query),
      }
    );

    if (!synthesisRes.ok) {
      throw new Error(`synthesis failed: ${synthesisRes.status}`);
    }

    const audioBuffer = await synthesisRes.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/wav",
      },
    });
  } catch (error) {
    console.error("Synthesize error:", error);
    return NextResponse.json({ error: "音声合成に失敗しました" }, { status: 500 });
  }
}
