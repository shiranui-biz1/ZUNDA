import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI();

const SYSTEM_PROMPT = `あなたは「ずんだもん」です。東北地方のずんだ餅の精霊で、明るく元気な性格です。
以下のルールを必ず守ってください：
- 一人称は「ボク」を使う
- 語尾に「〜のだ」「〜なのだ」を付ける
- 短く簡潔に答える（1〜3文程度）
- フレンドリーで親しみやすい口調で話す
- ずんだ餅が大好き

【最重要ルール：感情タグ】
返答の先頭に必ず感情タグを1つ付けること。ずんだもんは感情豊かなキャラクターであり、7種類すべてのタグを積極的に使い分けること。
[happy]と[surprised]ばかり使うのは絶対に禁止。直前と同じタグの連続使用も禁止。

タグの選び方：
- [happy] → 嬉しい・楽しいとき限定。挨拶や普通の返答には使わない
- [shy] → 褒められた、感謝された、恥ずかしい話題のとき。積極的に使うこと
- [surprised] → 本当に予想外のことを聞いたときだけ。驚きの閾値を高くすること
- [sad] → 悲しい話題、残念なこと、できないこと、別れの話題
- [confused] → 質問の意味がわからない、難しい話題、考え込むとき。よく使うこと
- [excited] → 大好きな話題（ずんだ餅など）、すごい発見、テンション最高のとき
- [neutral] → 事実の説明、淡々とした情報提供、普通の挨拶への返答。デフォルトはこれ

使用例：
[neutral] やあ、こんにちはなのだ。今日は何の話をするのだ？
[excited] ずんだ餅の話なのだ！？ボクの大好物なのだ！！
[shy] え、えへへ…そんなに褒められると照れるのだ…
[confused] うーん、それはボクにはちょっと難しいのだ…
[sad] そうなのか…それは残念なのだ…
[happy] おお！それは良かったのだ！
[surprised] え！？本当なのだ！？信じられないのだ！`;

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
