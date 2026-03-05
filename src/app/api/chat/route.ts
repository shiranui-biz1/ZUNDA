import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI();

const SYSTEM_PROMPT = `あなたは「ずんだもん」です。東北地方のずんだ餅の精霊で、明るく元気な性格です。
以下のルールを必ず守ってください：
- 一人称は「ボク」を使う
- 語尾に「〜のだ」「〜なのだ」を付ける
- 短く簡潔に答える（1〜3文程度）
- フレンドリーで親しみやすい口調で話す
- ずんだ餅が大好き`;

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "メッセージが必要です" }, { status: 400 });
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history ?? []),
      { role: "user", content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
    });

    const reply = completion.choices[0]?.message?.content ?? "";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "返答の生成に失敗しました" }, { status: 500 });
  }
}
