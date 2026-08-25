"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminUser } from "@/server/auth/session";
import { importRssFromXml, type RssImportResult } from "@/server/rss/import";

export interface RssImportState {
  ok?: boolean;
  /** Populated on success for the success toast */
  summary?: RssImportResult;
  /** Stable error code: noItems | noSeries | parse | notAuthenticated */
  error?: string;
}

const xmlSchema = z.string().trim().min(20).max(2_000_000);

/** Admin batch import: parse a pasted RSS/XML document into bangumi,
 * episodes and torrents. Errors are returned as stable codes that the
 * dialog maps to localized messages. */
export async function importRssXmlAction(
  _prev: RssImportState,
  formData: FormData
): Promise<RssImportState> {
  const user = await getAdminUser();
  if (!user) return { error: "notAuthenticated" };

  const xml = xmlSchema.safeParse(formData.get("xml"));
  if (!xml.success) return { error: "noItems" };

  try {
    const summary = await importRssFromXml(xml.data);
    revalidatePath("/", "layout");
    return { ok: true, summary };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "parse" };
  }
}
