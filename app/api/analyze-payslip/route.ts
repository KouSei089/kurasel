import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { isSignedIn } from "../../lib/serverAuth";

// 給与明細・賞与明細のスクリーンショットから、総支給額・控除（税金・社会保険料など）・差引支給額（手取り）・支給日を読み取る。
// 総支給を収入、控除を個人の支出として記録するために使う（app/income/payslip）

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

type DeductionType = "social_insurance" | "tax" | "other";

type Payslip = {
  kind: "salary" | "bonus";
  pay_date: string | null; // YYYY-MM-DD
  employer: string;
  gross: number; // 総支給額
  net: number; // 差引支給額（手取り）
  deductions: { name: string; amount: number; type: DeductionType }[];
};

const yen = (v: unknown) => {
  const n = Math.round(Math.abs(Number(String(v ?? "").replace(/[,，円¥\s]/g, ""))));
  return Number.isFinite(n) ? n : 0;
};

// AI の出力はそのまま信用せず、形の合わないものは捨てる。0円の控除（介護保険料 0 など）も捨てる
const sanitize = (raw: unknown): Payslip => {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const date = typeof r.pay_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.pay_date) && !Number.isNaN(Date.parse(r.pay_date)) ? r.pay_date : null;
  const list = Array.isArray(r.deductions) ? r.deductions : [];
  return {
    kind: r.kind === "bonus" ? "bonus" : "salary",
    pay_date: date,
    employer: typeof r.employer === "string" ? r.employer.trim().slice(0, 100) : "",
    gross: yen(r.gross),
    net: yen(r.net),
    deductions: list.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const { name, amount, type } = item as Record<string, unknown>;
      const value = yen(amount);
      if (value <= 0 || typeof name !== "string" || !name.trim()) return [];
      return [{
        name: name.trim().slice(0, 50),
        amount: value,
        type: type === "social_insurance" || type === "tax" ? type : "other",
      }];
    }),
  };
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

    if (!(await isSignedIn(req))) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: "画像データがありません" }, { status: 400 });
    }
    const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;

    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      generationConfig: { responseMimeType: "application/json" },
    });

    // freee人事労務の給与明細（実際の画面で確認したもの）:
    //   「支給」欄（月給・残業手当・勤怠控除・通勤手当…と「計」）、「控除」欄（健康保険料・介護保険料・
    //   子ども・子育て支援金・厚生年金保険料・雇用保険料・所得税・住民税と「計」）、右上に「差引総支給額」、
    //   名前の横に「2026年9月20日支払い」。勤怠欄・備考欄（課税支給累計額など）は金額ではない
    const prompt = `
      これは給与明細または賞与明細のスクリーンショットです。次の形の JSON を出力してください。

      {"kind": "salary", "pay_date": "YYYY-MM-DD", "employer": "...", "gross": 0, "net": 0,
       "deductions": [{"name": "...", "amount": 0, "type": "social_insurance"}]}

      - kind: 給与明細なら "salary"、賞与明細なら "bonus"
      - pay_date: 支給日（「○年○月○日支払い」「支給日」など）。賃金計算期間や勤怠の期間ではない。読めなければ null
      - employer: 会社名。読めなければ ""
      - gross: 支給の合計（「支給」欄の「計」「総支給額」）。非課税の通勤手当も含めた合計
      - net: 差引支給額（「差引総支給額」「差引支給額」「手取り」）
      - deductions: 「控除」欄の各項目。「計」の行は含めない。0円の項目は含めない
        - name: 項目名をそのまま（例: 健康保険料、厚生年金保険料、所得税、住民税）
        - amount: 金額（正の整数。「,」「円」は付けない）
        - type: 健康保険料・介護保険料・厚生年金保険料・雇用保険料・子ども・子育て支援金など社会保険は "social_insurance"、
                所得税・住民税は "tax"、それ以外（社宅費・財形貯蓄・組合費など）は "other"
      - 勤怠（労働日数・時間）や備考（課税支給累計額など）の数字は使わない
      JSONのみを出力してください。
    `;

    const text = await generateWithRetry(async () => {
      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Data, mimeType: mimeType || "image/jpeg" } },
      ]);
      return result.response.text();
    });

    return NextResponse.json(sanitize(JSON.parse(text)));

  } catch (error) {
    console.error("AI Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "読み取りに失敗しました" },
      { status: 500 }
    );
  }
}
