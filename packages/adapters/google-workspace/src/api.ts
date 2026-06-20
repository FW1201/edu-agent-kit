/**
 * Thin Google Workspace API wrappers built on the shared authorized client.
 * Pure request construction lives in builders.ts; this module performs I/O.
 */
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { google, type docs_v1, type slides_v1, type forms_v1 } from "googleapis";
import { getAuthorizedClient } from "@edu-agent-kit/google-shared";

export interface CreatedFile {
  id: string;
  url: string;
}

export async function createDoc(
  title: string,
  requests: docs_v1.Schema$Request[],
): Promise<CreatedFile> {
  const auth = await getAuthorizedClient();
  const docs = google.docs({ version: "v1", auth });
  const created = await docs.documents.create({ requestBody: { title } });
  const id = created.data.documentId!;
  if (requests.length) {
    await docs.documents.batchUpdate({ documentId: id, requestBody: { requests } });
  }
  return { id, url: `https://docs.google.com/document/d/${id}/edit` };
}

export async function createSlides(
  title: string,
  requests: slides_v1.Schema$Request[],
): Promise<CreatedFile> {
  const auth = await getAuthorizedClient();
  const slides = google.slides({ version: "v1", auth });
  const created = await slides.presentations.create({ requestBody: { title } });
  const id = created.data.presentationId!;
  if (requests.length) {
    await slides.presentations.batchUpdate({ presentationId: id, requestBody: { requests } });
  }
  return { id, url: `https://docs.google.com/presentation/d/${id}/edit` };
}

export async function createForm(
  title: string,
  isQuiz: boolean,
  itemRequests: forms_v1.Schema$Request[],
): Promise<CreatedFile> {
  const auth = await getAuthorizedClient();
  const forms = google.forms({ version: "v1", auth });
  const created = await forms.forms.create({ requestBody: { info: { title } } });
  const id = created.data.formId!;
  const requests: forms_v1.Schema$Request[] = [];
  if (isQuiz) {
    requests.push({
      updateSettings: {
        settings: { quizSettings: { isQuiz: true } },
        updateMask: "quizSettings.isQuiz",
      },
    });
  }
  requests.push(...itemRequests);
  if (requests.length) {
    await forms.forms.batchUpdate({ formId: id, requestBody: { requests } });
  }
  return { id, url: `https://docs.google.com/forms/d/${id}/edit` };
}

export async function createSheet(
  title: string,
  grid: (string | number)[][],
): Promise<CreatedFile> {
  const auth = await getAuthorizedClient();
  const sheets = google.sheets({ version: "v4", auth });
  const created = await sheets.spreadsheets.create({ requestBody: { properties: { title } } });
  const id = created.data.spreadsheetId!;
  if (grid.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: "A1",
      valueInputOption: "RAW",
      requestBody: { values: grid },
    });
  }
  return { id, url: `https://docs.google.com/spreadsheets/d/${id}/edit` };
}

const MIME_BY_EXT: Record<string, string> = {
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".pdf": "application/pdf",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

export async function driveCreateFolder(name: string, parentId?: string): Promise<CreatedFile> {
  const auth = await getAuthorizedClient();
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: "id, webViewLink",
  });
  return { id: res.data.id!, url: res.data.webViewLink ?? "" };
}

export async function driveUploadFile(
  localPath: string,
  name?: string,
  folderId?: string,
): Promise<CreatedFile> {
  const auth = await getAuthorizedClient();
  const drive = google.drive({ version: "v3", auth });
  const ext = path.extname(localPath).toLowerCase();
  const mimeType = MIME_BY_EXT[ext] ?? "application/octet-stream";
  const res = await drive.files.create({
    requestBody: { name: name ?? path.basename(localPath), ...(folderId ? { parents: [folderId] } : {}) },
    media: { mimeType, body: createReadStream(localPath) },
    fields: "id, webViewLink",
  });
  return { id: res.data.id!, url: res.data.webViewLink ?? "" };
}

export async function driveSetSharing(
  fileId: string,
  role: "reader" | "commenter" | "writer" = "reader",
  type: "anyone" | "domain" = "anyone",
): Promise<{ fileId: string; role: string; type: string }> {
  const auth = await getAuthorizedClient();
  const drive = google.drive({ version: "v3", auth });
  await drive.permissions.create({ fileId, requestBody: { role, type } });
  return { fileId, role, type };
}

export interface ReadFormQuestion {
  prompt: string;
  type: string;
  options: string[];
}
export interface ReadFormResult {
  title: string;
  questions: ReadFormQuestion[];
}

/** Read an existing Google Form into a simplified, remixable structure. */
export async function readForm(formId: string): Promise<ReadFormResult> {
  const auth = await getAuthorizedClient();
  const forms = google.forms({ version: "v1", auth });
  const res = await forms.forms.get({ formId });
  const title = res.data.info?.title ?? res.data.info?.documentTitle ?? "(untitled form)";
  const questions: ReadFormQuestion[] = [];
  for (const item of res.data.items ?? []) {
    const q = item.questionItem?.question;
    if (!q) continue;
    const choice = q.choiceQuestion;
    questions.push({
      prompt: item.title ?? "",
      type: choice ? (choice.type ?? "CHOICE") : q.textQuestion ? "TEXT" : "OTHER",
      options: (choice?.options ?? []).map((o) => o.value ?? "").filter((v) => v.length > 0),
    });
  }
  return { title, questions };
}

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
}

/** List non-folder files directly inside a Drive folder. */
export async function driveListFolder(folderId: string): Promise<DriveFileMeta[]> {
  const auth = await getAuthorizedClient();
  const drive = google.drive({ version: "v3", auth });
  const out: DriveFileMeta[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: 200,
      pageToken,
    });
    for (const f of res.data.files ?? []) {
      if (f.id && f.name && f.mimeType) out.push({ id: f.id, name: f.name, mimeType: f.mimeType });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

// Google-native types are exported (Docs→.txt, Sheets→.csv, Slides→.txt) rather
// than downloaded raw.
const EXPORT_AS: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": { mime: "text/plain", ext: ".txt" },
  "application/vnd.google-apps.spreadsheet": { mime: "text/csv", ext: ".csv" },
  "application/vnd.google-apps.presentation": { mime: "text/plain", ext: ".txt" },
};

/**
 * Download a Drive file to a local directory. Google-native docs are exported to
 * text/csv; other files are fetched raw. Returns the written local path.
 */
export async function driveDownloadFile(
  file: DriveFileMeta,
  destDir: string,
): Promise<string> {
  const auth = await getAuthorizedClient();
  const drive = google.drive({ version: "v3", auth });
  await fs.mkdir(destDir, { recursive: true });
  const exp = EXPORT_AS[file.mimeType];
  let data: ArrayBuffer;
  let outName = file.name;
  if (exp) {
    const res = await drive.files.export(
      { fileId: file.id, mimeType: exp.mime },
      { responseType: "arraybuffer" },
    );
    data = res.data as ArrayBuffer;
    if (!outName.endsWith(exp.ext)) outName += exp.ext;
  } else {
    const res = await drive.files.get(
      { fileId: file.id, alt: "media" },
      { responseType: "arraybuffer" },
    );
    data = res.data as ArrayBuffer;
  }
  const outPath = path.join(destDir, outName);
  await fs.writeFile(outPath, Buffer.from(data));
  return outPath;
}
