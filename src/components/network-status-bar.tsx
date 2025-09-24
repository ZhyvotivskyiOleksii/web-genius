"use client";

import { useEffect, useMemo, useState } from "react";

type ConnectionSummary = {
  label: string;
  level: number;
  tooltip: string;
};

const QUALITY_ORDER: Array<{ token: string; level: number; label: string }> = [
  { token: "slow-2g", level: 1, label: "Very slow" },
  { token: "2g", level: 1, label: "2G" },
  { token: "3g", level: 2, label: "3G" },
  { token: "4g", level: 4, label: "4G" },
  { token: "5g", level: 4, label: "5G" },
];

const MAX_LEVEL = 4;

const formatDownlink = (downlink?: number) => {
  if (!downlink || downlink <= 0) return null;
  if (downlink >= 1000) {
    return `${(downlink / 1000).toFixed(1)} Gbps`;
  }
  if (downlink >= 1) {
    return `${downlink.toFixed(1)} Mbps`;
  }
  return `${Math.round(downlink * 1000)} Kbps`;
};

const formatRtt = (rtt?: number) => {
  if (!rtt || rtt <= 0) return null;
  return `${Math.round(rtt)} ms`;
};

const deriveConnectionSummary = (opts: {
  online: boolean;
  effectiveType?: string;
  downlink?: number;
}): ConnectionSummary => {
  if (!opts.online) {
    return {
      label: "Offline",
      level: 0,
      tooltip: "No internet connection",
    };
  }

  const token = (opts.effectiveType || "").toLowerCase();
  const mapped = QUALITY_ORDER.find((entry) => token.includes(entry.token));
  if (mapped) {
    return {
      label: mapped.label,
      level: mapped.level,
      tooltip: `Effective network: ${mapped.label}`,
    };
  }

  if (typeof opts.downlink === "number" && opts.downlink > 0) {
    const downlink = opts.downlink;
    const level = downlink >= 20 ? 4 : downlink >= 10 ? 3 : downlink >= 3 ? 2 : 1;
    return {
      label: formatDownlink(downlink) || "Online",
      level,
      tooltip: `Approximate downlink: ${formatDownlink(downlink)}`,
    };
  }

  return {
    label: "Online",
    level: 3,
    tooltip: "Connection detected, bandwidth unknown",
  };
};

export function NetworkStatusBar() {
  const [ipAddress, setIpAddress] = useState<string>("Detecting...");
  const [online, setOnline] = useState<boolean>(() =>
    typeof window === "undefined" ? true : window.navigator.onLine
  );
  const [connectionInfo, setConnectionInfo] = useState<{ effectiveType?: string; downlink?: number; rtt?: number }>();
  const [ipError, setIpError] = useState<string | null>(null);

  // Fetch public IP
  useEffect(() => {
    let cancelled = false;

    const fetchIp = async () => {
      try {
        setIpError(null);
        const response = await fetch("https://api.ipify.org?format=json", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as { ip?: string };
        if (!cancelled) {
          setIpAddress(data.ip || "Unknown IP");
        }
      } catch (error: any) {
        if (!cancelled) {
          setIpAddress("Unavailable");
          setIpError(error?.message || "Failed to resolve IP");
        }
      }
    };

    if (online) {
      fetchIp();
    } else {
      setIpAddress("Offline");
    }

    return () => {
      cancelled = true;
    };
  }, [online]);

  // Track network info
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const nav = navigator as Navigator & {
      connection?: any;
      mozConnection?: any;
      webkitConnection?: any;
    };

    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

    const updateConnection = () => {
      if (!connection) return;
      setConnectionInfo({
        effectiveType: connection.effectiveType,
        downlink: typeof connection.downlink === "number" ? connection.downlink : undefined,
        rtt: typeof connection.rtt === "number" ? connection.rtt : undefined,
      });
    };

    updateConnection();

    connection?.addEventListener?.("change", updateConnection);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      connection?.removeEventListener?.("change", updateConnection);
    };
  }, []);

  const summary = useMemo(
    () =>
      deriveConnectionSummary({
        online,
        effectiveType: connectionInfo?.effectiveType,
        downlink: connectionInfo?.downlink,
      }),
    [online, connectionInfo]
  );

  const downlinkText = formatDownlink(connectionInfo?.downlink);
  const rttText = formatRtt(connectionInfo?.rtt);

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[60] flex justify-start text-[0.65rem] sm:text-xs">
      <div className="pointer-events-auto w-60 rounded-xl border border-white/5 bg-black/65 px-3 py-2.5 text-white shadow-[0_12px_30px_rgba(40,20,120,0.35)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-[0.55rem] uppercase tracking-[0.28em] text-white/50">Network</span>
            <p className="text-sm font-semibold leading-tight text-white">{summary.label}</p>
          </div>
          <div className="flex items-end gap-[2px]" aria-label={summary.tooltip} title={summary.tooltip}>
            {Array.from({ length: MAX_LEVEL }).map((_, idx) => {
              const active = idx < summary.level;
              const height = 5 + idx * 3;
              return (
                <span
                  key={idx}
                  className={`inline-flex w-1 rounded-full transition-colors duration-300 ${
                    active ? "bg-emerald-400" : "bg-white/20"
                  }`}
                  style={{ height: `${height}px` }}
                />
              );
            })}
          </div>
        </div>
        <div className="mt-2 space-y-1 text-white/70">
          <div className="flex items-center justify-between">
            <span className="uppercase tracking-[0.12em] text-white/35">IP</span>
            <span className="font-medium text-white/80">{ipAddress}</span>
          </div>
          {downlinkText ? (
            <div className="flex items-center justify-between">
              <span className="uppercase tracking-[0.12em] text-white/35">Down</span>
              <span className="font-medium text-white/80">{downlinkText}</span>
            </div>
          ) : null}
          {rttText ? (
            <div className="flex items-center justify-between">
              <span className="uppercase tracking-[0.12em] text-white/35">Latency</span>
              <span className="font-medium text-white/80">{rttText}</span>
            </div>
          ) : null}
          {ipError ? (
            <div className="text-right text-[0.55rem] text-rose-300/85">{ipError}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
