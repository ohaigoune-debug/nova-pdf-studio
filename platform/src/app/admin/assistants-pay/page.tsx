import {
  AssistantStatement,
  MonthLinks,
} from "@/components/domain/assistant-statement";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "@/components/ui/link";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import {
  CONTENT_KIND_LABELS,
  contentAmount,
  formatDa,
  monthOf,
  monthRange,
  recentMonths,
} from "@/lib/assistant-pay";
import {
  payoutAction,
  removeAssistantContentAction,
} from "@/server/actions/assistant-pay.actions";
import { requirePageActor } from "@/server/auth/current-user";
import { getDb } from "@/server/db/client";
import { signFileUrl } from "@/server/lib/storage";
import {
  assistantMonth,
  getAssistantPayConfig,
  listPaidAssistants,
} from "@/server/services/assistant-pay.service";
import { AssistantPayForm } from "./pay-form";

export const dynamic = "force-dynamic";

/** أجور «الأستاذ المساعد»: الأرقام، وكشف كلّ شهر، وزرّ «مدفوع» */
export default async function AdminAssistantsPayPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; m?: string }>;
}) {
  const actor = await requirePageActor("SUPER_ADMIN");
  const db = await getDb();
  const { a, m } = await searchParams;
  const now = new Date();
  const months = recentMonths(now, 12);
  const month = m && monthRange(m) && months.includes(m) ? m : monthOf(now);
  const [config, assistants] = await Promise.all([
    getAssistantPayConfig(db),
    listPaidAssistants(db, actor),
  ]);
  const current =
    assistants.find((x) => x.userId === a) ?? assistants[0] ?? null;
  const data = current
    ? await assistantMonth(db, actor, {
        assistantUserId: current.userId,
        month,
      })
    : null;
  const href = (userId: string, mm: string) =>
    `/admin/assistants-pay?a=${userId}&m=${mm}`;
  return (
    <>
      <PageHeader
        title="أجور الأستاذ المساعد"
        description="راتب ثابت يشمل ردود الشّهر الأولى ومراجعة التّعليقات، وفوقه الرّدود الزّائدة والمحتوى تحت سقف واحد."
      />
      <div className="mx-auto max-w-3xl space-y-4">
        {!current || !data ? (
          <EmptyState
            title="لا أستاذ مساعد بعد"
            description="أضِفه من «المساعدون» عند الأستاذ بنطاق «المنتدى»."
          />
        ) : (
          <>
            {assistants.length > 1 ? (
              <nav className="flex flex-wrap gap-2" aria-label="المساعد">
                {assistants.map((x) => (
                  <Link
                    key={x.userId}
                    href={href(x.userId, month)}
                    className={`rounded-full border px-3 py-1 text-sm ${x.userId === current.userId ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}
                  >
                    {x.fullName}
                  </Link>
                ))}
              </nav>
            ) : (
              <p className="text-sm font-bold">{current.fullName}</p>
            )}
            <MonthLinks
              current={month}
              months={months}
              href={(mm) => href(current.userId, mm)}
            />
            <AssistantStatement
              statement={data.statement}
              config={data.config}
              payout={data.payout}
              term={data.term}
            />
            <form
              action={payoutAction}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                type="hidden"
                name="assistantUserId"
                value={current.userId}
              />
              <input type="hidden" name="month" value={month} />
              {data.payout ? (
                <>
                  <input type="hidden" name="op" value="cancel" />
                  <Button type="submit" variant="outline">
                    إلغاء تسجيل الدّفع
                  </Button>
                </>
              ) : (
                <Button type="submit" variant="success">
                  مدفوع: {formatDa(data.statement.total)}
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                يُحفظ المبلغ وتفصيله كما هو يوم الدّفع.
              </span>
            </form>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  المحتوى المرفوع ({data.content.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.content.length === 0 ? (
                  <EmptyState title="لا محتوى هذا الشّهر" />
                ) : (
                  <ul className="divide-y text-sm">
                    {data.content.map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2"
                      >
                        <div className="min-w-0">
                          <a
                            href={signFileUrl(c.fileId)}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold underline-offset-2 hover:underline"
                          >
                            {c.title}
                          </a>
                          <div className="text-xs text-muted-foreground">
                            {CONTENT_KIND_LABELS[c.kind]} · {c.pages} صفحة ·{" "}
                            {c.createdAt.toLocaleDateString("fr-DZ")}
                            {c.overLimit ? " · فوق حدّ الفصل" : ""}
                            {c.note ? ` · ${c.note}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {c.overLimit
                              ? "لا يُحسب"
                              : formatDa(
                                  contentAmount(c.kind, c.pages, data.config),
                                )}
                          </Badge>
                          {data.payout ? null : (
                            <form action={removeAssistantContentAction}>
                              <input type="hidden" name="id" value={c.id} />
                              <Button type="submit" size="sm" variant="outline">
                                حذف من الحساب
                              </Button>
                            </form>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <Card id="settings">
          <CardHeader>
            <CardTitle className="text-base">الأرقام</CardTitle>
          </CardHeader>
          <CardContent>
            <AssistantPayForm config={config} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
