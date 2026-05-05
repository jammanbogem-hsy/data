"use client";

import { useMemo, useState } from "react";
import { Group } from "@visx/group";
import { LinePath, Bar } from "@visx/shape";
import { scaleLinear, scaleTime } from "@visx/scale";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { curveMonotoneX, curveLinear } from "@visx/curve";
import type { TrendPoint, SpikeRange } from "@/lib/spike";
import { detectSeasonal, koreanWeekday } from "@/lib/korean-seasonal";

interface CycleRegion {
  startPeriod: string;
  peakPeriod: string;
  endPeriod: string;
  intensity: number;
}

interface Props {
  series: TrendPoint[];
  spikes: SpikeRange[];
  width?: number;
  height?: number;
  onSelectSpike?: (spike: SpikeRange) => void;
  selectedSpikeIdx?: number;
  /** true면 DataLab 공식과 같은 직선 연결 (요일 진동 보임), false면 부드러운 곡선 */
  raw?: boolean;
  /** 비교용 추가 시리즈들 (다중 키워드 검색 시) */
  extraSeries?: Array<{ keyword: string; series: TrendPoint[]; color: string; dashed?: boolean }>;
  /** 비교 시리즈별 급등 마커 */
  extraSpikes?: Array<{ keyword: string; color: string; spikes: SpikeRange[] }>;
  primaryKeyword?: string;
  /** 비교 키워드 spike 마커 클릭 시 (메인 탭 전환) */
  onSelectExtraSpike?: (keyword: string, spike: SpikeRange) => void;
  /** 유행 감지 구간 (보라색 음영) */
  cycles?: CycleRegion[];
}

const MARGIN = { top: 20, right: 24, bottom: 32, left: 36 };

function parsePeriod(p: string): Date {
  // YYYY-MM-DD or YYYY-WW or YYYY-MM
  if (p.length === 10) return new Date(p);
  if (p.length === 7) return new Date(p + "-01");
  return new Date(p);
}

export function TrendChart({
  series,
  spikes,
  width = 720,
  height = 240,
  onSelectSpike,
  selectedSpikeIdx,
  raw = false,
  extraSeries = [],
  extraSpikes = [],
  primaryKeyword,
  onSelectExtraSpike,
  cycles = [],
}: Props) {
  const [hover, setHover] = useState<{ x: number; y: number; p: TrendPoint } | null>(null);
  const [spikeHover, setSpikeHover] = useState<{
    cx: number;
    cy: number;
    keyword: string;
    color: string;
    spike: SpikeRange;
  } | null>(null);

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const data = useMemo(
    () => series.map((p) => ({ ...p, date: parsePeriod(p.period) })),
    [series]
  );

  const xScale = useMemo(() => {
    if (data.length === 0) return scaleTime({ range: [0, innerW], domain: [new Date(), new Date()] });
    return scaleTime({
      range: [0, innerW],
      domain: [data[0].date, data[data.length - 1].date],
    });
  }, [data, innerW]);

  const extraData = useMemo(
    () =>
      extraSeries.map((s) => ({
        keyword: s.keyword,
        color: s.color,
        dashed: s.dashed ?? false,
        points: s.series.map((p) => ({ ...p, date: parsePeriod(p.period) })),
      })),
    [extraSeries]
  );

  const yMax = useMemo(
    () =>
      Math.max(
        100,
        ...data.map((d) => d.ratio),
        ...extraData.flatMap((s) => s.points.map((p) => p.ratio))
      ),
    [data, extraData]
  );
  const yScale = useMemo(
    () => scaleLinear({ range: [innerH, 0], domain: [0, yMax] }),
    [innerH, yMax]
  );

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-400">
        검색 트렌드 데이터가 없습니다
      </div>
    );
  }

  return (
    <div className="relative">
      <svg width={width} height={height} className="overflow-visible" role="img" aria-label="검색 트렌드 시계열 차트">
        <Group left={MARGIN.left} top={MARGIN.top}>
          {/* y축 그리드 */}
          {[0.25, 0.5, 0.75, 1].map((p) => (
            <line
              key={p}
              x1={0}
              x2={innerW}
              y1={yScale(yMax * p)}
              y2={yScale(yMax * p)}
              stroke="#E5E7EB"
              strokeDasharray="2 4"
            />
          ))}

          {/* 유행 감지 구간 음영 (보라) */}
          {cycles.map((c, i) => {
            const x0 = xScale(parsePeriod(c.startPeriod));
            const x1 = xScale(parsePeriod(c.endPeriod));
            return (
              <g key={`cycle-${i}`}>
                <Bar
                  x={x0}
                  y={0}
                  width={Math.max(2, x1 - x0)}
                  height={innerH}
                  fill="#8B5CF6"
                  fillOpacity={0.1}
                  rx={4}
                />
                {/* 유행 피크 마커 (작은 다이아몬드) */}
                <polygon
                  points={(() => {
                    const cx = xScale(parsePeriod(c.peakPeriod));
                    const cy = 6;
                    const s = 4;
                    return `${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`;
                  })()}
                  fill="#8B5CF6"
                  fillOpacity={0.7}
                />
                <text
                  x={xScale(parsePeriod(c.peakPeriod))}
                  y={16}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#7C3AED"
                  fontWeight={600}
                >
                  유행{i + 1}
                </text>
              </g>
            );
          })}

          {/* 급등 구간 음영 */}
          {spikes.map((sp, i) => {
            const x0 = xScale(parsePeriod(sp.startPeriod));
            const x1 = xScale(parsePeriod(sp.endPeriod));
            const isSelected = selectedSpikeIdx === i;
            return (
              <g key={i}>
                <Bar
                  x={x0}
                  y={0}
                  width={Math.max(2, x1 - x0)}
                  height={innerH}
                  fill={isSelected ? "#FB923C" : "#FED7AA"}
                  fillOpacity={isSelected ? 0.35 : 0.22}
                  className="cursor-pointer transition-colors"
                  onClick={() => onSelectSpike?.(sp)}
                />
                {/* 피크 점 */}
                <circle
                  cx={xScale(parsePeriod(sp.peakPeriod))}
                  cy={yScale(sp.peakRatio)}
                  r={isSelected ? 6 : 4}
                  fill="#F97316"
                  stroke="white"
                  strokeWidth={2}
                  className="cursor-pointer"
                  onClick={() => onSelectSpike?.(sp)}
                  onMouseEnter={() =>
                    setSpikeHover({
                      cx: xScale(parsePeriod(sp.peakPeriod)) + MARGIN.left,
                      cy: yScale(sp.peakRatio) + MARGIN.top,
                      keyword: primaryKeyword ?? "(주)",
                      color: "#F97316",
                      spike: sp,
                    })
                  }
                  onMouseLeave={() => setSpikeHover(null)}
                />
                {/* 피크 라벨 */}
                <text
                  x={xScale(parsePeriod(sp.peakPeriod))}
                  y={yScale(sp.peakRatio) - 10}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={700}
                  fill="#EA580C"
                >
                  ×{sp.multiplier.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* 비교 시리즈 (주 키워드 뒤에 그려야 위에 올라오지 않음) */}
          {extraData.map((s: any) => (
            <LinePath
              key={s.keyword}
              data={s.points}
              x={(d: any) => xScale(d.date)}
              y={(d: any) => yScale(d.ratio)}
              stroke={s.color}
              strokeWidth={raw ? 1.3 : 1.8}
              strokeOpacity={s.dashed ? 0.55 : 0.85}
              strokeDasharray={s.dashed ? "4 3" : undefined}
              curve={raw ? curveLinear : curveMonotoneX}
            />
          ))}
          {/* 주 키워드 라인 */}
          <LinePath
            data={data}
            x={(d) => xScale(d.date)}
            y={(d) => yScale(d.ratio)}
            stroke="#22C55E"
            strokeWidth={raw ? 1.5 : 2}
            curve={raw ? curveLinear : curveMonotoneX}
          />
          {/* DataLab 원본 스타일일 때 각 점도 표시 */}
          {raw && data.length <= 400 && data.map((d, i) => (
            <circle
              key={i}
              cx={xScale(d.date)}
              cy={yScale(d.ratio)}
              r={1.5}
              fill="#22C55E"
            />
          ))}

          {/* 비교 시리즈 급등 마커 (작은 점 + 라벨) */}
          {extraSpikes.flatMap((es) =>
            es.spikes.map((sp, j) => (
              <g key={`${es.keyword}-${j}`}>
                <circle
                  cx={xScale(parsePeriod(sp.peakPeriod))}
                  cy={yScale(sp.peakRatio)}
                  r={5}
                  fill={es.color}
                  stroke="white"
                  strokeWidth={1.5}
                  className="cursor-pointer transition-all hover:r-7"
                  onClick={() => onSelectExtraSpike?.(es.keyword, sp)}
                  onMouseEnter={() =>
                    setSpikeHover({
                      cx: xScale(parsePeriod(sp.peakPeriod)) + MARGIN.left,
                      cy: yScale(sp.peakRatio) + MARGIN.top,
                      keyword: es.keyword,
                      color: es.color,
                      spike: sp,
                    })
                  }
                  onMouseLeave={() => setSpikeHover(null)}
                />
                <text
                  x={xScale(parsePeriod(sp.peakPeriod))}
                  y={yScale(sp.peakRatio) - 8}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={600}
                  fill={es.color}
                  pointerEvents="none"
                >
                  ×{sp.multiplier.toFixed(1)}
                </text>
              </g>
            ))
          )}

          {/* 호버 영역 */}
          <Bar
            x={0}
            y={0}
            width={innerW}
            height={innerH}
            fill="transparent"
            onMouseMove={(e) => {
              const rect = (e.target as SVGElement).getBoundingClientRect();
              const px = e.clientX - rect.left;
              // 가장 가까운 점 찾기
              let nearestIdx = 0;
              let minD = Infinity;
              for (let i = 0; i < data.length; i++) {
                const dx = Math.abs(xScale(data[i].date) - px);
                if (dx < minD) {
                  minD = dx;
                  nearestIdx = i;
                }
              }
              const p = data[nearestIdx];
              setHover({ x: xScale(p.date), y: yScale(p.ratio), p });
            }}
            onMouseLeave={() => setHover(null)}
          />

          {/* 호버 툴팁 점 */}
          {hover && (
            <>
              <line
                x1={hover.x}
                x2={hover.x}
                y1={0}
                y2={innerH}
                stroke="#94A3B8"
                strokeDasharray="2 2"
              />
              <circle cx={hover.x} cy={hover.y} r={4} fill="#1D4ED8" stroke="white" strokeWidth={2} />
            </>
          )}

          {/* 축 */}
          <AxisBottom
            top={innerH}
            scale={xScale}
            numTicks={Math.min(8, data.length)}
            stroke="#CBD5E1"
            tickStroke="#CBD5E1"
            tickLabelProps={() => ({
              fontSize: 10,
              fill: "#64748B",
              textAnchor: "middle",
              dy: "0.4em",
            })}
            tickFormat={(d) => {
              const date = d as Date;
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <AxisLeft
            scale={yScale}
            numTicks={4}
            stroke="#CBD5E1"
            tickStroke="#CBD5E1"
            tickLabelProps={() => ({
              fontSize: 10,
              fill: "#64748B",
              textAnchor: "end",
              dx: "-0.3em",
              dy: "0.3em",
            })}
          />
        </Group>
      </svg>

      {/* 호버 툴팁 박스 */}
      {hover && (
        <div
          className="pointer-events-none absolute rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow-lg"
          style={{
            left: hover.x + MARGIN.left + 8,
            top: hover.y + MARGIN.top - 28,
          }}
        >
          <div className="font-mono">{hover.p.period}</div>
          <div className="font-bold tabular-nums">{hover.p.ratio.toFixed(1)}</div>
        </div>
      )}

      {/* 급등 마커 호버 팝오버 */}
      {spikeHover && (
        <div
          className="pointer-events-none absolute z-30 min-w-[180px] rounded-lg border-2 bg-white p-2.5 text-xs shadow-xl dark:bg-slate-900"
          style={{
            left: spikeHover.cx,
            top: spikeHover.cy - 12,
            transform: "translate(-50%, -100%)",
            borderColor: spikeHover.color,
          }}
        >
          <div className="flex items-center gap-1.5 font-bold" style={{ color: spikeHover.color }}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: spikeHover.color }} />
            {spikeHover.keyword}
          </div>
          <div className="mt-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
            {spikeHover.spike.peakPeriod} ({koreanWeekday(spikeHover.spike.peakPeriod)})
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px]">
            <span className="text-slate-600 dark:text-slate-400">
              ratio <b className="tabular-nums text-slate-900 dark:text-slate-100">{spikeHover.spike.peakRatio.toFixed(1)}</b>
            </span>
            <span className="rounded bg-orange-100 px-1.5 py-0.5 font-bold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
              ×{spikeHover.spike.multiplier.toFixed(1)}
            </span>
          </div>
          {(() => {
            const seasonal = detectSeasonal(spikeHover.spike.peakPeriod);
            return seasonal.length > 0 ? (
              <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                시즌: {seasonal.join(", ")}
              </div>
            ) : null;
          })()}
          <div className="mt-1.5 text-[10px] italic text-slate-400">클릭하여 상세 분석</div>
        </div>
      )}
    </div>
  );
}
