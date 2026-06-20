import { promises as fs } from "node:fs";
import path from "node:path";
import { Packer, type Document } from "docx";

/** Pack a docx Document and write it to disk. Returns the absolute path. */
export async function writeDocx(doc: Document, outPath: string): Promise<string> {
  const buffer = await Packer.toBuffer(doc);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, buffer);
  return path.resolve(outPath);
}
