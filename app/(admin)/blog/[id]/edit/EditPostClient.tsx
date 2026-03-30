'use client'

import PostForm from '@/components/PostForm'

interface Post {
  id: string
  website: string
  title: string
  slug: string
  content: string | null
  excerpt: string | null
  cover_image_url: string | null
  meta_title: string | null
  meta_description: string | null
  status: 'draft' | 'published'
  published_at: string | null
}

export default function EditPostClient({ post }: { post: Post }) {
  return (
    <PostForm
      mode="edit"
      postId={post.id}
      initialData={{
        website: post.website,
        title: post.title,
        slug: post.slug,
        content: post.content ?? '',
        excerpt: post.excerpt ?? '',
        cover_image_url: post.cover_image_url ?? '',
        meta_title: post.meta_title ?? '',
        meta_description: post.meta_description ?? '',
        status: post.status,
      }}
    />
  )
}
