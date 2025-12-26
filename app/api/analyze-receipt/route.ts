import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageBase64, mimeType } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: "画像データがありません" }, { status: 400 });
    }

    const base64Data = imageBase64.split(",")[1];
    // デフォルトをjpegにしつつ、フロントから送られてきたmimeTypeを優先
    const finalMimeType = mimeType || "image/jpeg";

    // ★ここを修正: リストにあった確実なモデル名に変更
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      このレシート画像を解析して、以下の情報をJSON形式で抽出してください。
      日付はYYYY-MM-DD形式、金額は数値のみ。
      { "store": "店名", "date": "日付", "amount": 金額 }
    `;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: finalMimeType } }
    ]);

    const response = await result.response;
    const text = response.text();
    
    return NextResponse.json(JSON.parse(text));

  } catch (error: any) {
    console.error("AI Error Details:", error);
    return NextResponse.json(
      { error: error.message || "読み取りに失敗しました" },
      { status: 500 }
    );
  }
}