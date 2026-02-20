import fs from 'fs';
import path from 'path';
import Fuse from 'fuse.js';

interface DocFile {
    title: string;
    content: string;
    source: string;
}

let fuseIndex: Fuse<DocFile> | null = null;
let allDocs: DocFile[] = [];

export async function initDocsIndex() {
    if (fuseIndex) return;

    const dumpPath = path.join(process.cwd(), 'Docs', 'docs_dump');
    try {
        const files = await traverseDocs(dumpPath);
        for (const file of files) {
            if (file.endsWith('.md')) { // only process markdown
                const content = fs.readFileSync(file, 'utf-8');
                const source = path.relative(dumpPath, file);
                let title = path.basename(file, '.md').replace(/-/g, ' ');
                // Extract a clean title by removing prefixed ids if any
                title = title.replace(/^\d+-/, '');

                allDocs.push({
                    title,
                    content: content.slice(0, 4000), // restrict length to save tokens (approx 1000 tokens)
                    source
                });
            }
        }

        // Initialize Fuse with content and title keys
        fuseIndex = new Fuse(allDocs, {
            keys: ['title', 'content', 'source'],
            threshold: 0.5, // lenient to allow catching varying queries
            ignoreLocation: true,
            includeScore: true,
            minMatchCharLength: 3,
        });
    } catch (err) {
        console.error('Error initializing Docs Index:', err);
    }
}

async function traverseDocs(dir: string): Promise<string[]> {
    const result: string[] = [];
    if (!fs.existsSync(dir)) return result;
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            result.push(...await traverseDocs(fullPath));
        } else {
            result.push(fullPath);
        }
    }
    return result;
}

export async function searchDocs(query: string, maxResults = 3): Promise<DocFile[]> {
    await initDocsIndex();
    if (!fuseIndex || !query) return [];

    // Convert common Arabic platform names to English for better search matching with files
    let searchQ = query;
    searchQ = searchQ.replace(/أجودا/g, 'agoda').replace(/اجودا/g, 'agoda');
    searchQ = searchQ.replace(/بوكينق/g, 'booking').replace(/بوكينج/g, 'booking').replace(/بوكنج/g, 'booking');
    searchQ = searchQ.replace(/اير بي ان بي/g, 'airbnb').replace(/airbnb/g, 'airbnb');

    const res = fuseIndex.search(searchQ);
    return res.slice(0, maxResults).map(r => r.item);
}

export function formatDocsForAI(docs: DocFile[]): string {
    if (docs.length === 0) return '';
    let str = '\n\n---\n\n📚 **قاعدة بيانات المنصات الخارجية (Agoda, Booking, Airbnb):**\nقام النظام بالبحث وإيجاد الملفات الإرشادية التالية لمساعدتك في الإجابة:\n\n';
    docs.forEach((d, i) => {
        str += `### مستند ${i + 1}: ${d.title} (المسار: ${d.source})\n`;
        str += `${d.content}\n\n`;
    });
    str += '---\nالرجاء الاستعانة بالمعلومات أعلاه في حال كان سؤال المستخدم يتعلق بهذه المنصات.';
    return str;
}
