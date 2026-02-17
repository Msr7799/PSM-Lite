"use client";

import { useState, useEffect, FormEvent } from "react";
import { Plus, Check, Trash2, FileIcon, Upload, X, Loader2, Maximize2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { useTranslations } from "next-intl";

interface Note {
    id: string;
    title: string;
    content: string;
    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    isResolved: boolean;
    createdAt: string;
    authorEmail?: string;
    attachments?: { filename: string; url: string; type: string }[];
    unit?: { id: string; name: string };
}

interface Unit {
    id: string;
    name: string;
}

export function NotesWidget() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false); // For "Add Note" dialog
    const [selectedNote, setSelectedNote] = useState<Note | null>(null); // For "View Note" dialog

    // Form state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        content: "",
        priority: "NORMAL",
        unitId: "",
        attachments: [] as any[],
    });

    const t = useTranslations(); // Using generic hook, assumes keys might not exist so fetch English strings or fallback

    useEffect(() => {
        fetchNotes();
        fetchUnits();
    }, []);

    const fetchNotes = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/notes?isResolved=false");
            if (res.ok) {
                const data = await res.json();
                setNotes(data);
            }
        } catch (error) {
            console.error("Failed to fetch notes", error);
        } finally {
            setLoading(false);
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
            console.error("Failed to fetch units", error);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingFile(true);
        try {
            const formDataUpload = new FormData();
            formDataUpload.append("file", file);

            const res = await fetch("/api/upload", {
                method: "POST",
                body: formDataUpload,
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
            alert("Failed to upload file");
        } finally {
            setUploadingFile(false);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

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
                setIsOpen(false);
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
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleResolved = async (id: string, isResolved: boolean) => {
        try {
            await fetch(`/api/notes/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isResolved: !isResolved }), // Flip status
            });
            // Updating locally to reflect change instantly
            if (!isResolved) {
                // If it was unresolved and now resolved, remove from list (since we fetch unresolved by default)
                setNotes((prev) => prev.filter((n) => n.id !== id));
                setSelectedNote(null); // Close detail view if open
            } else {
                fetchNotes();
            }
        } catch (error) {
            console.error("Failed to update note:", error);
        }
    };

    const deleteNote = async (id: string) => {
        if (!confirm("Are you sure you want to delete this note?")) return;
        try {
            await fetch(`/api/notes/${id}`, { method: "DELETE" });
            setNotes((prev) => prev.filter((n) => n.id !== id));
            setSelectedNote(null);
        } catch (error) {
            console.error("Failed to delete note:", error);
        }
    };

    const priorityColors: Record<string, string> = {
        LOW: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
        NORMAL: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
        HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200",
        URGENT: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 overflow-hidden flex flex-col h-full min-h-[300px]">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <div>
                    <h2 className="font-semibold text-lg flex items-center gap-2">
                        📝 Notes & Tasks
                        <span className="bg-slate-200 dark:bg-slate-700 text-xs px-2 py-0.5 rounded-full">
                            {notes.length}
                        </span>
                    </h2>
                </div>

                {/* ADD NOTE DIALOG */}
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <button className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
                            <Plus className="w-3.5 h-3.5" />
                            Add Note
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Add New Note</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 py-2">
                            <div className="space-y-2">
                                <input
                                    placeholder="Note Title"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-700"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <textarea
                                    placeholder="Details..."
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md min-h-[100px] dark:bg-slate-800 dark:border-slate-700"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <select
                                    value={formData.priority}
                                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-700"
                                >
                                    <option value="LOW">Low Priority</option>
                                    <option value="NORMAL">Normal</option>
                                    <option value="HIGH">High</option>
                                    <option value="URGENT">Urgent!</option>
                                </select>

                                <select
                                    value={formData.unitId}
                                    onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-700"
                                >
                                    <option value="">(No specific unit)</option>
                                    {units.map((u) => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Attachments */}
                            <div>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {formData.attachments.map((file, i) => (
                                        <div key={i} className="flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border dark:border-slate-700">
                                            <FileIcon className="w-3 h-3 text-blue-500" />
                                            <span className="truncate max-w-[100px]">{file.filename}</span>
                                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, attachments: prev.attachments.filter((_, idx) => idx !== i) }))}>
                                                <X className="w-3 h-3 hover:text-red-500" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <label className="cursor-pointer inline-flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">
                                    {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                    <span>Upload File/Image</span>
                                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
                                </label>
                            </div>

                            <DialogFooter>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || uploadingFile}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50 text-sm font-medium"
                                >
                                    {isSubmitting ? "Saving..." : "Save Note"}
                                </button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[400px]">
                {loading ? (
                    <div className="text-center py-8 text-slate-400 text-sm">Loading notes...</div>
                ) : notes.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm flex flex-col items-center">
                        <span className="text-4xl mb-2">✨</span>
                        <p>All clear! No pending notes.</p>
                    </div>
                ) : (
                    notes.map((note) => (
                        <div
                            key={note.id}
                            onClick={() => setSelectedNote(note)}
                            className="group cursor-pointer bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-3 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900 transition-all relative overflow-hidden"
                        >
                            <div className={`absolute top-0 left-0 w-1 h-full ${note.priority === 'URGENT' ? 'bg-red-500' : note.priority === 'HIGH' ? 'bg-orange-500' : 'bg-blue-500'} opacity-0 group-hover:opacity-100 transition-opacity`} />

                            <div className="flex justify-between items-start mb-1">
                                <h4 className="font-semibold text-sm line-clamp-1 group-hover:text-blue-600 transition-colors">
                                    {note.title}
                                </h4>
                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${priorityColors[note.priority]}`}>
                                    {note.priority}
                                </span>
                            </div>

                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                                {note.content}
                            </p>

                            <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                                {note.attachments && note.attachments.length > 0 && (
                                    <span className="flex items-center gap-0.5 text-blue-500">
                                        <FileIcon className="w-3 h-3" /> {note.attachments.length}
                                    </span>
                                )}
                                {note.unit && (
                                    <span className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                                        🏠 {note.unit.name}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* VIEW NOTE DETAIL DIALOG */}
            {selectedNote && (
                <Dialog open={!!selectedNote} onOpenChange={(open) => !open && setSelectedNote(null)}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="flex items-center justify-between mt-2">
                                <span>{selectedNote.title}</span>
                                <span className={`text-xs px-2 py-1 rounded ${priorityColors[selectedNote.priority]}`}>
                                    {selectedNote.priority}
                                </span>
                            </DialogTitle>
                            <div className="text-xs text-slate-400 mt-1 flex gap-2">
                                <span>Created: {new Date(selectedNote.createdAt).toLocaleString()}</span>
                                {selectedNote.authorEmail && <span>by {selectedNote.authorEmail}</span>}
                            </div>
                        </DialogHeader>

                        <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                            {/* Unit Badge */}
                            {selectedNote.unit && (
                                <div className="inline-flex items-center gap-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded text-xs">
                                    🏠 {selectedNote.unit.name}
                                </div>
                            )}

                            {/* Content */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                {selectedNote.content}
                            </div>

                            {/* Attachments Display */}
                            {selectedNote.attachments && selectedNote.attachments.length > 0 && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg space-y-2">
                                    <h5 className="text-xs font-semibold text-slate-500">Attachments ({selectedNote.attachments.length})</h5>
                                    <div className="grid grid-cols-2 gap-2">
                                        {selectedNote.attachments.map((file, idx) => (
                                            <a
                                                key={idx}
                                                href={file.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 border rounded hover:border-blue-400 transition group"
                                            >
                                                {file.type.startsWith('image/') ? (
                                                    <div className="w-8 h-8 bg-slate-200 rounded overflow-hidden flex-shrink-0">
                                                        <img src={file.url} alt={file.filename} className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <FileIcon className="w-8 h-8 text-slate-400 group-hover:text-blue-500" />
                                                )}
                                                <div className="overflow-hidden">
                                                    <div className="text-xs font-medium truncate" title={file.filename}>{file.filename}</div>
                                                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                                        Click to view <Maximize2 className="w-2.5 h-2.5" />
                                                    </div>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="flex gap-2 sm:justify-between w-full">
                            <button
                                type="button"
                                onClick={() => deleteNote(selectedNote.id)}
                                className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 mr-auto"
                            >
                                <Trash2 className="w-4 h-4" /> Delete
                            </button>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedNote(null)}
                                    className="px-4 py-2 border rounded-md text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => toggleResolved(selectedNote.id, selectedNote.isResolved)}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm flex items-center gap-2"
                                >
                                    <Check className="w-4 h-4" />
                                    Mark as Done
                                </button>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
