"use client";

import React, { useState, useEffect } from "react";
import {
  Layers, Search, CheckCircle2, XCircle, AlertCircle,
  Plus, ExternalLink, RefreshCw, Plug,
} from "lucide-react";
import { operonApi } from "../../api/operon";

const CATEGORY_COLORS = {
  "Customer Support": "bg-blue-50 text-blue-700",
  "CRM & Sales":      "bg-violet-50 text-violet-700",
  "Communication":    "bg-emerald-50 text-emerald-700",
  "Database":         "bg-amber-50 text-amber-700",
  "Monitoring":       "bg-red-50 text-red-700",
  "MCP":              "bg-slate-100 text-slate-700",
};

function StatusBadge({ status }) {
  if (status === "connected") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
      <CheckCircle2 className="w-3 h-3" /> Connected
    </span>
  );
  if (status === "error") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
      <XCircle className="w-3 h-3" /> Error
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
      Not connected
    </span>
  );
}

function IntegrationCard({ item, onConnect, onDisconnect, onTest }) {
  const [loading, setLoading] = useState(false);
  const isConnected = item.status === "connected";
  const catColor = CATEGORY_COLORS[item.category] || "bg-slate-100 text-slate-600";

  const handleConnect = async () => {
    setLoading(true);
    try { await onConnect(item); } finally { setLoading(false); }
  };
  const handleDisconnect = async () => {
    setLoading(true);
    try { await onDisconnect(item); } finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-sm transition-all duration-150">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-lg">
            {item.icon || "🔌"}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">{item.name}</h3>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${catColor}`}>
              {item.category}
            </span>
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-2">{item.description}</p>

      {item.capabilities?.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {item.capabilities.slice(0, 3).map((cap) => (
            <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-500">
              {cap}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
        {isConnected ? (
          <>
            <button
              onClick={() => onTest(item)}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Test
            </button>
            <button
              onClick={handleDisconnect} disabled={loading}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-100 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {loading ? "…" : "Disconnect"}
            </button>
          </>
        ) : item.coming_soon ? (
          <span className="text-xs text-slate-400 font-medium">Coming soon</span>
        ) : (
          <button
            onClick={handleConnect} disabled={loading}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
          >
            {loading ? "Connecting…" : "Connect"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function IntegrationsView({ onRefresh }) {
  const [catalog, setCatalog] = useState([]);
  const [connections, setConnections] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cat, conn] = await Promise.allSettled([
        operonApi.integrations.getCatalog(),
        operonApi.integrations.getConnections(),
      ]);
      const catItems = cat.status === "fulfilled" ? (cat.value || []) : [];
      const connItems = conn.status === "fulfilled" ? (conn.value || []) : [];
      // Merge connection status into catalog
      const merged = catItems.map((item) => {
        const found = connItems.find((c) => c.provider_key === item.key);
        return { ...item, status: found ? "connected" : "disconnected", connection_id: found?.id };
      });
      setCatalog(merged);
      setConnections(connItems);
    } catch (e) {
      setError("Failed to load integrations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const categories = ["all", ...new Set(catalog.map((i) => i.category).filter(Boolean))];

  const filtered = catalog.filter((item) => {
    const matchCat = category === "all" || item.category === category;
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const connected = catalog.filter((i) => i.status === "connected").length;

  const handleConnect = async (item) => {
    try {
      await operonApi.integrations.connect({ provider_key: item.key });
      fetchData();
    } catch (e) {
      alert("Connection failed: " + e.message);
    }
  };

  const handleDisconnect = async (item) => {
    if (!item.connection_id) return;
    try {
      await operonApi.integrations.disconnect(item.connection_id);
      fetchData();
    } catch (e) {
      alert("Disconnect failed: " + e.message);
    }
  };

  const handleTest = async (item) => {
    try {
      await operonApi.integrations.test({ provider_key: item.key });
      alert("Connection test successful.");
    } catch (e) {
      alert("Test failed: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Integrations</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Connect your business tools and authorize agent access.
            {connected > 0 && ` ${connected} connected.`}
          </p>
        </div>
        <button onClick={fetchData} className="btn-secondary text-xs gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search integrations…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                category === cat
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 h-48 skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
            <Plug className="w-7 h-7 text-slate-400" />
          </div>
          <h3 className="text-base font-medium text-slate-900 mb-1">No integrations found</h3>
          <p className="text-sm text-slate-500">Try a different search or category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <IntegrationCard
              key={item.key} item={item}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onTest={handleTest}
            />
          ))}
        </div>
      )}
    </div>
  );
}
