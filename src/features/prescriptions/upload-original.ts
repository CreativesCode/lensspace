import type { createClient } from '@/lib/supabase/client'
import { newRequestId } from '@/shared/utils/request-id'

import { prescriptionFileExtension } from './prescription-validation'

type BrowserClient = ReturnType<typeof createClient>
type RevisionTarget = { organizationId: number; branchId: number; prescriptionId: number; revisionId: number }

// Stores the original image/PDF in the private bucket and registers it; an object
// whose metadata could not be saved is removed. Returns whether it was stored.
export async function uploadPrescriptionOriginal(supabase: BrowserClient, target: RevisionTarget, file: File) {
  const path = `${target.organizationId}/${target.branchId}/${target.prescriptionId}/${target.revisionId}/${newRequestId()}.${prescriptionFileExtension(file)}`
  const { error: uploadError } = await supabase.storage
    .from('prescription-originals')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) return false
  const { data: { user } } = await supabase.auth.getUser()
  const { error: metadataError } = await supabase.from('prescription_files').insert({
    organization_id: target.organizationId,
    branch_id: target.branchId,
    prescription_id: target.prescriptionId,
    revision_id: target.revisionId,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type,
    byte_size: file.size,
    uploaded_by: user?.id,
  } as never)
  if (metadataError) {
    await supabase.storage.from('prescription-originals').remove([path])
    return false
  }
  return true
}
