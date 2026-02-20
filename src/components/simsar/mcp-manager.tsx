"use client";

import { useState } from "react";
import { Copy, RefreshCw, FileJson, Settings2, Check, X, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

const initialConfig = {
    mcpServers: {
        "tavily-remote": {
            command: "npx",
            args: [
                "-y",
                "mcp-remote",
                "https://mcp.tavily.com/mcp/?tavilyApiKey=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",
            ],
            disabled: false,
            env: {},
        },
        gmail: {
            command: "npx",
            args: ["-y", "@gongrzhe/server-gmail-autoauth-mcp"],
            disabled: false,
            env: {},
        },
    },
};

const mcpTools: Record<string, { name: string; description: string }[]> = {
    "tavily-remote": [
        {
            name: "tavily_search",
            description:
                "Search the web for current information on any topic. Use for news, facts, or data beyond your knowledge cutoff. Returns snippets and source URLs.",
        },
        {
            name: "tavily_extract",
            description: "Extract content from URLs. Returns raw page content in markdown or text format.",
        },
        {
            name: "tavily_crawl",
            description:
                "Crawl a website starting from a URL. Extracts content from pages with configurable depth and breadth.",
        },
        {
            name: "tavily_map",
            description: "Map a website's structure. Returns a list of URLs found starting from the base URL.",
        },
        {
            name: "tavily_research",
            description:
                "Perform comprehensive research on a given topic or question. Use this tool when you need to gather information from multiple sources, including web pages, documents, and other resources, to answer a question or complete a task. Returns a detailed response based on the research findings.",
        },
    ],
    gmail: [
        {
            name: "gmail_read",
            description: "Read emails from Gmail inbox with specific filters.",
        },
        {
            name: "gmail_send",
            description: "Send a new email via Gmail.",
        },
        {
            name: "gmail_reply",
            description: "Reply to an existing email thread.",
        },
    ],
};

export function McpManager() {
    const [config, setConfig] = useState(initialConfig);
    const [rawMode, setRawMode] = useState(false);
    const [rawJson, setRawJson] = useState(JSON.stringify(initialConfig, null, 2));
    const [selectedServer, setSelectedServer] = useState("tavily-remote");
    const [copied, setCopied] = useState(false);

    // Parse raw JSON when switching back to GUI
    const handleToggleMode = () => {
        if (rawMode) {
            try {
                const parsed = JSON.parse(rawJson);
                setConfig(parsed);
            } catch (e) {
                alert("تنسيق JSON غير صالح. يرجى التأكد من صحة الكود قبل العودة.");
                return;
            }
        } else {
            setRawJson(JSON.stringify(config, null, 2));
        }
        setRawMode(!rawMode);
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(rawJson);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const servers = Object.keys(config.mcpServers || {});

    const toggleServer = (serverName: string) => {
        setConfig((prev: any) => {
            const current = prev.mcpServers[serverName];
            return {
                ...prev,
                mcpServers: {
                    ...prev.mcpServers,
                    [serverName]: {
                        ...current,
                        disabled: !current.disabled,
                    },
                },
            };
        });
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="إدارة السيرفرات (MCP)">
                    <Settings2 className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden bg-[#161616] border-neutral-800 text-neutral-200" dir="ltr">
                <DialogHeader className="px-6 py-4 flex flex-row items-center justify-between border-b border-neutral-800 shrink-0 bg-[#1e1e1e]">
                    <div className="flex flex-row items-center gap-4">
                        <DialogTitle className="text-xl font-medium tracking-wide">Manage MCP servers</DialogTitle>
                    </div>
                    <div className="flex flex-row items-center gap-6">
                        {!rawMode && (
                            <span className="text-xs text-neutral-400">
                                {Object.keys(mcpTools).reduce((acc, curr) => acc + mcpTools[curr].length, 0)} tools
                            </span>
                        )}
                        <button
                            onClick={handleToggleMode}
                            className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white transition-colors"
                        >
                            <FileJson className="h-4 w-4" />
                            {rawMode ? "View Visual Manager" : "View raw config"}
                        </button>
                        <button className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white transition-colors bg-neutral-800 px-3 py-1.5 rounded-md">
                            <RefreshCw className="h-3.5 w-3.5" />
                            Refresh
                        </button>
                    </div>
                </DialogHeader>

                <div className="flex-1 flex min-h-0">
                    {rawMode ? (
                        <div className="flex-1 flex flex-col bg-[#1e1e1e] relative">
                            <div className="absolute top-4 right-4 z-10">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleCopy}
                                    className="bg-neutral-800 hover:bg-neutral-700 text-white h-8"
                                >
                                    {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
                                    {copied ? "Copied" : "Copy"}
                                </Button>
                            </div>
                            <textarea
                                dir="ltr"
                                value={rawJson}
                                onChange={(e) => setRawJson(e.target.value)}
                                className="flex-1 w-full bg-[#1e1e1e] text-emerald-400 font-mono text-sm p-6 resize-none focus:outline-none focus:ring-0 leading-relaxed custom-scrollbar"
                                spellCheck={false}
                            />
                        </div>
                    ) : (
                        <>
                            {/* Sidebar */}
                            <div className="w-64 border-r border-neutral-800 flex flex-col overflow-y-auto custom-scrollbar shrink-0 bg-[#1e1e1e]">
                                {servers.map((srv) => {
                                    const toolsCount = mcpTools[srv]?.length || 0;
                                    const isSelected = selectedServer === srv;
                                    return (
                                        <button
                                            key={srv}
                                            onClick={() => setSelectedServer(srv)}
                                            className={cn(
                                                "flex items-center justify-between w-full px-4 py-3 text-sm text-left border-l-[3px] transition-colors",
                                                isSelected
                                                    ? "bg-neutral-800/50 border-blue-500 text-white"
                                                    : "border-transparent text-neutral-400 hover:bg-neutral-800/30 hover:text-neutral-200"
                                            )}
                                        >
                                            <span className="truncate flex-1 font-medium">{srv}</span>
                                            <span className="text-[10px] text-neutral-500 ml-2 tracking-widest">{toolsCount} / {toolsCount}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Main Content */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                                {selectedServer && config.mcpServers?.[selectedServer as keyof typeof config.mcpServers] && (
                                    <div className="max-w-4xl mx-auto space-y-8">
                                        {/* Top actions */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <h2 className="text-xl font-bold text-white tracking-wide">{selectedServer}</h2>
                                                <span className="bg-blue-600 text-white text-[10px] px-2.5 py-1 rounded font-medium cursor-pointer hover:bg-blue-700">
                                                    Configure
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm text-neutral-400">Enabled</span>
                                                <button
                                                    onClick={() => toggleServer(selectedServer)}
                                                    className={cn(
                                                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                                                        !(config.mcpServers as any)[selectedServer].disabled ? "bg-blue-500" : "bg-neutral-700"
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                                            !(config.mcpServers as any)[selectedServer].disabled ? "translate-x-4" : "translate-x-0"
                                                        )}
                                                    />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Tools list */}
                                        <div className="space-y-6">
                                            {mcpTools[selectedServer]?.map((tool, idx) => (
                                                <div key={tool.name} className="flex gap-4">
                                                    <div className="flex-1">
                                                        <h3 className="text-[15px] font-semibold text-neutral-200 mb-1.5 flex items-center gap-2">
                                                            {idx + 1}. {tool.name}
                                                        </h3>
                                                        <p className="text-sm text-neutral-400 leading-relaxed pr-8">
                                                            {tool.description}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <button
                                                            className={cn(
                                                                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                                                                "bg-blue-500"
                                                            )}
                                                        >
                                                            <span
                                                                className={cn(
                                                                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                                                    "translate-x-4"
                                                                )}
                                                            />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {!mcpTools[selectedServer] && (
                                                <p className="text-sm text-neutral-500">No tools available for this server in the visual preview.</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
