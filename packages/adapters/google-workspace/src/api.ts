/**
 * Thin Google Workspace API wrappers built on the shared authorized client.
 * Pure request construction lives in builders.ts; this module performs I/O.
 */
import { createReadStream } from "node:fs";
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
