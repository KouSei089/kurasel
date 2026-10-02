import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { isSignedIn } from "../../lib/serverAuth";
import { categoryPromptList } from "../../lib/categories";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export async function POST(req: Request) {
  try {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY is not defined");
    }

    if (!(await isSignedIn(req))) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const body = await req.json();
    const { imageBase64, mimeType } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: "画像データがありません" }, { status: 400 });
    }

    // data:image/jpeg;base64,xxx 形式でも、生の base64 でも受け取れるようにする
    const base64Data = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;
    const finalMimeType = mimeType || "image/jpeg";

    // 無料枠で安定して使えるモデルエイリアス
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      このレシート画像を解析して、以下の情報をJSON形式で抽出してください。
      キー名は以下のようにしてください:
      - store_name (店名: 文字列。不明なら"不明")
      - amount (合計金額: 数値)
      - date (日付: YYYY-MM-DD形式)
      - category (分類: ${categoryPromptList()} から、いちばん近いものの id を1つ推測。スーパーは 'food'、ドラッグストアで日用品が中心なら 'drugstore'、AIやアプリの利用料は 'digital')
      JSONのみを出力してください。余計なマークダウンは不要です。
    `;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: finalMimeType } }
    ]);

    const response = await result.response;
    const text = response.text();
    
    return NextResponse.json(JSON.parse(text));

  } catch (error: any) {
    console.error("AI Error:", error);
    return NextResponse.json(
      { error: error.message || "読み取りに失敗しました" },
      { status: 500 }
    );
  }
}