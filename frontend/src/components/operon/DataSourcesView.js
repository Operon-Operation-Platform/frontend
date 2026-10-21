"use client";

import React, { useState, useEffect } from "react";
import {
  Database,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Shield,
  Layers,
  Sparkles,
  Server,
  Play,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { operonApi } from "../../api/operon";

const SOURCE_TYPE_LABELS = {
  postgres: { label: "PostgreSQL", badge: "SQL Database", color: "bg-blue-50 text-blue-700" },
  mysql:    { label: "MySQL", badge: "SQL Database", color: "bg-cyan-50 text-cyan-700" },
  neo4j:    { label: "Neo4j Graph", badge: "Graph Database", color: "bg-emerald-50 text-emerald-700" },
  vector:   { label: "Vector Store", badge: "Vector Embeddings", color: "bg-purple-50 text-purple-700" },
  hybrid:   { label: "Hybrid RAG", badge: "Legacy source type", color: "bg-indigo-50 text-indigo-700" },
};

export default function DataSourcesView({ onRefresh }) {
  const [sources, setSources] = useState([]);
  const [indexes, setIndexes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("sources"); // 'sources' | 'indexes' | 'test'

  // Modals
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showIndexModal, setShowIndexModal] = useState(false);

  // Connect form state
  const [connectForm, setConnectForm] = useState({
    name: "",
    source_type: "postgres",
    connection_uri: "",
    allowlisted_tables: "",
    allowlisted_schemas: "public",
    read_only: true,
  });
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Create index form state
  const [indexForm, setIndexForm] = useState({
    name: "",
    retrieval_mode: "keyword",
    documents: "",
  });

  // Retrieval test widget
  const [testQuery, setTestQuery] = useState("");
  const [retrievalResults, setRetrievalResults] = useState(null);
  const [retrievalSearching, setRetrievalSearching] = useState(false);

  // Deletion modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteConfirmText.trim() !== deleteTarget.name.trim()) return;
    setDeleting(true);
    try {
      if (deleteTarget.isIndex) {
        await operonApi.dataSources.deleteKnowledgeIndex(deleteTarget.id);
        setIndexes((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      } else {
        await operonApi.dataSources.deleteDataSource(deleteTarget.id);
        setSources((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      }
    } catch {
      // resilient
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
      setDeleteConfirmText("");
      if (onRefresh) onRefresh();
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sourcesRes, indexesRes] = await Promise.allSettled([
        operonApi.dataSources.getDataSources(),
        operonApi.dataSources.getKnowledgeIndexes(),
      ]);
      if (sourcesRes.status === "fulfilled") setSources(sourcesRes.value || []);
      if (indexesRes.status === "fulfilled") setIndexes(indexesRes.value || []);
    } catch {
      // resilient
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setFormError("");
    setTestResult(null);
    try {
      const payload = {
        name: connectForm.name || "Test Connection",
        source_type: connectForm.source_type,
        connection_uri: connectForm.connection_uri,
        allowlisted_tables: connectForm.allowlisted_tables.split(",").map((s) => s.trim()).filter(Boolean),
        read_only: connectForm.read_only,
      };
      const res = await operonApi.dataSources.testDataSource(payload);
      setTestResult(res);
    } catch (err) {
      setFormError(err.message || "Connection test failed.");
    } finally {
      setTesting(false);
    }
  };

  const handleConnectSubmit = async (e) => {
    e.preventDefault();
    if (!connectForm.name.trim()) {
      setFormError("Source name is required.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const payload = {
        name: connectForm.name.trim(),
        source_type: connectForm.source_type,
        connection_uri: connectForm.connection_uri.trim(),
        allowlisted_tables: connectForm.allowlisted_tables.split(",").map((s) => s.trim()).filter(Boolean),
        allowlisted_schemas: connectForm.allowlisted_schemas.split(",").map((s) => s.trim()).filter(Boolean),
        read_only: connectForm.read_only,
      };
      await operonApi.dataSources.connectDataSource(payload);
      setShowConnectModal(false);
      setConnectForm({
        name: "",
        source_type: "postgres",
        connection_uri: "",
        allowlisted_tables: "",
        allowlisted_schemas: "public",
        read_only: true,
      });
      setTestResult(null);
      await fetchData();
      if (onRefresh) onRefresh();
    } catch (err) {
      setFormError(err.message || "Failed to register data source.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateIndexSubmit = async (e) => {
    e.preventDefault();
    if (!indexForm.name.trim()) return;
    setSubmitting(true);
    try {
      const docs = indexForm.documents
        ? indexForm.documents.split("\n\n").map((d, i) => ({ title: `Doc ${i + 1}`, content: d.trim() }))
        : [];
      await operonApi.dataSources.createKnowledgeIndex({
        name: indexForm.name.trim(),
        retrieval_mode: indexForm.retrieval_mode,
        documents: docs,
      });
      setShowIndexModal(false);
      setIndexForm({ name: "", retrieval_mode: "keyword", documents: "" });
      await fetchData();
      if (onRefresh) onRefresh();
    } catch (err) {
      setFormError(err.message || "Failed to create knowledge index.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunRetrievalTest = async (e) => {
    e.preventDefault();
    if (!testQuery.trim()) return;
    setFormError("");
    setRetrievalSearching(true);
    try {
      const res = await operonApi.dataSources.testQuery({ query: testQuery });
      setRetrievalResults(res?.results || []);
    } catch (err) {
      setRetrievalResults([]);
      setFormError(err.message || "Could not search the knowledge indexes.");
    } finally {
      setRetrievalSearching(false);
    }
  };

  const filteredSources = sources.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.source_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="operon-themed-view space-y-6 text-slate-800 dark:text-gray-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold  transition">Data Sources & Knowledge Retrieval</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Tenant Sandboxed
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage registered source metadata and RAG documents stored in this workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors duration-200"
            title="Refresh sources"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowIndexModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors duration-200"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            New Knowledge Index
          </button>
          <button
            onClick={() => {
              setTestResult(null);
              setFormError("");
              setShowConnectModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Connect Database
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Registered Data Sources</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{sources.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Saved in this workspace</p>
        </div>

        <div className="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Knowledge Indexes</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{indexes.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">User added RAG documents</p>
        </div>

        <div className="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Security Sandbox</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">{sources.filter((source) => source.schema_config?.read_only).length}</div>
          <p className="text-[11px] text-slate-400 mt-1 transition">Registered sources marked read-only</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("sources")}
          className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition ${
            activeTab === "sources"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Databases ({sources.length})
        </button>
        <button
          onClick={() => setActiveTab("indexes")}
          className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition ${
            activeTab === "indexes"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Knowledge Indexes ({indexes.length})
        </button>
        <button
          onClick={() => setActiveTab("test")}
          className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
            activeTab === "test"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Play className="w-3 h-3 text-blue-500" />
          Test Retrieval Query
        </button>
      </div>

      {/* Tab: Databases */}
      {activeTab === "sources" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search connected data sources..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-44 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-5 animate-pulse" />
              ))}
            </div>
          ) : filteredSources.length === 0 ? (
            <div className="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
              <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-900">No data sources connected</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Register a source and its access rules. External database connections are not configured yet.
              </p>
              <button
                onClick={() => setShowConnectModal(true)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition"
              >
                Connect First Database
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSources.map((s) => {
                const meta = SOURCE_TYPE_LABELS[s.source_type] || {
                  label: s.source_type,
                  badge: "Data Connector",
                  color: "bg-slate-50 text-slate-700",
                };
                const allowlisted = s.schema_config?.allowlisted_tables || [];
                const isReadOnly = s.schema_config?.read_only !== false;
                return (
                  <div
                    key={s.id}
                    className="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors duration-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-blue-600">
                          <Database className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">{s.name}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${meta.color}`}>
                              {meta.label}
                            </span>
                          <span className="text-[10px] text-slate-400">
                              {s.created_at ? new Date(s.created_at).toLocaleDateString() : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          <CheckCircle2 className="w-3 h-3" /> {s.status || "Registered"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget({ ...s, isIndex: false });
                            setDeleteConfirmText("");
                          }}
                          className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                          title={`Delete ${s.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 mt-4 pt-3 border-t border-slate-100 text-xs">
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Permission Model:</span>
                        <span className="font-medium text-slate-800 flex items-center gap-1">
                          <Shield className="w-3 h-3 text-emerald-600" />
                          {isReadOnly ? "Read-Only Enforced" : "Read/Write"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Allowlisted Tables:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {allowlisted.map((tbl) => (
                            <span
                              key={tbl}
                              className="text-[10px] px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-600 font-mono"
                            >
                              {tbl}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Knowledge Indexes */}
      {activeTab === "indexes" && (
        <div className="space-y-4">
          {indexes.length === 0 ? (
            <div className="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-900">No knowledge indexes yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Create an index from text documents you add for agent retrieval.
              </p>
              <button
                onClick={() => setShowIndexModal(true)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition"
              >
                Create First Index
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {indexes.map((idx) => (
                <div
                  key={idx.id}
                  className="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors duration-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{idx.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                            {idx.retrieval_mode.toUpperCase()} RAG
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {idx.doc_count || 0} documents registered
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Stored
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTarget({ ...idx, isIndex: true });
                          setDeleteConfirmText("");
                        }}
                        className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                        title={`Delete ${idx.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Retrieval Test Playground */}
      {activeTab === "test" && (
        <div className="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Keyword Retrieval</h3>
            <p className="text-xs text-slate-500 mt-0.5">
Search document text that has been added to this workspace's knowledge indexes.
            </p>
          </div>

          <form onSubmit={handleRunRetrievalTest} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                placeholder="Ask a question or enter keywords (e.g. 'refund policy for duplicate charges', 'SLA response times')..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
              />
            </div>
            <button
              type="submit"
              disabled={retrievalSearching || !testQuery.trim()}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium transition-colors duration-200 flex items-center gap-2"
            >
              {retrievalSearching ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Search Documents
                </>
              )}
            </button>
          </form>

          {retrievalResults && (
            <div className="space-y-3 pt-4 border-t border-slate-100">
              {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Matching documents ({retrievalResults.length})</span>
              </div>

              {retrievalResults.length === 0 ? <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">No matching documents were found in the saved knowledge bases.</p> : retrievalResults.map((res) => (
                <div key={res.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-semibold text-slate-900">{res.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600 font-mono">
                        {res.source}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                        {res.mode}
                      </span>
                      <span className="text-xs font-bold text-slate-800">Score: {res.score}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-sans">{res.snippet}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Connect Database Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Register Data Source</h3>
                  <p className="text-[11px] text-slate-500">Source metadata only; external connectivity is not configured.</p>
                </div>
              </div>
              <button
                onClick={() => setShowConnectModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleConnectSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Source Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Production PostgreSQL (Customer Analytics)"
                  value={connectForm.name}
                  onChange={(e) => setConnectForm({ ...connectForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Data Source Type</label>
                <select
                  value={connectForm.source_type}
                  onChange={(e) => setConnectForm({ ...connectForm, source_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 bg-white"
                >
                  <option value="postgres">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="neo4j">Neo4j Graph Database</option>
                </select>
              </div>

              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">This saves source metadata and access rules. External database connectivity is not configured yet.</p>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Allowlisted Tables</label>
                <input
                  type="text"
                  placeholder="customers, orders, tickets, products"
                  value={connectForm.allowlisted_tables}
                  onChange={(e) => setConnectForm({ ...connectForm, allowlisted_tables: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-slate-800 focus:outline-none focus:border-blue-600"
                />
                <p className="text-[10px] text-slate-400 mt-1">Comma-separated table allowlist boundary.</p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="readonly"
                  checked={connectForm.read_only}
                  onChange={(e) => setConnectForm({ ...connectForm, read_only: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="readonly" className="text-slate-700 font-medium select-none cursor-pointer">
                  Enforce Read-Only Mode (Recommended)
                </label>
              </div>

              {/* Test Connection Output */}
              {testResult && (
                <div className={`p-3 rounded-lg border text-xs space-y-1 ${testResult.success ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
                  <div className="flex items-center gap-1.5 font-semibold">
                    {testResult.success ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
                    <span>{testResult.success ? "Connection verified" : "Connection test unavailable"}</span>
                  </div>
                  <p className="text-[11px]">{testResult.message}</p>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition"
                >
                  {testing ? "Testing..." : "Test Connection"}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConnectModal(false)}
                    className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium shadow-sm transition"
                  >
                    {submitting ? "Saving..." : "Save Data Source"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Knowledge Index Modal */}
      {showIndexModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Create Knowledge Index</h3>
                  <p className="text-[11px] text-slate-500">Keyword retrieval over documents you add</p>
                </div>
              </div>
              <button
                onClick={() => setShowIndexModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateIndexSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Index Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. support-faq-v2"
                  value={indexForm.name}
                  onChange={(e) => setIndexForm({ ...indexForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Retrieval Mode</label>
                <select
                  value={indexForm.retrieval_mode}
                  onChange={(e) => setIndexForm({ ...indexForm, retrieval_mode: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 bg-white"
                >
                  <option value="keyword">Keyword retrieval</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Knowledge Documents (required)
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Paste the document text you want agents to retrieve..."
                  value={indexForm.documents}
                  onChange={(e) => setIndexForm({ ...indexForm, documents: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowIndexModal(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !indexForm.documents.trim()}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium shadow-sm transition"
                >
                  {submitting ? "Indexing..." : "Build Knowledge Index"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Centered Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 rounded-2xl shadow-2xl p-6 text-center animate-slide-up">
            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-gray-100 mb-2">
              Are you sure you want to delete {deleteTarget.name}?
            </h3>
            <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-2">
              This action cannot be undone.
            </p>
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-5 leading-relaxed">
              This saved data source record will be permanently removed.
            </p>
            <div className="text-left mb-5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">
                To confirm, type <span className="font-mono text-red-600 dark:text-red-400 font-bold select-all">{deleteTarget.name}</span> in the box below:
              </label>
              <input
                type="text"
                autoFocus
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={`Type "${deleteTarget.name}" to confirm`}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-gray-100 text-sm focus:outline-none focus:border-red-500 transition"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirmText("");
                }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteConfirmText.trim() !== deleteTarget.name.trim() || deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors duration-200 shadow-md shadow-red-600/20"
              >
                {deleting ? "Deleting…" : "Delete Database"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
