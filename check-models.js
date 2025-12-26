const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

async function main() {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // ダミー初期化

  console.log("Checking available models...");
  try {
    // APIキーの確認も含めてモデル一覧を取得するか試みるトリック
    // ※SDKの仕様上、直接一覧を取るメソッドがない場合もあるため、一度動かしてみる
    console.log("API Key:", process.env.GOOGLE_API_KEY ? "Set" : "Missing");
    
    // 単純なテキスト生成でモデルの導通確認
    const testModel = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await testModel.generateContent("Hello");
    console.log("Gemini Pro Connection: Success");
    
  } catch (e) {
    console.error("Connection Error:", e.message);
  }
}

main();