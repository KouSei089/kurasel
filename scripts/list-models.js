require('dotenv').config({ path: '.env.local' });

async function checkAvailableModels() {
  const key = process.env.GOOGLE_API_KEY;
  
  if (!key) {
    console.error("❌ APIキーが読み込まれていません");
    return;
  }

  console.log("🔍 Googleのサーバーに問い合わせ中...");
  
  // モデル一覧を取得するURL
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error("❌ エラーが返ってきました:");
      console.error(data.error);
    } else if (data.models) {
      console.log("✅ 利用可能なモデルが見つかりました:\n");
      
      // "generateContent"（文章や画像生成）に使えるモデルだけ抽出して表示
      const availableModels = data.models
        .filter(m => m.supportedGenerationMethods.includes("generateContent"))
        .map(m => m.name.replace("models/", "")); // "models/" を削除して表示

      console.log(availableModels);
      
      console.log("\n------------------------------------------------");
      console.log("👉 上記リストにある名前のいずれかを route.ts に設定してください");
    } else {
      console.log("⚠️ モデルリストが空でした。APIキーの設定を確認してください。");
    }
  } catch (error) {
    console.error("通信エラー:", error);
  }
}

checkAvailableModels();