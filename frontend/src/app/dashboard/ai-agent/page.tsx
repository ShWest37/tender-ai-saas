"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  FileText,
  Quote,
} from "lucide-react";
import { api } from "@/lib/api";

interface CriticIssue {
  severity: string;
  field?: string | null;
  message: string;
  evidence_quote?: string | null;
  grounded?: boolean | null;
  source?: string | null;
}

interface DeterministicCheck {
  code: string;
  name: string;
  status: string;
  severity: string;
  message: string;
}

interface CriticReport {
  confidence?: number | null;
  admitted: boolean;
  requires_manual_review: boolean;
  issues: CriticIssue[];
  not_found: string[];
  hallucinated_evidence: string[];
  grounding: { context_found?: boolean | null; chunks_count?: number; sources?: string[]; pending?: boolean };
  deterministic?: {
    checks?: DeterministicCheck[];
    is_blocking?: boolean;
    failed_count?: number;
    warnings_count?: number;
  };
  disclaimer_required?: boolean;
  checked_at?: string | null;
  // pending (в очереди) | completed | unavailable | skipped
  llm_status?: string | null;
}

interface ApplicationDetail {
  id: number;
  status: string;
  ai_confidence_score: number | null;
  generated_content: Record<string, any> | null;
  critic_report: CriticReport | null;
  deterministic_report: Record<string, any> | null;
  disclaimer_accepted: boolean;
  review_confirmed_at: string | null;
  tender?: {
    id: number;
    title: string;
    platform: string;
    initial_price: number | null;
    law_type: string | null;
    submission_deadline: string | null;
  };
}

const severityStyles: Record<string, { badge: string; icon: any }> = {
  critical: { badge: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  major: { badge: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle },
  minor: { badge: "bg-blue-100 text-blue-700 border-blue-200", icon: FileText },
};

const contentLabels: Record<string, string> = {
  offer_price: "Цена предложения",
  delivery_terms: "Сроки поставки",
  warranty: "Гарантия",
  qualification: "Квалификация",
  notes: "Примечания",
};

export default function AiAgentPage() {
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadApplication = useCallback(async (id: number) => {
    const resp = await api.get(`/applications/${id}`);
    setApplication(resp.data);
    return resp.data as ApplicationDetail;
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const applicationId = params.get("application_id");
        const tenderId = params.get("tender_id");

        if (applicationId) {
          await loadApplication(Number(applicationId));
        } else if (tenderId) {
          const resp = await api.post("/applications", { tender_id: Number(tenderId) });
          await loadApplication(resp.data.id);
        } else {
          setError("Не указан тендер или заявка. Откройте страницу из списка заявок или тендеров.");
        }
      } catch (e: any) {
        setError(e?.response?.data?.detail || "Не удалось загрузить заявку");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadApplication]);

  const runGeneration = async () => {
    if (!application) return;
    setGenerating(true);
    setError(null);
    try {
      await api.post("/ai/generate-application", {
        tender_id: application.tender?.id,
        application_id: application.id,
      });
      // Генерация идёт в очереди — периодически обновляем карточку.
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const fresh = await loadApplication(application.id);
        if (fresh.generated_content && Object.keys(fresh.generated_content).length > 0) break;
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Очередь задач недоступна, попробуйте позже");
    } finally {
      setGenerating(false);
    }
  };

  const runCritique = async () => {
    if (!application) return;
    setChecking(true);
    setError(null);
    try {
      // Синхронно приходит детерминированный отчёт; LLM-этап уходит в очередь.
      const resp = await api.post(`/ai/applications/${application.id}/critique`, {
        use_llm: true,
      });
      await loadApplication(application.id);

      const llmStatus = resp.data?.llm_status;
      if (llmStatus === "queued" || llmStatus === "pending") {
        // Опрашиваем карточку, пока фоновый LLM-критик не завершится.
        await pollLlmStatus(application.id);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Не удалось запустить проверку");
    } finally {
      setChecking(false);
    }
  };

  const pollLlmStatus = async (applicationId: number) => {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const fresh = await loadApplication(applicationId);
      const status = fresh.critic_report?.llm_status;
      if (status && status !== "pending") return;
    }
  };

  const confirmReview = async () => {
    if (!application || !disclaimerAccepted) return;
    setConfirming(true);
    setError(null);
    try {
      await api.post(`/ai/applications/${application.id}/confirm-review`, {
        disclaimer_accepted: true,
        notes: notes || undefined,
      });
      await loadApplication(application.id);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Не удалось подтвердить проверку");
    } finally {
      setConfirming(false);
    }
  };

  const report = application?.critic_report || null;
  const llmStatus = report?.llm_status || "completed";
  const llmPending = llmStatus === "pending";

  const confidence = useMemo(() => {
    const value = report?.confidence ?? application?.ai_confidence_score;
    return value != null ? Math.round(value * 100) : null;
  }, [report, application]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12 bg-white rounded-lg">
        <Bot className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">{error || "Заявка не найдена"}</p>
      </div>
    );
  }

  const generated = application.generated_content || {};

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bot className="w-7 h-7 text-blue-500" />
          AI-агент: проверка заявки
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {application.tender?.title || `Тендер #${application.tender?.id}`}
          {application.tender?.platform ? ` · ${application.tender.platform}` : ""}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {/* Предупреждение о ручной отправке */}
      <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4 text-sm flex gap-3">
        <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <span>
          Система подсвечивает ошибки, но <strong>не отправляет заявку сама</strong>. После
          проверки вы обязаны нажать «Подтверждаю проверку».
        </span>
      </div>

      {/* Сгенерированное содержимое */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Сгенерированная заявка</h2>
          <button
            onClick={runGeneration}
            disabled={generating}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {generating ? "Генерация..." : "Сгенерировать заново"}
          </button>
        </div>

        {Object.keys(generated).length === 0 ? (
          <p className="text-sm text-gray-400">Заявка ещё не сгенерирована.</p>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(generated).map(([key, value]) => (
              <div key={key} className="border border-gray-100 rounded-lg p-3">
                <dt className="text-xs uppercase text-gray-400">{contentLabels[key] || key}</dt>
                <dd className="text-sm text-gray-900 mt-1 break-words">
                  {typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* Запуск критика */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow-sm p-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">ИИ-критик</h2>
          <p className="text-sm text-gray-500">
            Детерминированные проверки (код) + строгий LLM по документации.
          </p>
        </div>
        <button
          onClick={runCritique}
          disabled={checking || llmPending}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg flex items-center gap-2 disabled:opacity-50"
        >
          {checking || llmPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4" />
          )}
          {checking ? "Проверка..." : llmPending ? "ИИ проверяет..." : report ? "Проверить заново" : "Запустить проверку"}
        </button>
      </div>

      {/* Отчёт критика */}
      {report && (
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${report.admitted ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                }`}
            >
              {report.admitted ? "Можно подавать" : "Требуется ручная проверка"}
            </span>
            {confidence != null && (
              <span className="text-sm text-gray-600">
                Уверенность ИИ: <strong>{confidence}%</strong>
              </span>
            )}

            {llmPending ? (
              <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                ИИ-проверка выполняется в фоне…
              </span>
            ) : llmStatus === "unavailable" ? (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700">
                ИИ недоступен — показаны только автопроверки кодом
              </span>
            ) : llmStatus === "skipped" ? (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                ИИ-проверка не запускалась
              </span>
            ) : (
              <span
                className={`text-xs px-2 py-0.5 rounded ${report.grounding?.context_found
                  ? "bg-green-50 text-green-700"
                  : "bg-gray-100 text-gray-600"
                  }`}
              >
                {report.grounding?.context_found
                  ? `Документация найдена (${report.grounding?.chunks_count || 0} фрагм.)`
                  : "Документация не найдена — ответы ИИ не подтверждены"}
              </span>
            )}
          </div>

          {report.hallucinated_evidence?.length > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
              <strong>Обнаружены выдуманные цитаты:</strong> ИИ сослался на текст, которого нет в
              документации. Замечания с такими цитатами считаются недостоверными.
            </div>
          )}

          {report.not_found?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 text-sm">
              <strong>Не найдено в документации:</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                {report.not_found.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Замечания */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Замечания ({report.issues?.length || 0})
            </h3>
            {report.issues?.length === 0 ? (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Замечаний не найдено.
              </p>
            ) : (
              <ul className="space-y-2">
                {report.issues.map((issue, i) => {
                  const style = severityStyles[issue.severity] || severityStyles.minor;
                  const Icon = style.icon;
                  return (
                    <li key={i} className={`border rounded-lg p-3 ${style.badge}`}>
                      <div className="flex items-start gap-2">
                        <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{issue.message}</p>
                          {issue.evidence_quote && (
                            <p className="text-xs mt-1 opacity-80 flex items-start gap-1">
                              <Quote className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              <span className="italic">{issue.evidence_quote}</span>
                              {issue.grounded === false && (
                                <span className="not-italic font-semibold">
                                  (цитата не найдена — недостоверно)
                                </span>
                              )}
                            </p>
                          )}
                          <p className="text-[11px] uppercase mt-1 opacity-70">
                            {issue.source === "deterministic" ? "автопроверка" : "ИИ"} · {issue.severity}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Детерминированные проверки */}
          {report.deterministic?.checks && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Автоматические проверки кодом
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {report.deterministic.checks.map((check) => (
                  <li
                    key={check.code}
                    className="flex items-start gap-2 text-xs border border-gray-100 rounded p-2"
                  >
                    {check.status === "pass" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : check.status === "fail" ? (
                      <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    )}
                    <span className="text-gray-600">{check.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Дисклеймер и подтверждение */}
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Подтверждение проверки</h2>

        {application.disclaimer_accepted ? (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 text-sm flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            Проверка подтверждена{" "}
            {application.review_confirmed_at &&
              new Date(application.review_confirmed_at).toLocaleString("ru-RU")}
            .
          </div>
        ) : (
          <>
            <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={disclaimerAccepted}
                onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <span>
                Я проверил сгенерированные данные и несу ответственность за их корректность
              </span>
            </label>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Комментарий к проверке (необязательно)"
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />

            <button
              onClick={confirmReview}
              disabled={!disclaimerAccepted || !report || confirming || llmPending}
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Подтверждаю проверку
            </button>
            {!report && (
              <p className="text-xs text-gray-400">
                Сначала запустите проверку ИИ-критиком.
              </p>
            )}
            {llmPending && (
              <p className="text-xs text-gray-400">
                Дождитесь завершения ИИ-проверки — после этого можно подтвердить проверку.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
