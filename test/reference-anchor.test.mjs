import assert from 'node:assert/strict'
import test from 'node:test'
import {
  allIndexes,
  cleanReference,
  planAnchoredDraft,
  planRestoredDraft,
  validateDraft,
} from '../lib/reference-anchor.js'

const SOURCE = 'file'

/** Build the chip records a composer draft would carry for these tokens. */
function chipRecords(text, tokens) {
  return tokens.map((token, index) => {
    const offset = text.indexOf(token)
    assert.notEqual(offset, -1, 'fixture token must exist in its draft')
    return {
      source: SOURCE,
      ref: 'file:' + token,
      offset,
      length: token.length,
      label: token,
      appearance: 'folder',
      clipboardText: token,
    }
  })
}

/** The host's snapshotSchema.refine, re-implemented as an assertion helper. */
function assertHostValid(planned) {
  assert.ok(planned, 'plan must not be undefined')
  const { text, references } = planned
  let previousEnd = 0
  for (const reference of references) {
    assert.equal(reference.length, reference.clipboardText.length, 'length must equal clipboardText length')
    assert.equal(reference.offset >= previousEnd, true, 'offsets must ascend and not overlap')
    assert.equal(text.slice(reference.offset, reference.offset + reference.length), reference.clipboardText, 'span must match the chip characters')
    previousEnd = reference.offset + reference.length
  }
  assert.equal(previousEnd <= text.length, true, 'spans must stay inside the text')
}

const TOKENS = ['@docs/', '@src/', '@test/', '@installer/']
const ORIGINAL =
  '按计划推进：先读 @docs/ 里的方案，再看 @src/ 的实现，对照 @test/ 的用例，最后确认 @installer/ 的脚本。'

test('allIndexes finds every non-overlapping occurrence', () => {
  assert.deepEqual(allIndexes('a@b@b@c', '@b'), [1, 3])
  assert.deepEqual(allIndexes('none', '@b'), [])
  assert.deepEqual(allIndexes('any', ''), [])
})

test('cleanReference normalises length and drops a stale invalid flag', () => {
  const record = cleanReference({
    source: SOURCE,
    ref: 'file:@docs/',
    offset: 4,
    length: 99,
    label: '@docs/',
    clipboardText: '@docs/',
    invalid: true,
  })
  assert.equal(record.length, 6)
  assert.equal('invalid' in record, false)
})

test('cleanReference falls back to the source text when clipboardText is missing', () => {
  const record = cleanReference({ source: SOURCE, ref: 'file:@docs/', offset: 2, length: 6 }, 'ab@docs/')
  assert.equal(record.clipboardText, '@docs/')
})

test('four folder references keep their count and land on the preserved paths', () => {
  const references = chipRecords(ORIGINAL, TOKENS)
  const enhanced =
    '目标：把方案落地。第一步读 @docs/，第二步对照 @src/ 的接口，第三步补齐 @test/ 覆盖，最后校验 @installer/ 脚本。'
  const planned = planAnchoredDraft(enhanced, references, ORIGINAL)
  assertHostValid(planned)
  assert.equal(planned.references.length, 4)
  assert.equal(planned.text, enhanced, 'a text that already carries every path is left untouched')
  for (const reference of planned.references) {
    assert.equal(enhanced.slice(reference.offset, reference.offset + reference.length), reference.clipboardText)
  }
})

test('a path the model repeated is collapsed to one chip instead of two', () => {
  const references = chipRecords(ORIGINAL, TOKENS)
  const enhanced =
    '先读 @docs/ 的方案，@docs/ 里也有验收标准；再对照 @src/、@test/ 与 @installer/。'
  const planned = planAnchoredDraft(enhanced, references, ORIGINAL)
  assertHostValid(planned)
  assert.equal(planned.references.length, 4)
  assert.equal(allIndexes(planned.text, '@docs/').length, 1, 'the duplicate copy is removed')
  assert.equal(allIndexes(planned.text, '@src/').length, 1)
})

test('a path the model dropped is appended exactly once at the tail', () => {
  const references = chipRecords(ORIGINAL, TOKENS)
  const enhanced = '目标：把方案落地。第一步读 @docs/，第二步对照 @src/，第三步补齐 @test/。'
  const planned = planAnchoredDraft(enhanced, references, ORIGINAL)
  assertHostValid(planned)
  assert.equal(planned.references.length, 4)
  assert.equal(allIndexes(planned.text, '@installer/').length, 1)
  const tail = planned.references[planned.references.length - 1]
  assert.equal(planned.text.slice(tail.offset), '@installer/', 'the dropped path sits at the very end')
})

test('a path the model stripped of its @ is restored in place, not at the tail', () => {
  const token = '@src/auth/login.ts'
  const original = '帮我重构 ' + token + ' 里的登录逻辑，并补充测试。'
  const references = chipRecords(original, [token])
  const enhanced = '请重构 src/auth/login.ts 中的登录逻辑，并补充测试。'
  const planned = planAnchoredDraft(enhanced, references, original)
  assertHostValid(planned)
  assert.equal(planned.references.length, 1)
  assert.equal(planned.text, '请重构 @src/auth/login.ts 中的登录逻辑，并补充测试。')
  assert.equal(planned.references[0].offset, '请重构 '.length)
})

test('a fragment of a longer path is not claimed by the chip', () => {
  const token = '@src/a.ts'
  const original = '读 ' + token + ' 的实现。'
  const references = chipRecords(original, [token])
  const planned = planAnchoredDraft('请读 src/a.tsx 的实现。', references, original)
  assertHostValid(planned)
  assert.equal(planned.references.length, 1, 'the chip survives')
  assert.equal(allIndexes(planned.text, '@src/a.tsx').length, 0, 'the longer path stays untouched')
  assert.equal(planned.text.includes('src/a.tsx'), true)
  assert.equal(planned.text.endsWith('@src/a.ts'), true, 'the unmatched chip is parked at the tail')
})

test('plain prose without any chip characters stays a plain draft', () => {
  const planned = planAnchoredDraft('纯文本，没有引用。', [], ORIGINAL)
  assert.deepEqual(planned, { text: '纯文本，没有引用。', references: [] })
})

test('two consecutive enhancements keep the reference count stable', () => {
  const references = chipRecords(ORIGINAL, TOKENS)
  const first = '第一步读 @docs/，第二步对照 @src/，第三步补齐 @test/，最后跑 @installer/。'
  const once = planAnchoredDraft(first, references, ORIGINAL)
  assertHostValid(once)
  assert.equal(once.references.length, 4)
  const second = '按顺序：@docs/ → @src/ → @test/ → @installer/。'
  const twice = planAnchoredDraft(second, once.references, once.text)
  assertHostValid(twice)
  assert.equal(twice.references.length, 4)
  assert.equal(twice.references.filter((entry) => entry.clipboardText === '@src/').length, 1)
})

test('legacy tail-parked offsets are rejected by the restore planner', () => {
  const references = chipRecords(ORIGINAL, TOKENS).map((entry) => ({ ...entry, offset: ORIGINAL.length }))
  assert.equal(planRestoredDraft(ORIGINAL, references), undefined)
})

test('a restore with the recorded offsets reproduces the original chips', () => {
  const references = chipRecords(ORIGINAL, TOKENS)
  const planned = planRestoredDraft(ORIGINAL, references)
  assertHostValid(planned)
  assert.equal(planned.references.length, 4)
  assert.deepEqual(planned.references.map((entry) => entry.offset), references.map((entry) => entry.offset))
})

test('a restore whose text was edited underneath is rejected', () => {
  const references = chipRecords(ORIGINAL, TOKENS)
  assert.equal(planRestoredDraft('完全不同的文本', references), undefined)
})

test('the validator enforces the slash-command ordering rule', () => {
  const text = '/enhance @docs/ 方案'
  const before = validateDraft(text, [{ source: SOURCE, ref: 'x', offset: 0, length: 6, label: '@docs/', clipboardText: '@docs/' }])
  assert.equal(before, undefined)
  const at = text.indexOf('@docs/')
  const after = validateDraft(text, [{ source: SOURCE, ref: 'x', offset: at, length: 6, label: '@docs/', clipboardText: '@docs/' }])
  assertHostValid(after)
})

test('overlapping records are rejected rather than written', () => {
  const text = '@docs/@docs/'
  const overlapping = [
    { source: SOURCE, ref: 'a', offset: 0, length: 6, label: 'a', clipboardText: '@docs/' },
    { source: SOURCE, ref: 'b', offset: 3, length: 6, label: 'b', clipboardText: '@docs/' },
  ]
  assert.equal(validateDraft(text, overlapping), undefined)
})
