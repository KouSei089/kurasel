'use client';

// 月ごとの棒グラフ。1系列（支出だけ・収入だけ）でも、2系列（収入と支出を並べる）でも使う。
// 棒を押す（マウスなら乗せる）とその月を選び、金額は親が見出しに出す（指で押せるよう、月の幅全体が押せる範囲）。
// 棒は太さ最大24px・上だけ角丸・2本並ぶときは2pxの隙間。2系列のときは凡例を出す

// 収入と支出の色（色覚の違いでも見分けられることを検証済みの組み合わせ）
export const CHART_COLORS = { income: '#2a78d6', expense: '#eb6834', tax: '#4a3aa7' };

export type ChartSeries = { key: string; label: string; color: string; values: number[] };

export function MonthChart({ months, series, focusMonth, onFocus, label }: {
  months: string[]; // YYYY-MM
  series: ChartSeries[];
  focusMonth: string;
  onFocus: (month: string) => void;
  label: string; // 読み上げ用
}) {
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`;

  return (
    <div>
      {series.length > 1 && (
        <div className="flex items-center gap-3 mb-3 text-[10px] font-bold text-slate-500">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: s.color }} />{s.label}</span>
          ))}
        </div>
      )}
      <div className="flex items-end h-32 border-b border-slate-200" role="img" aria-label={label}>
        {months.map((m, i) => {
          const isFocus = m === focusMonth;
          return (
            <button
              key={m}
              onClick={() => onFocus(m)}
              onMouseEnter={() => onFocus(m)}
              className="flex-1 h-full flex items-end justify-center gap-0.5 px-px group"
              aria-label={`${m.replace('-', '年')}月 ${series.map((s) => `${s.label} ${yen(s.values[i])}`).join('、')}`}
            >
              {series.map((s) => (
                <span
                  key={s.key}
                  className={`flex-1 ${series.length > 1 ? 'max-w-3' : 'max-w-6'} rounded-t-[4px] transition-opacity ${isFocus ? 'opacity-100' : 'opacity-35 group-hover:opacity-60'}`}
                  style={{ height: `${(s.values[i] / max) * 100}%`, minHeight: s.values[i] > 0 ? 2 : 0, backgroundColor: s.color }}
                />
              ))}
            </button>
          );
        })}
      </div>
      <div className="flex mt-1.5">
        {months.map((m, i) => (
          <span key={m} className={`flex-1 text-center text-[9px] font-bold tabular ${m === focusMonth ? 'text-slate-700' : 'text-slate-400'}`}>
            {/* 12か月以上は1つおきに月を出す */}
            {months.length > 8 && i % 2 === 1 && m !== focusMonth ? '' : Number(m.slice(5))}
          </span>
        ))}
      </div>
    </div>
  );
}
