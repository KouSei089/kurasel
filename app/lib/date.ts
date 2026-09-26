// 日付は「端末の日付（日本なら日本時間）」の YYYY-MM-DD で扱う。
// toISOString() は UTC なので、日本時間の0時〜9時は前日の日付になってしまう
export const toLocalYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const todayYMD = () => toLocalYMD(new Date());
