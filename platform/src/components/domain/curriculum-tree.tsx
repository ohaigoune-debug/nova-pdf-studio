'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useTransition } from 'react'
import { FormError, SubmitButton } from '@/components/forms/form-bits'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { createNodeAction, deleteNodeAction } from '@/server/actions/curriculum.actions'
import type { CurriculumTreeNode } from '@/server/services/taxonomy.service'

const KIND_AR: Record<string, string> = { UNIT: 'وحدة', CHAPTER: 'فصل', LESSON: 'درس', TOPIC: 'موضوع' }
const CHILD: Record<string, string[]> = { ROOT: ['UNIT'], UNIT: ['LESSON', 'CHAPTER'], CHAPTER: ['LESSON'], LESSON: ['TOPIC'], TOPIC: [] }

type Scope = { subjectId: string; levelId: string; streamId: string | null }

/** شجرة المنهاج لمادة في صف: إضافة عقدة تحت أي عقدة، وحذف غير المستعمل */
export function CurriculumTree({ nodes, scope }: { nodes: CurriculumTreeNode[]; scope: Scope }) {
  return (
    <div className="space-y-3">
      <AddNode scope={scope} parentId={null} parentKind="ROOT" />
      {nodes.length === 0 ? <p className="text-sm text-muted-foreground">لا وحدات بعد لهذه المادة في هذا الصف. أضف الوحدة الأولى أعلاه.</p> : null}
      <ul className="space-y-2">
        {nodes.map((n) => (
          <NodeItem key={n.id} node={n} scope={scope} depth={0} />
        ))}
      </ul>
    </div>
  )
}

function NodeItem({ node, scope, depth }: { node: CurriculumTreeNode; scope: Scope; depth: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const remove = () =>
    confirm(`حذف «${node.title}» وكل ما تحته؟`) &&
    start(async () => {
      const r = await deleteNodeAction(node.id)
      if (!r.ok) toast('error', r.error.message)
      else router.refresh()
    })
  return (
    <li className={depth === 0 ? 'rounded-lg border bg-card p-3' : 'border-s-2 ps-3'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {KIND_AR[node.kind]}
          </Badge>
          <strong className="text-sm">{node.title}</strong>
          {node.schoolTerm ? <span className="text-[11px] text-muted-foreground">الفصل {node.schoolTerm}</span> : null}
          {node.resources ? <span className="text-[11px] text-primary">{node.resources} مورد</span> : null}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={remove} disabled={pending || node.resources > 0} title={node.resources ? 'مرتبطة بموارد' : 'حذف'}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
      {CHILD[node.kind]!.length ? <AddNode scope={scope} parentId={node.id} parentKind={node.kind} compact /> : null}
      {node.children.length ? (
        <ul className="mt-2 space-y-2">
          {node.children.map((c) => (
            <NodeItem key={c.id} node={c} scope={scope} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function AddNode({ scope, parentId, parentKind, compact }: { scope: Scope; parentId: string | null; parentKind: string; compact?: boolean }) {
  const [state, action] = useActionState(createNodeAction, null)
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state?.ok) ref.current?.reset()
  }, [state])
  const kinds = CHILD[parentKind]!
  return (
    <form ref={ref} action={action} className={compact ? 'mt-2 flex flex-wrap items-center gap-2' : 'flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3'}>
      <input type="hidden" name="subjectId" value={scope.subjectId} />
      <input type="hidden" name="levelId" value={scope.levelId} />
      <input type="hidden" name="streamId" value={scope.streamId ?? ''} />
      <input type="hidden" name="parentId" value={parentId ?? ''} />
      <Select name="kind" defaultValue={kinds[0]} className="h-9 w-24" aria-label="النوع">
        {kinds.map((k) => (
          <option key={k} value={k}>
            {KIND_AR[k]}
          </option>
        ))}
      </Select>
      <Input name="title" required minLength={2} maxLength={200} placeholder={compact ? 'عنوان جديد تحتها…' : 'عنوان الوحدة (مثال: الاحتمالات)'} className="h-9 min-w-0 flex-1" />
      <Select name="schoolTerm" defaultValue="" className="h-9 w-28" aria-label="الفصل">
        <option value="">الفصل —</option>
        <option value="1">الفصل 1</option>
        <option value="2">الفصل 2</option>
        <option value="3">الفصل 3</option>
      </Select>
      <SubmitButton size="sm">
        <Plus className="size-4" /> أضف
      </SubmitButton>
      <FormError state={state} />
    </form>
  )
}
