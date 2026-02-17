import { promises as fs } from "fs";
import path from "path";

export async function GET() {
  try {
    const dir = path.join(process.cwd(), "public", "ics");
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((n) => n.toLowerCase().endsWith(".ics"))
      .sort((a, b) => a.localeCompare(b));

    return Response.json({ files });
  } catch {
    return Response.json({ files: [] });
  }
}
