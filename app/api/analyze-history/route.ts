import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// 決済アプリ（ハーンPay など）の利用履歴のスクリーンショットから、支払いを複数件まとめて読み取る。
// レシート1枚を読む /api/analyze-receipt の「履歴画面版」

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

// app/lib/categories.ts の DAILY_CATEGORIES の id と揃える
const CATEGORIES = ["food", "eatout", "daily", "housing", "digital", "transport", "health", "other"];

type HistoryItem = {
  store_name: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: string;
  kind: "payment" | "transfer"; // お店への支払い / 人への送付
};

// AI の出力はそのまま信用せず、形の合わないものは捨てる
const sanitize = (raw: unknown): HistoryItem[] => {
  const list = Array.isArray(raw) ? raw : [];
  return list.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const { store_name, amount, date, category, kind } = item as Record<string, unknown>;
    const yen = Math.round(Math.abs(Number(amount)));
    if (!Number.isFinite(yen) || yen <= 0) return [];
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return [];
    return [{
      store_name: typeof store_name === "string" && store_name.trim() ? store_name.trim().slice(0, 100) : "不明",
      amount: yen,
      date,
      category: typeof category === "string" && CATEGORIES.includes(category) ? category : "other",
      kind: kind === "transfer" ? "transfer" : "payment",
    }];
  });
};

// Gemini は混雑時に 503、使いすぎると 429 を返す。どちらも少し待てば通ることが多いので、2回までやり直す
const generateWithRetry = async (run: () => Promise<string>) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (attempt >= 2 || (status !== 503 && status !== 429)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
};

export async function POST(req: Request) {
  try {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY is not defined");
    }

    const { imageBase64, mimeType, today } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "画像データがありません" }, { status: 400 });
    }

    const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    // 履歴画面は年が書かれていないことが多いので、今日の日付を渡して年を補わせる
    const todayYMD = typeof today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : new Date().toISOString().slice(0, 10);

    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      generationConfig: { responseMimeType: "application/json" },
    });

    // ハーンPay の取引履歴画面の作り（実際の画面で確認したもの）:
    //   上部に「2026年07月」の月表示、その下に「支出 / 入金」のタブ、
    //   日付ごとの見出し「7月9日」、各行は 相手の名前・種類（支払い / 送付 など）・金額「¥ 800」。
    //   金額にマイナスは付かず、出入りはタブと矢印の向きで表される
    const prompt = `
      これは決済アプリ（地域通貨「ハーンPay」など）の取引履歴画面のスクリーンショットです。
      画面に写っている取引のうち「出ていったお金」だけを1件ずつ抜き出し、JSONで出力してください。

      出力形式: {"items": [{"store_name": "...", "amount": 1234, "date": "YYYY-MM-DD", "category": "...", "kind": "payment"}]}
      - store_name: 支払先の店名、または送付した相手の名前。読めなければ "不明"
      - amount: 金額（円）。正の整数。「¥」「円」「-」「,」は付けない
      - date: 取引日。画面上部の「2026年07月」のような月表示と、「7月9日」のような日付の見出しから組み立てる。
        年がどこにも書かれていない場合は、今日（${todayYMD}）より未来にならない一番近い年を補う
      - category: 'food'(食費・スーパー・商店), 'eatout'(外食・カフェ・食堂), 'daily'(日用品・ドラッグストア), 'housing'(家賃・電気・ガス・水道), 'digital'(スマホ・ネット・AIやアプリの利用料・システム使用料), 'transport'(交通・船・バス), 'health'(病院・薬局), 'other'(その他) から推測
      - kind: お店での支払いなら "payment"、人へ送ったお金（「送付」「送金」など）なら "transfer"

      出ていったお金かどうかの見分け方:
      - 「支出」「入金」のようなタブがある画面では、選ばれているタブ（色が付いている・下線がある方）を見る。
        「入金」が選ばれている画面の取引はすべて受け取ったお金なので、1件も含めない
        「支出」が選ばれている画面の取引は、金額にマイナスが付いていなくてもすべて出ていったお金として扱う
      - タブがない画面では、マイナスの金額・「支払い」「送付した」などを出ていったお金とみなす
      - チャージ・入金・受け取り・ポイント付与・払い戻し/返金・残高・総額の表示は含めない
      - 画面の端で見切れていて金額か日付が読めない取引は含めない
      出ていったお金が1件もなければ {"items": []} を返してください。JSONのみを出力してください。
    `;

    const text = await generateWithRetry(async () => {
      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Data, mimeType: mimeType || "image/jpeg" } },
      ]);
      return result.response.text();
    });

    const parsed = JSON.parse(text);
    return NextResponse.json({ items: sanitize(parsed?.items ?? parsed) });

  } catch (error) {
    console.error("AI Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "読み取りに失敗しました" },
      { status: 500 }
    );
  }
}
