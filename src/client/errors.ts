/**
 * Error copy for the composer button: stable server codes mapped to a
 * localized primary line, with the upstream `reason` picking a specific fix
 * hint when one exists. Extracted from the retired preview panel so the
 * one-line notice reuses the exact same vocabulary.
 * @module dsh-prompt-forge/client/errors
 */

import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { EnhanceError } from '../shared/protocol'
import type { PromptForgeKey } from './locales'

/**
 * Wire `reason` (`UpstreamReason`, kebab-case as the host sends it) → the
 * dictionary key that carries its fix hint. Explicit on purpose: the keys are
 * camelCase while the wire reasons are kebab-case, so building the key by
 * interpolation silently missed every multi-word reason.
 */
export const UPSTREAM_ERROR_KEYS: Record<string, PromptForgeKey> = {
  auth: 'error.upstream.auth',
  'invalid-credential': 'error.upstream.invalidCredential',
  'rate-limit': 'error.upstream.rateLimit',
  quota: 'error.upstream.quota',
  empty: 'error.upstream.empty',
  'context-window': 'error.upstream.contextWindow',
  'tool-call': 'error.upstream.toolCall',
  'max-tokens': 'error.upstream.maxTokens',
}

/**
 * Primary line for a server-side error, localized by the stable code and its
 * structured params: an upstream `reason` picks a specific fix hint when one
 * exists, and an over-length rejection reuses the too-long input message the
 * client-side guard shows.
 */
export function localizedErrorMessage(
  t: TranslateNS<'prompt-forge'>,
  code: EnhanceError['code'],
  params: EnhanceError['params'],
): string {
  if (code === 'rejected' && typeof params?.count === 'number' && typeof params?.max === 'number') {
    return t('error.tooLong', { count: params.count, max: params.max })
  }
  if (code === 'upstream' && typeof params?.reason === 'string') {
    const specific = UPSTREAM_ERROR_KEYS[params.reason]
    if (specific !== undefined) return t(specific)
  }
  switch (code) {
    case 'rejected': return t('error.rejected')
    case 'rate-limit': return t('error.rateLimit', params)
    case 'concurrency-limit': return t('error.concurrencyLimit', params)
    case 'cooldown': return t('error.cooldown', params)
    case 'timeout': return t('error.timeout', params)
    case 'unconfigured': return t('error.unconfigured')
    case 'upstream': return t('error.upstream')
    default: return t('error.internal')
  }
}
