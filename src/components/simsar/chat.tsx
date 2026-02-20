"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Bot, User, Copy, Check, RefreshCw, Trash2,
  Paperclip, X, MessageSquarePlus, ChevronDown,
  History, FileText, Image as ImageIcon, FileSpreadsheet,
  File, Search, Loader2, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { McpManager } from "./mcp-manager";

/* ────────── Types ────────── */
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
}

interface Attachment {
  filename: string;
  type: string;
  size: number;
  extractedText: string;
  imageBase64?: string;
}

interface Conversation {
  id: string;
  title: string | null;
  modelId: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

interface ModelInfo {
  id: string;
  name: string;
  owned_by?: string;
  isMultimodal?: boolean;
}

/* ────────── Helpers ────────── */
function fileIcon(type: string) {
  if (type.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
  if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv"))
    return <FileSpreadsheet className="h-4 w-4" />;
  if (type.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4" />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ────────── Component ────────── */
export function SimsarChat() {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Conversations
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [loadingConvs, setLoadingConvs] = useState(false);

  // Models
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [loadingModels, setLoadingModels] = useState(false);

  // Attachments
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ────── Scroll ────── */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  /* ────── Load models on mount ────── */
  useEffect(() => {
    fetchModels();
    fetchConversations();
  }, []);

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const res = await fetch("/api/simsar/models");
      if (res.ok) {
        const data = await res.json();
        setModels(data.models || []);
        if (!selectedModel && data.currentModel) {
          setSelectedModel(data.currentModel);
        }
      }
    } catch (error) {
      console.error("Failed to fetch models:", error);
    }
    setLoadingModels(false);
  };

  const fetchConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const res = await fetch("/api/simsar/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    }
    setLoadingConvs(false);
  }, []);

  /* ────── Conversation handlers ────── */
  const createNewConversation = async () => {
    try {
      const res = await fetch("/api/simsar/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: selectedModel }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveConvId(data.conversation.id);
        setMessages([]);
        setPendingAttachments([]);
        await fetchConversations();
        return data.conversation.id;
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
    return null;
  };

  const loadConversation = async (convId: string) => {
    try {
      const res = await fetch(`/api/simsar/conversations/${convId}`);
      if (res.ok) {
        const data = await res.json();
        const conv = data.conversation;
        setActiveConvId(conv.id);
        setMessages(
          conv.messages
            .filter((m: { role: string }) => m.role !== "system")
            .map((m: { id: string; role: string; content: string; createdAt: string; attachments?: Attachment[] }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              timestamp: new Date(m.createdAt),
              attachments: m.attachments as Attachment[] | undefined,
            }))
        );
        if (conv.modelId) setSelectedModel(conv.modelId);
        setShowHistory(false);
        setPendingAttachments([]);
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  };

  const deleteConversation = async (convId: string) => {
    try {
      await fetch(`/api/simsar/conversations/${convId}`, { method: "DELETE" });
      if (activeConvId === convId) {
        setActiveConvId(null);
        setMessages([]);
      }
      await fetchConversations();
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  const startNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setPendingAttachments([]);
    setShowHistory(false);
  };

  /* ────── File upload ────── */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/simsar/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          setPendingAttachments((prev) => [...prev, data.attachment]);
        } else {
          const err = await res.json();
          alert(err.error || "فشل رفع الملف");
        }
      } catch (error) {
        console.error("Upload error:", error);
        alert("فشل رفع الملف");
      }
    }
    setUploading(false);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (idx: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ────── Copy ────── */
  const copyToClipboard = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  /* ────── Send message ────── */
  const sendMessage = async () => {
    if ((!input.trim() && pendingAttachments.length === 0) || isLoading) return;

    // Ensure we have a conversation
    let convId = activeConvId;
    if (!convId) {
      convId = await createNewConversation();
      if (!convId) return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
      attachments: pendingAttachments.length > 0 ? [...pendingAttachments] : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    const sentAttachments = [...pendingAttachments];
    setPendingAttachments([]);
    setIsLoading(true);

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const response = await fetch("/api/simsar/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          stream: true,
          modelId: selectedModel || undefined,
          conversationId: convId,
          attachments: sentAttachments.length > 0 ? sentAttachments : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "فشل الاتصال بسمسار");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, content: m.content + parsed.content }
                      : m
                  )
                );
              }
              if (parsed.error) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, content: `⚠️ خطأ: ${parsed.error}` }
                      : m
                  )
                );
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      // Refresh conversations list to update titles
      fetchConversations();
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id
            ? {
              ...m,
              content: `⚠️ خطأ: ${error instanceof Error ? error.message : "حدث خطأ غير متوقع"
                }`,
            }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ────── Filtered data ────── */
  const filteredConvs = conversations.filter((c) =>
    !historySearch || (c.title || "").toLowerCase().includes(historySearch.toLowerCase())
  );

  const filteredModels = models.filter((m) =>
    !modelSearch ||
    m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
    m.name.toLowerCase().includes(modelSearch.toLowerCase())
  );

  const currentModelName = models.find((m) => m.id === selectedModel)?.name || selectedModel?.split("/").pop() || "اختر نموذج";

  /* ────────── RENDER ────────── */
  return (
    <div className="flex h-full bg-background rounded-lg border overflow-hidden">
      {/* ────── Sidebar: History ────── */}
      <div
        className={cn(
          "border-e bg-muted/30 flex flex-col transition-all duration-300 overflow-hidden",
          showHistory ? "w-72" : "w-0"
        )}
      >
        {showHistory && (
          <>
            <div className="p-3 border-b space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-1.5">
                  <History className="h-4 w-4" />
                  المحادثات
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)} className="h-7 w-7 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute start-2.5 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="بحث..."
                  className="w-full h-8 ps-8 pe-2 text-xs rounded-md border bg-background"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingConvs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredConvs.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  لا توجد محادثات
                </div>
              ) : (
                filteredConvs.map((conv) => (
                  <div
                    key={conv.id}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/60 border-b border-border/30 transition-colors",
                      activeConvId === conv.id && "bg-amber-500/10 border-s-2 border-s-amber-500"
                    )}
                    onClick={() => loadConversation(conv.id)}
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {conv.title || "محادثة بدون عنوان"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(conv.updatedAt).toLocaleDateString("ar-SA")} · {conv._count?.messages || 0} رسالة
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="p-2 border-t">
              <p className="text-[10px] text-center text-muted-foreground">
                {conversations.length}/100 محادثة
              </p>
            </div>
          </>
        )}
      </div>

      {/* ────── Main Chat Area ────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-amber-500/10 to-orange-500/10">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 rounded-full hover:bg-amber-500/20"
                title="الرجوع للقائمة"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchConversations(); }}
              className="h-9 w-9 p-0"
              title="تاريخ المحادثات"
            >
              <History className="h-4 w-4" />
            </Button>
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white font-bold text-lg">
              س
            </div>
            <div>
              <h2 className="font-semibold text-lg">سمسار</h2>
              <p className="text-xs text-muted-foreground">
                مساعدك الذكي لإدارة العقارات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Model Picker */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="h-8 text-xs max-w-[200px] gap-1"
              >
                <Bot className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{currentModelName}</span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </Button>

              {showModelPicker && (
                <div className="absolute end-0 top-full mt-1 w-80 max-h-80 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 absolute start-2 top-2 text-muted-foreground" />
                      <input
                        type="text"
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        placeholder="ابحث عن نموذج..."
                        className="w-full h-7 ps-7 pe-2 text-xs rounded border bg-background"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-60">
                    {loadingModels ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : filteredModels.length === 0 ? (
                      <p className="text-xs text-center py-4 text-muted-foreground">لا توجد نتائج</p>
                    ) : (
                      filteredModels.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            setSelectedModel(m.id);
                            setShowModelPicker(false);
                            setModelSearch("");
                          }}
                          className={cn(
                            "w-full text-start px-3 py-2 text-xs hover:bg-muted/60 transition-colors flex items-center gap-2",
                            selectedModel === m.id && "bg-amber-500/10 font-medium"
                          )}
                        >
                          <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">{m.name}</p>
                            <p className="truncate text-[10px] text-muted-foreground">{m.id}</p>
                          </div>
                          {m.isMultimodal && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 shrink-0">
                              vision
                            </span>
                          )}
                          {selectedModel === m.id && <Check className="h-3 w-3 text-amber-500 shrink-0" />}
                        </button>
                      ))
                    )}
                  </div>
                  <div className="p-2 border-t text-center">
                    <button
                      onClick={() => { fetchModels(); }}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      🔄 تحديث القائمة ({models.length} نموذج)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* New Chat */}
            <Button
              variant="ghost"
              size="sm"
              onClick={startNewChat}
              className="h-8"
              title="محادثة جديدة"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </Button>

            {/* MCP Manager */}
            <McpManager />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Bot className="h-16 w-16 mb-4 text-amber-500/50" />
              <h3 className="text-lg font-medium mb-2">مرحباً! أنا سمسار</h3>
              <p className="text-sm max-w-md">
                مساعدك الذكي لإدارة العقارات. اسألني عن أي شيء يخص الوحدات،
                الحجوزات، التقويم، أو المصروفات. يمكنك أيضاً إرفاق ملفات لتحليلها!
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {[
                  "ما هي الحجوزات القادمة؟",
                  "أعطني ملخص الإيرادات",
                  "كم عدد الوحدات النشطة؟",
                  "ما نسبة الإشغال الحالية؟",
                ].map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setInput(suggestion);
                      textareaRef.current?.focus();
                    }}
                    className="text-xs"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <Paperclip className="h-3.5 w-3.5" />
                <span>يدعم: PDF, Word, Excel, CSV, JSON, TXT, صور</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
                    )}
                  >
                    {message.role === "user" ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <span className="text-sm font-bold">س</span>
                    )}
                  </div>
                  <div
                    className={cn(
                      "flex flex-col max-w-[80%]",
                      message.role === "user" ? "items-end" : "items-start"
                    )}
                  >
                    {/* Attachments preview */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {message.attachments.map((att, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/60 text-xs"
                          >
                            {fileIcon(att.type)}
                            <span className="truncate max-w-[120px]">{att.filename}</span>
                            <span className="text-muted-foreground">{formatSize(att.size)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div
                      className={cn(
                        "px-4 py-2 rounded-2xl",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      )}
                    >
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.content || (
                          <span className="inline-flex gap-1">
                            <span className="animate-bounce">●</span>
                            <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>●</span>
                            <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>●</span>
                          </span>
                        )}
                      </div>
                    </div>
                    {message.role === "assistant" && message.content && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-6 text-xs text-muted-foreground"
                        onClick={() => copyToClipboard(message.content, message.id)}
                      >
                        {copiedId === message.id ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            تم النسخ
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            نسخ
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Attachments Preview */}
        {pendingAttachments.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {pendingAttachments.map((att, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-muted/40 text-xs group"
              >
                {fileIcon(att.type)}
                <span className="truncate max-w-[140px] font-medium">{att.filename}</span>
                <span className="text-muted-foreground">{formatSize(att.size)}</span>
                <button
                  onClick={() => removeAttachment(idx)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t bg-background">
          <div className="flex gap-2 items-end">
            {/* File attach button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isLoading}
              className="shrink-0 h-[44px] w-[44px] p-0"
              title="إرفاق ملف"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".txt,.md,.csv,.json,.xlsx,.xls,.pdf,.docx,.jpg,.jpeg,.png,.gif,.webp"
              multiple
              onChange={handleFileSelect}
            />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتب سؤالك هنا... أو أرفق ملفاً لتحليله"
              className="flex-1 min-h-[44px] max-h-32 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
            />
            <Button
              onClick={sendMessage}
              disabled={(!input.trim() && pendingAttachments.length === 0) || isLoading}
              className="shrink-0 h-[44px] bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Close model picker on outside click */}
      {showModelPicker && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setShowModelPicker(false); setModelSearch(""); }}
        />
      )}
    </div>
  );
}
