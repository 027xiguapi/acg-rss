"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Loader2, MessageSquare, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { CommentView, SocialKind } from "@/server/bangumi/social";
import {
  addCommentAction,
  deleteCommentAction,
  type CommentFormState,
} from "@/server/bangumi/social-actions";

/** Comment list with a post form (logged-in users) on the bangumi / episode pages. */
export function CommentSection({
  kind,
  targetId,
  comments,
  authenticated,
}: {
  kind: SocialKind;
  targetId: number;
  comments: CommentView[];
  authenticated: boolean;
}) {
  const t = useTranslations("bangumi");
  const [state, formAction, pending] = useActionState<
    CommentFormState,
    FormData
  >(addCommentAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  // useActionState does not reset uncontrolled inputs on success
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <span className="h-4 w-1 rounded-full bg-primary" />
        {t("comments")}
        <span className="text-sm font-normal text-muted-foreground">
          {comments.length}
        </span>
      </h2>

      {authenticated ? (
        <form ref={formRef} action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="targetId" value={targetId} />
          <textarea
            name="content"
            rows={3}
            maxLength={2000}
            required
            placeholder={t("commentPlaceholder")}
            className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              {pending ? <Loader2 className="animate-spin" /> : <MessageSquare />}
              {t("sendComment")}
            </button>
            {state.error ? (
              <p className="text-xs text-destructive">
                {state.error === "notAuthenticated"
                  ? t("loginToInteract")
                  : t("commentFailed")}
              </p>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-4 text-center text-xs text-muted-foreground">
          <Link href="/login" className="text-primary underline-offset-2 hover:underline">
            {t("loginToInteract")}
          </Link>
        </p>
      )}

      {comments.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">{t("commentEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="flex items-start gap-3 rounded-lg border px-3 py-2.5"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase text-secondary-foreground">
                {comment.author.slice(0, 1)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {comment.author}
                  </span>
                  <time dateTime={comment.createdAt}>
                    {new Date(comment.createdAt).toLocaleString()}
                  </time>
                </p>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {comment.content}
                </p>
              </div>
              {comment.mine ? (
                <form action={deleteCommentAction}>
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="id" value={comment.id} />
                  <button
                    type="submit"
                    title={t("delete")}
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t("delete")}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
