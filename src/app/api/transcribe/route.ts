import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as File | null;

    if (!audio) {
      return NextResponse.json({ error: "音声ファイルが必要です" }, { status: 400 });
    }

    const openai = new OpenAI();
    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: audio,
      language: "ja",
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error) {
    console.error("Transcribe error:", error);
    return NextResponse.json({ error: "文字起こしに失敗しました" }, { status: 500 });
  }
}
