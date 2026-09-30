"use client";

import { useState, useEffect } from "react";
import { Mail, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

interface SupportTicket {
  id: number;
  user_email: string;
  subject: string;
  message: string;
  status: "new" | "in_progress" | "resolved";
  created_at: string;
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const response = await api.get("/support/tickets");
      setTickets(response.data);
    } catch (error) {
      console.error("Error loading tickets:", error);
      // Демо данные
      setTickets([
        { id: 1, user_email: "user1@example.com", subject: "Не работает AI-генерация", message: "При попытке сгенерировать заявку появляется ошибка 500...", status: "new", created_at: "2026-09-29" },
        { id: 2, user_email: "user2@example.com", subject: "Вопрос по оплате", message: "Не пришёл чек после оплаты подписки...", status: "in_progress", created_at: "2026-09-28" },
        { id: 3, user_email: "user3@example.com", subject: "Как добавить документы?", message: "Не могу найти раздел для загрузки документов...", status: "resolved", created_at: "2026-09-27" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (id: number) => {
    try {
      await api.put(`/support/tickets/${id}`, { status: "resolved" });
      loadTickets();
    } catch (error) {
      console.error("Error resolving ticket:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new":
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Новое</span>;
      case "in_progress":
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">В работе</span>;
      case "resolved":
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Решено</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Обращения в поддержку</h1>
        <p className="text-sm text-gray-500 mt-1">
          Почта обращения по тех. вопросам к администратору сайта
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Обращений нет</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusBadge(ticket.status)}
                    <span className="text-sm text-gray-500">{ticket.user_email}</span>
                    <span className="text-sm text-gray-400 flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(ticket.created_at).toLocaleDateString("ru-RU")}</span>
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{ticket.subject}</h3>
                  <p className="text-gray-600">{ticket.message}</p>
                </div>
                {ticket.status !== "resolved" && (
                  <button
                    onClick={() => handleResolve(ticket.id)}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center space-x-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Решено</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
