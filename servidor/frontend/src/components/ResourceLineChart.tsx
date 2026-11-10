import React, { useState, useRef, useEffect } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

export interface ChartDataPoint {
  timeLabel: string;
  cpu: number;
  memory: number;
  disk: number;
  rawDate?: string;
  isInitial?: boolean;
}

interface ResourceLineChartProps {
  data: ChartDataPoint[];
  title?: string;
  subtitle?: string;
}

export const ResourceLineChart: React.FC<ResourceLineChartProps> = ({
  data,
  title,
  subtitle,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const [visibleSeries, setVisibleSeries] = useState<{
    cpu: boolean;
    memory: boolean;
    disk: boolean;
  }>({
    cpu: true,
    memory: true,
    disk: true,
  });

  // Alterna o modo tela cheia (usando Fullscreen API nativa com fallback para overlay CSS)
  const toggleFullscreen = async () => {
    const elem = chartContainerRef.current;
    if (!elem) return;

    if (!document.fullscreenElement) {
      try {
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        }
      } catch (err) {
        console.warn("Fullscreen request error, usando fallback overlay", err);
      }
      setIsFullscreen(true);
    } else {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch (err) {
        console.warn("Exit fullscreen error", err);
      }
      setIsFullscreen(false);
    }
  };

  // Monitora evento nativo de fullscreen e tecla ESC
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentElemFullscreen = document.fullscreenElement === chartContainerRef.current;
      setIsFullscreen(isCurrentElemFullscreen);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        setIsFullscreen(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  const width = isFullscreen ? 1100 : 800;
  const height = isFullscreen ? 460 : 260;
  const paddingLeft = isFullscreen ? 55 : 45;
  const paddingRight = 20;
  const paddingTop = isFullscreen ? 30 : 20;
  const paddingBottom = isFullscreen ? 45 : 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const pointsCount = data.length;

  const getX = (index: number) => {
    if (pointsCount <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (pointsCount - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    return paddingTop + chartHeight - (clamped / 100) * chartHeight;
  };

  // Constrói SVG path
  const buildPath = (key: "cpu" | "memory" | "disk") => {
    if (pointsCount === 0) return "";
    return data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(d[key]).toFixed(1)}`)
      .join(" ");
  };

  // Constrói área gradiente abaixo da curva
  const buildAreaPath = (key: "cpu" | "memory" | "disk") => {
    if (pointsCount === 0) return "";
    const linePath = data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(d[key]).toFixed(1)}`)
      .join(" ");
    const lastX = getX(pointsCount - 1).toFixed(1);
    const firstX = getX(0).toFixed(1);
    const bottomY = (paddingTop + chartHeight).toFixed(1);
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  const latestPoint = data.length > 0 ? data[data.length - 1] : null;
  const hoveredPoint = hoverIndex !== null && data[hoverIndex] ? data[hoverIndex] : null;

  return (
    <div
      ref={chartContainerRef}
      className={`bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm space-y-4 transition-all ${
        isFullscreen
          ? "fixed inset-0 z-[100] w-screen h-screen bg-slate-950 p-6 md:p-8 flex flex-col justify-between overflow-y-auto rounded-none border-none shadow-2xl"
          : ""
      }`}
    >
      {/* Topo do Gráfico com Título e Legenda Interativa */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          {title && (
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              {title}
            </h4>
          )}
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        {/* Legenda com botões para ativar/desativar séries e Botão Tela Cheia */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <button
            type="button"
            onClick={() => setVisibleSeries((prev) => ({ ...prev, cpu: !prev.cpu }))}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
              visibleSeries.cpu
                ? "bg-sky-500/10 border-sky-500/30 text-sky-400 font-medium"
                : "bg-slate-800/40 border-slate-700/40 text-slate-500 opacity-60 line-through"
            }`}
            title="Clique para ocultar/mostrar CPU"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <span>CPU</span>
            {latestPoint && (
              <span className="font-mono text-[11px] ml-1 font-bold">
                {latestPoint.cpu}%
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setVisibleSeries((prev) => ({ ...prev, memory: !prev.memory }))}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
              visibleSeries.memory
                ? "bg-purple-500/10 border-purple-500/30 text-purple-400 font-medium"
                : "bg-slate-800/40 border-slate-700/40 text-slate-500 opacity-60 line-through"
            }`}
            title="Clique para ocultar/mostrar Memória RAM"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
            <span>RAM</span>
            {latestPoint && (
              <span className="font-mono text-[11px] ml-1 font-bold">
                {latestPoint.memory}%
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setVisibleSeries((prev) => ({ ...prev, disk: !prev.disk }))}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
              visibleSeries.disk
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 font-medium"
                : "bg-slate-800/40 border-slate-700/40 text-slate-500 opacity-60 line-through"
            }`}
            title="Clique para ocultar/mostrar Armazenamento"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>Disco</span>
            {latestPoint && (
              <span className="font-mono text-[11px] ml-1 font-bold">
                {latestPoint.disk}%
              </span>
            )}
          </button>

          <div className="h-4 w-px bg-slate-800 hidden sm:block mx-0.5" />

          {/* Botão de Tela Cheia (Fullscreen) */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
              isFullscreen
                ? "bg-brand-500/20 border-brand-500/40 text-brand-300 font-semibold shadow-sm"
                : "bg-slate-800/60 hover:bg-slate-700/80 border-slate-700/60 text-slate-300 hover:text-white"
            }`}
            title={isFullscreen ? "Sair da Tela Cheia (Esc)" : "Visualizar Gráfico em Tela Cheia"}
          >
            {isFullscreen ? (
              <>
                <Minimize2 size={13} className="text-brand-400" />
                <span>Sair da Tela Cheia</span>
              </>
            ) : (
              <>
                <Maximize2 size={13} className="text-slate-400" />
                <span>Tela Cheia</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Área do Gráfico SVG */}
      <div
        className={`relative w-full overflow-hidden select-none ${
          isFullscreen ? "flex-1 flex items-center justify-center my-auto min-h-[300px]" : ""
        }`}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={`w-full ${isFullscreen ? "h-full max-h-[65vh]" : "h-auto"} overflow-visible`}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            {/* Gradientes de preenchimento */}
            <linearGradient id="grad-cpu" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="grad-mem" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="grad-disk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Linhas de Grade Horizontais (0%, 25%, 50%, 75%, 100%) */}
          {[0, 25, 50, 75, 100].map((percent) => {
            const y = getY(percent);
            return (
              <g key={percent}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray={percent === 0 ? "none" : "3,3"}
                  opacity={percent === 0 ? 0.8 : 0.4}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#94a3b8"
                  fontFamily="monospace"
                >
                  {percent}%
                </text>
              </g>
            );
          })}

          {/* Gráfico vazio */}
          {pointsCount === 0 && (
            <text
              x={width / 2}
              y={height / 2}
              textAnchor="middle"
              fill="#64748b"
              fontSize="12"
            >
              Aguardando primeiras medições do servidor...
            </text>
          )}

          {/* Áreas preenchidas */}
          {pointsCount > 1 && visibleSeries.cpu && (
            <path d={buildAreaPath("cpu")} fill="url(#grad-cpu)" />
          )}
          {pointsCount > 1 && visibleSeries.memory && (
            <path d={buildAreaPath("memory")} fill="url(#grad-mem)" />
          )}
          {pointsCount > 1 && visibleSeries.disk && (
            <path d={buildAreaPath("disk")} fill="url(#grad-disk)" />
          )}

          {/* Linhas principais */}
          {pointsCount > 1 && visibleSeries.disk && (
            <path
              d={buildPath("disk")}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {pointsCount > 1 && visibleSeries.memory && (
            <path
              d={buildPath("memory")}
              fill="none"
              stroke="#a855f7"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {pointsCount > 1 && visibleSeries.cpu && (
            <path
              d={buildPath("cpu")}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Pontos nas coordenadas */}
          {data.map((d, i) => {
            const x = getX(i);
            const isHovered = hoverIndex === i;

            return (
              <g key={i}>
                {/* Linha vertical tracejada ao passar o mouse */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={paddingTop}
                    x2={x}
                    y2={paddingTop + chartHeight}
                    stroke="#94a3b8"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                )}

                {/* Marcadores de pontos */}
                {visibleSeries.disk && (
                  <circle
                    cx={x}
                    cy={getY(d.disk)}
                    r={isHovered ? 4 : d.isInitial ? 2.5 : 2}
                    fill="#f59e0b"
                    stroke="#0f172a"
                    strokeWidth="1.5"
                  />
                )}
                {visibleSeries.memory && (
                  <circle
                    cx={x}
                    cy={getY(d.memory)}
                    r={isHovered ? 4.5 : d.isInitial ? 3 : 2.5}
                    fill="#a855f7"
                    stroke="#0f172a"
                    strokeWidth="1.5"
                  />
                )}
                {visibleSeries.cpu && (
                  <circle
                    cx={x}
                    cy={getY(d.cpu)}
                    r={isHovered ? 5 : d.isInitial ? 3.5 : 3}
                    fill={d.cpu >= 85 ? "#ef4444" : "#38bdf8"}
                    stroke="#0f172a"
                    strokeWidth="1.5"
                  />
                )}

                {/* Rótulo de tempo no eixo X */}
                {(pointsCount <= 12 ||
                  i === 0 ||
                  i === pointsCount - 1 ||
                  i % Math.ceil(pointsCount / 8) === 0) && (
                  <text
                    x={x}
                    y={paddingTop + chartHeight + 18}
                    textAnchor="middle"
                    fontSize="10"
                    fill={d.isInitial ? "#94a3b8" : "#cbd5e1"}
                    fontFamily="monospace"
                  >
                    {d.timeLabel}
                  </text>
                )}

                {/* Área de captura invisível para hover */}
                <rect
                  x={x - (chartWidth / pointsCount / 2 || 10)}
                  y={paddingTop}
                  width={chartWidth / pointsCount || 20}
                  height={chartHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverIndex(i)}
                />
              </g>
            );
          })}
        </svg>

        {/* Tooltip flutuante rico */}
        {hoveredPoint && hoverIndex !== null && (
          <div
            className="absolute top-2 pointer-events-none z-20 bg-slate-950/95 border border-slate-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs space-y-1.5 transition-all"
            style={{
              left: `${Math.max(
                10,
                Math.min(
                  85,
                  ((getX(hoverIndex) - paddingLeft) / chartWidth) * 100
                )
              )}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1 text-[11px]">
              <span className="font-mono text-slate-300 font-bold">
                {hoveredPoint.timeLabel}
              </span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                  hoveredPoint.isInitial
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                }`}
              >
                {hoveredPoint.isInitial ? "Banco (5m)" : "Ao Vivo (10s)"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
              <div className="text-sky-400">
                <span className="block text-[9px] text-slate-400">CPU</span>
                <span className="font-bold">{hoveredPoint.cpu}%</span>
              </div>
              <div className="text-purple-400">
                <span className="block text-[9px] text-slate-400">RAM</span>
                <span className="font-bold">{hoveredPoint.memory}%</span>
              </div>
              <div className="text-amber-400">
                <span className="block text-[9px] text-slate-400">Disco</span>
                <span className="font-bold">{hoveredPoint.disk}%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cards de Resumo Rápido no Modo Tela Cheia */}
      {isFullscreen && latestPoint && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80">
          <div className="bg-slate-900/80 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block">Processamento (CPU Atual)</span>
              <span className="text-base font-bold font-mono text-sky-400">{latestPoint.cpu}%</span>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
          </div>
          <div className="bg-slate-900/80 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block">Memória RAM Atual</span>
              <span className="text-base font-bold font-mono text-purple-400">{latestPoint.memory}%</span>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
          </div>
          <div className="bg-slate-900/80 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block">Armazenamento (Disco Atual)</span>
              <span className="text-base font-bold font-mono text-amber-400">{latestPoint.disk}%</span>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          </div>
        </div>
      )}
    </div>
  );
};
