"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  FormError,
  SubmitButton,
  fieldError,
} from "@/components/forms/form-bits";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import {
  CONTENT_KINDS,
  CONTENT_KIND_LABELS,
  rateLabel,
  type AssistantPayConfig,
} from "@/lib/assistant-pay";
import { submitAssistantContentAction } from "@/server/actions/assistant-pay.actions";

/** رفع محتوى: النّوع والعنوان وعدد الصّفحات والملفّ (PDF أو Word) */
export function ContentForm({ config }: { config: AssistantPayConfig }) {
  const [state, action] = useActionState(submitAssistantContentAction, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <Field label="النّوع" htmlFor="kind">
        <Select id="kind" name="kind" defaultValue="SUMMARY" required>
          {CONTENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {CONTENT_KIND_LABELS[k]} — {rateLabel(k, config)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="العنوان" htmlFor="title" error={fieldError(state, "title")}>
        <Input
          id="title"
          name="title"
          required
          minLength={3}
          maxLength={200}
          placeholder="مثال: ملخّص درس الإعراب — الجمل الّتي لها محلّ"
        />
      </Field>
      <Field
        label="عدد الصّفحات"
        htmlFor="pages"
        hint="للاختبار والمقترح: صفحات الموضوع وحدها، والتّصحيح مجّانيّ."
        error={fieldError(state, "pages")}
      >
        <Input
          id="pages"
          name="pages"
          type="number"
          inputMode="numeric"
          min={1}
          max={500}
          required
          className="w-32"
        />
      </Field>
      <Field
        label="الملفّ (PDF أو Word، حتى 9 ميغابايت)"
        htmlFor="file"
        error={fieldError(state, "file")}
      >
        <Input
          id="file"
          name="file"
          type="file"
          required
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        />
      </Field>
      <Field label="ملاحظة (اختياريّة)" htmlFor="note">
        <Textarea id="note" name="note" rows={2} maxLength={500} />
      </Field>
      <FormError state={state} />
      {state?.ok ? (
        <p className="text-sm text-success" role="status">
          رُفع وأُضيف إلى كشف الشّهر.
        </p>
      ) : null}
      <SubmitButton>رفع</SubmitButton>
    </form>
  );
}
