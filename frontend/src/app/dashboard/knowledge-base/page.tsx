"use client";

import { useState } from "react";
import { BookOpen, Upload, FileText, Trash2, Search } from "lucide-react";
import { api } from "@/lib/api";

interface Document {
  id: number;
  name: string;
  type: string;
  size: string;
  uploaded_at: string;
}

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<Document[]>([
    { id: 1, name: "ГОСТ Р 12345-2020.pdf", type: "PDF", size: "2.5 МБ", uploaded_at: "2026-09-15" },
    { id: 2, name: "Реквизиты компании.docx", type: "DOCX", size: "150 КБ", uploaded_at: "2026-09-10" },
    { id: 3, name: "Прошлые заявки.zip", type: "ZIP", size: "5.2 МБ", uploaded_at: "2026-09-05" },
  ]);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      await api.post("/knowledge/documents", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Добавляем в список
      setDocuments([
        {
          id: Date.now(),
          name: file.name,
          type: file.name.split(".").pop()?.toUpperCase() || "FILE",
          size: `${(file.size / 1024 / 1024).toFixed(1)} МБ`,
          uploaded_at: new Date().toISOString().split("T")[0],
        },
        ...documents,
      ]);
    } catch (error) {
      console.error("Error uploading document:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/knowledge/documents/${id}`);
      setDocuments(documents.filter((d) => d.id !== id));
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  };

  const filteredDocuments = documents.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">База знаний RAG</h1>
        <p className="text-sm text-gray-500 mt-1">
          Векторный поиск по ГОСТам, ФЗ-44, прошлым заявкам и реквизитам компании
        </p>
      </div>

      {/* Описание */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
        <h3 className="font-semibold text-purple-900 mb-2">Что можно загрузить</h3>
        <ul className="text-sm text-purple-800 space-y-1">
          <li>• ГОСТы и технические регламенты</li>
          <li>• Тексты ФЗ-44 и ФЗ-223</li>
          <li>• Прошлые заявки компании</li>
          <li>• Реквизиты и документы</li>
          <li>• Шаблоны и инструкции</li>
        </ul>
      </div>

      {/* Загрузка и поиск */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по документам..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <label className="inline-flex items-center space-x-2 px-4 py-2.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            <span>{uploading ? "Загрузка..." : "Загрузить документ"}</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.zip"
              onChange={handleUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Список документов */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Документы ({documents.length})</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {filteredDocuments.length === 0 ? (
            <div className="p-8 text-center">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Документы не найдены</p>
            </div>
          ) : (
            filteredDocuments.map((doc) => (
              <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{doc.name}</p>
                    <p className="text-sm text-gray-500">
                      {doc.type} • {doc.size} • {doc.uploaded_at}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Удалить"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
