'use client'

import { useSearchParams } from 'next/navigation'
import ProductForm from '@/components/ProductForm'

export default function NewProductPage() {
  const searchParams = useSearchParams()
  const website = searchParams.get('website') ?? ''
  const company = searchParams.get('company') ?? ''
  const parentId = searchParams.get('parent_id') ?? ''
  return <ProductForm mode="new" initialData={{ website, company, parent_id: parentId }} />
}
