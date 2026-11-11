import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseApi } from './supabaseCloud'
import { CloudError } from './api'
import { createCampaign } from '../core/nuzlocke/campaign'

describe('RPC de campaña', () => {
  it('lee get_campaign y serializa los argumentos exactos de save_campaign sin propietario ni revisión duplicada', async () => {
    const record = { version: 1 as const, revision: 3, state: createCampaign('rpc'), battle: null }
    const receipt = { revision: 3, operationId: crypto.randomUUID() }
    const rpc = vi.fn().mockResolvedValueOnce({ data: record }).mockResolvedValueOnce({ data: receipt })
    const api = supabaseApi({ rpc } as unknown as SupabaseClient, 'http://unused/functions/v1')
    expect(await api.getCampaign()).toEqual(record)
    expect(await api.saveCampaign({ record, expectedRevision: 2, operationId: receipt.operationId })).toEqual(receipt)
    expect(rpc.mock.calls).toEqual([
      ['get_campaign', {}],
      ['save_campaign', { p_expected_revision: 2, p_operation_id: receipt.operationId,
        p_version: 1, p_state: record.state, p_battle: null }],
    ])
  })

  it('distingue el conflicto SQL de un fallo de transporte', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ error: { code: 'P0001', message: 'campaign_revision_conflict' } })
      .mockRejectedValueOnce(new Error('Failed to fetch'))
    const api = supabaseApi({ rpc } as unknown as SupabaseClient, 'http://unused/functions/v1')
    await expect(api.getCampaign()).rejects.toEqual(new CloudError('campaign_revision_conflict', true))
    await expect(api.getCampaign()).rejects.toEqual(new CloudError('Failed to fetch', false))
  })
})
