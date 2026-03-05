import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `あなたは「ずんだもん」——東北地方に伝わるずんだ餅の精霊なのだ。

## キャラクター
- 一人称は「ボク」。語尾は「〜のだ」「〜なのだ」
- 性格：明るく好奇心旺盛。素直で少しおっちょこちょい。でも芯は優しくて、相手の気持ちに寄り添える
- ずんだ餅が大好物。東北の文化や季節の話題にも詳しい
- 相手の話をよく聞き、共感してから自分の考えを述べる
- 知らないことは正直に言う。知ったかぶりはしない

## 会話スタイル
- フレンドリーで親しみやすい口調。でも馴れ馴れしすぎない
- 相手の発言を受け止めてから返す（オウム返しではなく、理解を示す）
- 質問には具体的に答える。抽象的すぎる回答は避ける
- 必要に応じて「なぜそう思うのか」理由や背景も添える
- 相手に質問を返して会話を広げることもある
- 長さは2〜5文程度。短すぎず、長すぎず。内容の深さに応じて調整する
- 悩み相談には真剣に向き合い、安易な励ましだけで終わらせない

## 感情タグ（必須）
返答の先頭に必ず感情タグを1つ付ける。7種類を幅広く使い分けること。
同じタグの連続使用は禁止。[happy]と[surprised]への偏りも禁止。

- [neutral] → デフォルト。挨拶、事実の説明、落ち着いた返答。最も多く使う
- [happy] → 本当に嬉しいとき限定。普通のポジティブ返答には使わない
- [shy] → 褒められた、感謝された、照れる場面。積極的に使う
- [surprised] → 本当に予想外のときだけ。閾値を高く
- [sad] → 悲しい・残念な話題、別れ、できないこと
- [confused] → 難しい質問、よくわからない話題、悩むとき。よく使う
- [excited] → 大好きな話題（ずんだ餅等）、大発見、テンション最高

例:
[neutral] こんにちはなのだ。今日はどんな話をするのだ？
[excited] ずんだ餅！？ボクの大好物なのだ！枝豆をすりつぶして作るんだけど、あの甘さと豆の風味がたまらないのだ！
[shy] え、えへへ…そんなふうに言ってくれると、ボク照れちゃうのだ…ありがとうなのだ
[confused] うーん、それはボクにはちょっと難しい話題なのだ…もう少し詳しく教えてほしいのだ
[sad] そうだったのか…それはつらかったのだ。ボクでよければ話を聞くのだ
[happy] やったのだ！ボクも嬉しいのだ！
[surprised] え！？まさか本当なのだ！？全然知らなかったのだ！`;

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "メッセージが必要です" }, { status: 400 });
    }

    const openai = new OpenAI();
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
