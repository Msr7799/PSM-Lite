"use client";

import { useState, useEffect, FormEvent } from "react";
import { Bell, Plus, X, Upload, FileIcon, Trash2 } from "lucide-react";

interface Note {
  id: string;
  title: string;
  content: string;
  priority: string;
  isResolved: boolean;
  authorEmail: string | null;
  attachments: any;
  createdAt: string;
  unit: { id: string; name: string } | null;
}

interface Unit {
  id: string;
  name: string;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    priority: "NORMAL",
    unitId: "",
    attachments: [] as any[],
  });

  useEffect(() => {
    fetchNotes();
    fetchUnits();
  }, []);

  const fetchNotes = async () => {
    try {
      const res = await fetch("/api/notes");
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
      }
    } catch (error) {
      console.error("Failed to fetch notes:", error);
    }
  };

  const fetchUnits = async () => {
    try {
      const res = await fetch("/api/units");
      if (res.ok) {
        const data = await res.json();
        setUnits(data);
      }
    } catch (error) {
      console.error("Failed to fetch units:", error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const uploaded = await res.json();
        setFormData((prev) => ({
          ...prev,
          attachments: [...prev.attachments, uploaded],
        }));
      }
    } catch (error) {
      console.error("Upload failed:", error);
      alert("فشل رفع الملف");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          unitId: formData.unitId || null,
        }),
      });

      if (res.ok) {
        setShowForm(false);
        setFormData({
          title: "",
          content: "",
          priority: "NORMAL",
          unitId: "",
          attachments: [],
        });
        fetchNotes();
      }
    } catch (error) {
      console.error("Failed to create note:", error);
      alert("فشل إنشاء الملاحظة");
    } finally {
      setLoading(false);
    }
  };

  const toggleResolved = async (id: string, isResolved: boolean) => {
    try {
      await fetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isResolved: !isResolved }),
      });
      fetchNotes();
    } catch (error) {
      console.error("Failed to toggle note:", error);
    }
  };

  const deleteNote = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الملاحظة؟")) return;

    try {
      await fetch(`/api/notes/${id}`, { method: "DELETE" });
      fetchNotes();
    } catch (error) {
      console.error("Failed to delete note:", error);
    }
  };

  const priorityColors: Record<string, string> = {
    LOW: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    NORMAL: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    URGENT: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-6 h-6" />
          <h1 className="text-2xl font-bold">الملاحظات والتنبيهات</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          ملاحظة جديدة
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">إضافة ملاحظة جديدة</h2>
              <button onClick={() => setShowForm(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">العنوان *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">المحتوى *</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  required
                  rows={4}
                  className="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">الأولوية</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600"
                  >
                    <option value="LOW">منخفضة</option>
                    <option value="NORMAL">عادية</option>
                    <option value="HIGH">عالية</option>
                    <option value="URGENT">عاجلة</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">العقار (اختياري)</label>
                  <select
                    value={formData.unitId}
                    onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600"
                  >
                    <option value="">-- بدون --</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">المرفقات</label>
                <div className="space-y-2">
                  {formData.attachments.map((file: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-700 rounded">
                      <FileIcon className="w-4 h-4" />
                      <span className="flex-1 text-sm">{file.filename}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            attachments: formData.attachments.filter((_: any, i: number) => i !== idx),
                          })
                        }
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <label className="flex items-center gap-2 px-4 py-2 border-2 border-dashed rounded-md cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">{uploadingFile ? "جاري الرفع..." : "رفع ملف"}</span>
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx"
                    />
                  </label>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
                >
                  {loading ? "جاري الحفظ..." : "حفظ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {notes.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>لا توجد ملاحظات حالياً</p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className={`p-4 rounded-lg border ${
                note.isResolved
                  ? "bg-slate-50 dark:bg-slate-900 opacity-60"
                  : "bg-white dark:bg-slate-800"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">{note.title}</h3>
                    <span className={`text-xs px-2 py-1 rounded ${priorityColors[note.priority]}`}>
                      {note.priority === "LOW" && "منخفضة"}
                      {note.priority === "NORMAL" && "عادية"}
                      {note.priority === "HIGH" && "عالية"}
                      {note.priority === "URGENT" && "عاجلة"}
                    </span>
                    {note.unit && (
                      <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
                        {note.unit.name}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{note.content}</p>
                  {note.attachments && Array.isArray(note.attachments) && note.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {note.attachments.map((file: any, idx: number) => (
                        <a
                          key={idx}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50"
                        >
                          <FileIcon className="w-3 h-3" />
                          {file.filename}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-slate-500">
                    {new Date(note.createdAt).toLocaleString("ar-SA")}
                    {note.authorEmail && ` • بواسطة ${note.authorEmail}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleResolved(note.id, note.isResolved)}
                    className={`px-3 py-1 text-sm rounded ${
                      note.isResolved
                        ? "bg-green-100 text-green-800 hover:bg-green-200"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                  >
                    {note.isResolved ? "تم" : "تعليم كمنجز"}
                  </button>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
