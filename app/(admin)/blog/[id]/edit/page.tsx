import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import EditPostClient from './EditPostClient'

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const service = createServiceClient()
  const { data, error } = await service.from('blog_posts').select('*').eq('id', id).single()

  if (error || !data) {
    notFound()
  }

  return <EditPostClient post={data} />
}
